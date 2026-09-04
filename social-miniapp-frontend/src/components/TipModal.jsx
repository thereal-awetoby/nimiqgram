import { useState } from 'react'
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
      // TEMP: real payment (SDK-triggered Nimiq Pay transaction) not wired up yet.
      // Using a fake txHash to test the /tips endpoint end-to-end until
      // real wallet signing is confirmed and swapped in here.
      const fakeTxHash = `dev-tx-${Date.now()}`

      const result = await sendTip(token, {
        toWallet: post.author?.wallet,
        postId: post.id,
        amount: Number(amount),
        txHash: fakeTxHash,
      })

      setStatus('success')
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

        {status === 'success' ? (
          <>
            <p style={{ color: 'green' }}>Tip sent!</p>
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