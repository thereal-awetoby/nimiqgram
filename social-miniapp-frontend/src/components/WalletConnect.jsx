import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getChallenge, verifyAuth, getProfile } from '../lib/api'
import Avatar from './Avatar'

function WalletConnect() {
  const { user, login, logout, isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [myAvatar, setMyAvatar] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!user?.wallet) {
      Promise.resolve().then(() => setMyAvatar(null))
      return
    }
    getProfile(user.wallet)
      .then((p) => setMyAvatar(p.avatarUrl || null))
      .catch(() => {})
  }, [user])

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleConnect() {
    setStatus('connecting')
    setError(null)

    try {
      const { init } = await import('@nimiq/mini-app-sdk')

      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Open this app inside Nimiq Pay to connect your wallet.')), 8000)
      )

      const nimiq = await Promise.race([init(), timeout])

      const accounts = await nimiq.listAccounts()
      if (accounts?.error) throw new Error(accounts.error.message || 'Could not list accounts')
      const claimedWallet = accounts?.[0]
      if (!claimedWallet) throw new Error('No wallet account found.')

      setStatus('signing')
      // NOTE: this challenge is requested for `claimedWallet` (accounts[0]),
      // but nimiq.sign() below has no way to pin which account actually
      // signs — the SDK doesn't expose a "currently active account" getter.
      // If sign() ends up using a different account than accounts[0], the
      // backend will still verify correctly (it derives the real signer's
      // address from the public key in the signature and trusts that over
      // whatever wallet we claim here), but the wallet used for the session
      // is the one returned in authResult below, not claimedWallet.
      const challenge = await getChallenge(claimedWallet)

      const sigResult = await nimiq.sign({ message: challenge.message, isHex: false })
      if (sigResult?.error) throw new Error(sigResult.error.message || 'Signing failed or was rejected')

      const authResult = await verifyAuth({
        wallet: claimedWallet,
        publicKey: sigResult.publicKey,
        signature: sigResult.signature,
      })

      // Trust the wallet the backend actually verified the signature against
      // (derived from the public key) rather than the client-claimed
      // accounts[0] — these can differ, and the derived one is the one the
      // session/token is issued for.
      const verifiedWallet = authResult?.wallet || claimedWallet

      login(authResult)
      try {
        const profile = await getProfile(verifiedWallet)
        if (!profile.username) navigate('/profile', { replace: true })
      } catch {
        navigate('/profile', { replace: true })
      }
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
      <div ref={menuRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setMenuOpen((prev) => !prev)}
          style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <Avatar url={myAvatar} fallback={user?.username || user?.wallet} size={36} />
        </button>

        {menuOpen && (
          <div
            style={{
              position: 'absolute',
              top: 44,
              right: 0,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--nav-border)',
              borderRadius: 12,
              overflow: 'hidden',
              minWidth: 140,
              zIndex: 100,
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            }}
          >
            <button
              onClick={() => { setMenuOpen(false); navigate('/profile') }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: 'transparent', border: 'none', padding: '10px 14px',
                fontFamily: 'var(--font-display)', fontSize: 13.5, color: 'var(--text-color)',
              }}
            >
              Profile
            </button>
            <button
              onClick={() => { setMenuOpen(false); logout() }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: 'transparent', border: 'none', padding: '10px 14px',
                borderTop: '1px solid var(--nav-border)',
                fontFamily: 'var(--font-display)', fontSize: 13.5, color: '#e0245e',
              }}
            >
              Disconnect
            </button>
          </div>
        )}
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
        {status === 'connecting' && 'Connecting...'}
        {status === 'signing' && 'Confirm in Nimiq Pay...'}
        {(status === 'idle' || status === 'error') && 'Connect Wallet'}
      </button>
      {error && <p style={{ color: '#e0245e', fontSize: 12, marginTop: 6 }}>{error}</p>}
    </div>
  )
}

export default WalletConnect