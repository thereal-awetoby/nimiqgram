import { useState } from 'react'
import initCore, { Transaction } from '@nimiq/core/web'
import { useAuth } from '../context/AuthContext'
import { sendTip } from '../lib/api'

function TipModal({ post, onClose, onSuccess }) {
  const { token } = useAuth()
  const [amount, setAmount] = useState('1')
  const [status, setStatus] = useState('idle') // idle | sending | success | error
  const [error, setError] = useState(null)

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
      if (typeof serializedTransaction !== 'string') throw new Error('The wallet did not return a transaction.')

      await initCore()
      const txHash = Transaction.fromAny(serializedTransaction).hash()

      const result = await sendTip(token, {
        toWallet: post.author?.wallet,
        postId: post.id,
        amount: Number(amount),
        txHash,
      })

      setStatus(result.status === 'pending' ? 'pending' : 'success')
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
              {status === 'pending' ? 'Tip submitted and awaiting blockchain verification.' : 'Tip sent!'}
            </p>
            {status === 'pending' && <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>The transaction was broadcast and will be marked verified once the network indexer sees it.</p>}
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