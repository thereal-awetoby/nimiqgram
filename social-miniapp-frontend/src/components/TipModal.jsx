import { useEffect, useState } from 'react'
import initCore, { Transaction } from '@nimiq/core/web'
import { useAuth } from '../context/AuthContext'
import { sendTip } from '../lib/api'
import { sendWalletTransaction } from '../lib/walletTransaction'

function normalizeHexString(value) {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/^0x/i, '').replace(/\s+/g, '').toLowerCase()
}

function normalizeWalletAddress(value) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, '').toLowerCase()
}

function requireTransactionHash(value) {
  const hash = normalizeHexString(value)
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error('The wallet returned an invalid transaction hash.')
  return hash
}

function decodeHexString(hex) {
  if (!hex || hex.length % 2 !== 0) return null
  try {
    return Uint8Array.from(hex.match(/.{1,2}/g).map((byte) => Number.parseInt(byte, 16)))
  } catch {
    return null
  }
}

function getTransactionHash(serializedTransaction) {
  if (serializedTransaction == null) throw new Error('The wallet did not return a transaction.')

  if (typeof serializedTransaction === 'object') {
    const nested = serializedTransaction.transaction
      ?? serializedTransaction.tx
      ?? serializedTransaction.raw
      ?? serializedTransaction.data
      ?? serializedTransaction.serializedTransaction
      ?? serializedTransaction.result
    if (nested) return getTransactionHash(nested)

    const directHash = serializedTransaction.hash
      ?? serializedTransaction.txHash
      ?? serializedTransaction.transactionHash
    if (typeof directHash === 'string' && directHash.trim()) return requireTransactionHash(directHash)
  }

  if (typeof serializedTransaction === 'string') {
    const normalized = normalizeHexString(serializedTransaction)
    if (!normalized) throw new Error('The wallet returned an empty transaction payload.')
    if (normalized.length === 64 && /^[0-9a-f]+$/.test(normalized)) return normalized

    try {
      return requireTransactionHash(Transaction.fromAny(normalized).hash())
    } catch {
      const bytes = decodeHexString(normalized)
      if (bytes) {
        try {
          return requireTransactionHash(Transaction.deserialize(bytes).hash())
        } catch {
          throw new Error('The wallet returned a malformed transaction payload.')
        }
      }
    }
  }

  throw new Error('The wallet returned a malformed transaction payload.')
}

function getTransactionSender(serializedTransaction) {
  const hex = typeof serializedTransaction === 'string'
    ? normalizeHexString(serializedTransaction)
    : normalizeHexString(
        serializedTransaction?.transaction
        ?? serializedTransaction?.tx
        ?? serializedTransaction?.raw
        ?? serializedTransaction?.data
        ?? serializedTransaction?.serializedTransaction
        ?? serializedTransaction?.result
      )
  if (!hex) return null

  try {
    return Transaction.fromAny(hex).sender.toUserFriendlyAddress()
  } catch {
    const bytes = decodeHexString(hex)
    if (!bytes) return null
    try {
      return Transaction.deserialize(bytes).sender.toUserFriendlyAddress()
    } catch {
      return null
    }
  }
}

function TipModal({ post, onClose, onSuccess, onPending, verificationStatus }) {
  const { token, user } = useAuth()
  const [amount, setAmount] = useState('1')
  const [status, setStatus] = useState('idle') // idle | sending | pending | success | error
  const [error, setError] = useState(null)

  // Reflects the parent's independent polling (usePendingTips) back into the
  // modal's own UI, in case the user keeps it open. If they close it, this
  // component unmounts and simply stops listening — the parent keeps polling.
  useEffect(() => {
    if (verificationStatus === 'verified' && status === 'pending') {
      setStatus('success')
    }
  }, [verificationStatus, status])

  async function handleSendTip() {
    setStatus('sending')
    setError(null)

    try {
      const { init } = await import('@nimiq/mini-app-sdk')
      const nimiq = await init()
      const serializedTransaction = await sendWalletTransaction(nimiq, {
        recipient: post.author?.wallet,
        value: Math.round(Number(amount) * 100000),
      })
      if (serializedTransaction?.error) throw new Error(serializedTransaction.error.message || 'The wallet rejected the tip.')

      await initCore()
      const txHash = getTransactionHash(serializedTransaction)

      const actualSender = normalizeWalletAddress(getTransactionSender(serializedTransaction))
      const loggedInWallet = normalizeWalletAddress(user?.wallet)
      if (actualSender && loggedInWallet && actualSender !== loggedInWallet) {
        throw new Error('This tip was sent from a different Nimiq Pay account than the one you\'re logged in with. Switch to your logged-in account in Nimiq Pay and try again.')
      }

      let result
      try {
        result = await sendTip(token, {
          toWallet: post.author?.wallet,
          postId: post.id,
          amount: Number(amount),
          txHash,
        })
      } catch (err) {
        throw new Error(err.message)
      }

      if (result?.status === 'verified') {
        setStatus('success')
        onSuccess?.(result)
      } else {
        setStatus('pending')
        onPending?.(result)
      }
    } catch (err) {
      console.error(err)
      setError(err.message)
      setStatus('error')
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-color)',
          color: 'var(--text-color)',
          padding: 24,
          borderRadius: 8,
          minWidth: 280,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <h3>Tip {post.author?.username || post.author?.wallet}</h3>

        {status === 'success' || status === 'pending' ? (
          <>
            <p style={{ color: status === 'pending' ? 'var(--accent-color)' : 'green' }}>
              {status === 'pending' ? 'Tip broadcast successfully. Waiting for blockchain confirmation.' : 'Tip confirmed on-chain.'}
            </p>
            {status === 'pending' && (
              <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                Your wallet has already sent the transaction. We are waiting for the network to confirm it before marking it as complete.
              </p>
            )}
            <button onClick={onClose}>Close</button>
          </>
        ) : (
          <>
            <label>Amount (NIM)</label><br />
            <input
              type="number"
              min="0"
              step="0.1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              style={{ width: '100%', marginBottom: 12 }}
            />

            {error && <p style={{ color: 'red' }}>{error}</p>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSendTip} disabled={status === 'sending' || !amount}>
                {status === 'sending' ? 'Sending...' : 'Send Tip'}
              </button>
              <button onClick={onClose} disabled={status === 'sending'}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default TipModal