import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getProfile, updateProfile, getStreaks } from '../lib/api'

function Profile() {
  const { user, token, isLoggedIn } = useAuth()
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  const [streakData, setStreakData] = useState(null)
  const [streakLoading, setStreakLoading] = useState(true)

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
      })

    setStreakLoading(true)
    getStreaks(user.wallet)
      .then((data) => setStreakData(data))
      .catch((err) => {
        console.error(err)
      })
      .finally(() => setStreakLoading(false))
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

      <hr style={{ margin: '24px 0' }} />

      <h3>🔥 Streak</h3>
      {streakLoading ? (
        <p>Loading...</p>
      ) : streakData ? (
        <div>
          <p>Current streak: <strong>{streakData.currentStreak}</strong> days</p>
          <p>Longest streak: <strong>{streakData.longestStreak}</strong> days</p>

          <h4>🏅 Badges</h4>
          {streakData.badges && streakData.badges.length > 0 ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {streakData.badges.map((badge, i) => (
                <span
                  key={i}
                  style={{
                    border: '1px solid var(--nav-border)',
                    borderRadius: 6,
                    padding: '4px 10px',
                  }}
                >
                  {typeof badge === 'string' ? badge : badge.name || JSON.stringify(badge)}
                </span>
              ))}
            </div>
          ) : (
            <p style={{ opacity: 0.6 }}>No badges yet.</p>
          )}
        </div>
      ) : (
        <p style={{ opacity: 0.6 }}>No streak data yet.</p>
      )}
    </div>
  )
}

export default Profile