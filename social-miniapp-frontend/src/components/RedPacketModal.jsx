import { useState } from 'react'
import { Transaction } from '@nimiq/core/web'
import { useAuth } from '../context/AuthContext'
import { createRedPacket, fundRedPacket } from '../lib/api'

function getTransactionHash(serializedTransaction) {
  if (typeof serializedTransaction !== 'string') throw new Error('The wallet did not return a transaction.')
  const normalized = serializedTransaction.trim().replace(/^0x/i, '').replace(/\s+/g, '').toLowerCase()
  if (/^[0-9a-f]{64}$/.test(normalized)) return normalized
  return Transaction.fromAny(normalized).hash()
}

function RedPacketModal({ onClose, onCreated }) {
  const { token } = useAuth()
  const [amount, setAmount] = useState('10')
  const [claimLimit, setClaimLimit] = useState('5')
  const [expiryHours, setExpiryHours] = useState('24')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  async function handleCreate() {
    setStatus('creating')
    setError(null)
    try {
      const expiresAt = new Date(Date.now() + Number(expiryHours) * 60 * 60 * 1000).toISOString()
      const packet = await createRedPacket(token, { amount: Number(amount), claimLimit: Number(claimLimit), expiresAt })
      const { init } = await import('@nimiq/mini-app-sdk')
      const nimiq = await init()
      setStatus('funding')
      const transaction = await nimiq.sendBasicTransaction({
        recipient: packet.escrowAddress,
        value: Math.round(Number(amount) * 100000),
      })
      if (transaction?.error) throw new Error(transaction.error.message || 'The wallet rejected the funding transaction.')
      const result = await fundRedPacket(token, packet.id, { txHash: getTransactionHash(transaction) })
      setStatus('success')
      onCreated?.(result)
    } catch (err) {
      console.error(err)
      setError(err.message)
      setStatus('error')
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ width: 'min(92vw, 360px)', padding: 22, borderRadius: 12, background: 'var(--bg-color)', color: 'var(--text-color)' }} onClick={(event) => event.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Create red packet</h3>
        <label>Total amount (NIM)</label>
        <input type="number" min="0.00001" step="0.1" value={amount} onChange={(event) => setAmount(event.target.value)} style={{ width: '100%', margin: '5px 0 12px' }} />
        <label>Number of people</label>
        <input type="number" min="1" step="1" value={claimLimit} onChange={(event) => setClaimLimit(event.target.value)} style={{ width: '100%', margin: '5px 0 12px' }} />
        <label>Expires in (hours)</label>
        <input type="number" min="1" max="168" step="1" value={expiryHours} onChange={(event) => setExpiryHours(event.target.value)} style={{ width: '100%', margin: '5px 0 12px' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Your wallet will send the exact amount to the escrow wallet. Each person can claim once.</p>
        {error && <p style={{ color: '#e0245e', fontSize: 13 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleCreate} disabled={status === 'creating' || status === 'funding' || !amount || !claimLimit || !expiryHours} style={{ background: 'var(--accent-color)', color: 'var(--bg-color)', border: 'none', borderRadius: 20, padding: '8px 14px', fontWeight: 700 }}>
            {status === 'creating' ? 'Preparing...' : status === 'funding' ? 'Confirm in wallet...' : status === 'success' ? 'Created' : 'Fund packet'}
          </button>
          <button onClick={onClose} disabled={status === 'creating' || status === 'funding'}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default RedPacketModal
