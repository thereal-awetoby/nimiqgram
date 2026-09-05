import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getChallenge, verifyAuth } from '../lib/api'

function truncateWallet(wallet) {
  if (!wallet) return ''
  return wallet.length > 20 ? `${wallet.slice(0, 10)}…${wallet.slice(-6)}` : wallet
}

function WalletConnect() {
  const { user, login, logout, isLoggedIn } = useAuth()
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  async function handleConnect() {
    setStatus('connecting')
    setError(null)
    try {
      const fakeWallet = 'NQ07 DEV0 0000 0000 0000 0000 0000 0000 0000'
      await getChallenge(fakeWallet)
      setStatus('signing')
      const fakeSignature = `dev:${fakeWallet}`
      const authResult = await verifyAuth({ wallet: fakeWallet, signature: fakeSignature })
      login(authResult)
      setStatus('connected')
    } catch (err) {
      console.error(err)
      setError(err.message)
      setStatus('error')
    }
  }

  const pillStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid var(--nav-border)',
    borderRadius: 20,
    padding: '6px 14px',
    fontSize: 13,
    fontFamily: 'var(--font-display)',
    fontWeight: 500,
    background: 'var(--bg-elevated)',
  }

  if (isLoggedIn) {
    return (
      <div style={pillStyle}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3bc47c', flexShrink: 0 }} />
        <span>{user?.username || truncateWallet(user?.wallet)}</span>
        <button
          onClick={logout}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 12, padding: 0 }}
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={handleConnect}
        disabled={status === 'connecting' || status === 'signing'}
        style={{
          ...pillStyle,
          border: '1px solid var(--accent-color)',
          color: 'var(--accent-color)',
          cursor: status === 'connecting' || status === 'signing' ? 'default' : 'pointer',
        }}
      >
        {status === 'connecting' && 'Requesting...'}
        {status === 'signing' && 'Verifying...'}
        {(status === 'idle' || status === 'error') && 'Connect Wallet'}
      </button>
      {error && <p style={{ color: '#e0245e', fontSize: 12, marginTop: 6 }}>{error}</p>}
    </div>
  )
}

export default WalletConnect