import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getChallenge, verifyAuth } from '../lib/api'

function WalletConnect() {
  const { user, login, logout, isLoggedIn } = useAuth()
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  async function handleConnect() {
    setStatus('connecting')
    setError(null)

    try {
      // TEMP: using a fake dev wallet address until we test with a real
      // Nimiq Pay wallet on a phone. The backend accepts "dev:<wallet>"
      // as a valid signature only in local/dev mode.
      const fakeWallet = 'NQ07 DEV0 0000 0000 0000 0000 0000 0000 0000'

      const challenge = await getChallenge(fakeWallet)
      setStatus('signing')

      const fakeSignature = `dev:${fakeWallet}`

      const authResult = await verifyAuth({
        wallet: fakeWallet,
        signature: fakeSignature,
      })

      login(authResult)
      setStatus('connected')
    } catch (err) {
      console.error(err)
      setError(err.message)
      setStatus('error')
    }
  }

  if (isLoggedIn) {
    return (
      <div>
        <span>Connected: {user?.wallet || user?.username || 'wallet'}</span>
        <button onClick={logout} style={{ marginLeft: 12 }}>
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <div>
      <button onClick={handleConnect} disabled={status === 'connecting' || status === 'signing'}>
        {status === 'connecting' && 'Requesting challenge...'}
        {status === 'signing' && 'Verifying...'}
        {(status === 'idle' || status === 'error') && 'Connect Wallet'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  )
}

export default WalletConnect