import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getProfile, updateProfile } from '../lib/api'

function Profile() {
  const { user, token, isLoggedIn } = useAuth()
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user?.wallet) return

    getProfile(user.wallet)
      .then((profile) => {
        setUsername(profile.username || '')
        setBio(profile.bio || '')
        setAvatarUrl(profile.avatarUrl || '')
      })
      .catch((err) => {
        console.error(err)
        // Not fatal — a brand new user may not have a profile yet
      })
  }, [user])

  async function handleSave() {
    setStatus('saving')
    setError(null)
    try {
      await updateProfile(token, { username, bio, avatarUrl })
      setStatus('saved')
    } catch (err) {
      console.error(err)
      setError(err.message)
      setStatus('error')
    }
  }

  if (!isLoggedIn) {
    return <div>Connect your wallet to edit your profile.</div>
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Edit Profile</h2>

      <div style={{ marginBottom: 12 }}>
        <label>Username</label><br />
        <input value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label>Bio</label><br />
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label>Avatar URL</label><br />
        <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
      </div>

      <button onClick={handleSave} disabled={status === 'saving'}>
        {status === 'saving' ? 'Saving...' : 'Save Profile'}
      </button>

      {status === 'saved' && <p style={{ color: 'green' }}>Saved!</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  )
}

export default Profile