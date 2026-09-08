import { useEffect, useState } from 'react'
import initCore, { Transaction } from '@nimiq/core/web'
import { useAuth } from '../context/AuthContext'
import { sendTip, verifyTip } from '../lib/api'

function normalizeHexString(value) {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/^0x/i, '').replace(/\s+/g, '')
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
    if (typeof directHash === 'string' && directHash.trim()) return normalizeHexString(directHash)
  }

  if (typeof serializedTransaction === 'string') {
    const normalized = normalizeHexString(serializedTransaction)
    if (!normalized) throw new Error('The wallet returned an empty transaction payload.')
    if (normalized.length === 64 && /^[0-9a-fA-F]+$/.test(normalized)) return normalized

    const bytes = decodeHexString(normalized)
    if (bytes) {
      try {
        return Transaction.deserialize(bytes).hash()
      } catch {
        try {
          return Transaction.fromAny(normalized).hash()
        } catch {
          throw new Error('The wallet returned a malformed transaction payload.')
        }
      }
    }
  }

  throw new Error('The wallet returned a malformed transaction payload.')
}

function TipModal({ post, onClose, onSuccess }) {
  const { token } = useAuth()
  const [amount, setAmount] = useState('1')
  const [status, setStatus] = useState('idle') // idle | sending | pending | success | error
  const [pendingTipId, setPendingTipId] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (status !== 'pending' || !pendingTipId) return undefined

    let cancelled = false
    let attempts = 0
    let timer

    async function retryVerification() {
      attempts += 1
      try {
        const result = await verifyTip(token, pendingTipId)
        if (cancelled) return
        if (result?.status === 'verified') {
          setStatus('success')
          onSuccess?.(result)
          return
        }
      } catch (err) {
        console.error(err)
      }

      if (!cancelled && attempts < 10) {
        timer = window.setTimeout(retryVerification, 3000)
      }
    }

    timer = window.setTimeout(retryVerification, 3000)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [onSuccess, pendingTipId, status, token])

  async function handleSendTip() {
    setStatus('sending')
    setError(null)

    try {
      const { init } = await import('@nimiq/mini-app-sdk')
      const nimiq = await init()
      const serializedTransaction = await nimiq.sendBasicTransaction({
        recipient: post.author?.wallet,
        value: Math.round(Number(amount) * 100000),
      })
      if (serializedTransaction?.error) throw new Error(serializedTransaction.error.message || 'The wallet rejected the tip.')

      await initCore()
      const txHash = getTransactionHash(serializedTransaction)

      const result = await sendTip(token, {
        toWallet: post.author?.wallet,
        postId: post.id,
        amount: Number(amount),
        txHash,
      })

      if (result?.status === 'verified') {
        setStatus('success')
      } else {
        setPendingTipId(result?.id)
        setStatus('pending')
      }
      onSuccess?.(result)
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
        onClick={(e) => e.stopPropagation()}
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
              onChange={(e) => setAmount(e.target.value)}
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