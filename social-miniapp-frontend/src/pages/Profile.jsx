import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { getProfile, updateProfile, getStreaks, getFollowing } from '../lib/api'
import { uploadMedia } from '../lib/upload'
import Avatar from '../components/Avatar'

function Profile() {
  const { user, token, isLoggedIn } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('view') // 'view' | 'edit'
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef(null)

  const [streakData, setStreakData] = useState(null)
  const [streakLoading, setStreakLoading] = useState(true)
  const [following, setFollowing] = useState([])
  const [followingLoading, setFollowingLoading] = useState(true)

  useEffect(() => {
    if (!user?.wallet) return

    getProfile(user.wallet)
      .then((profile) => {
        setDisplayName(profile.displayName || profile.username || '')
        setUsername(profile.username || '')
        setBio(profile.bio || '')
        setAvatarUrl(profile.avatarUrl || '')
        setMode(profile.username ? 'view' : 'edit')
      })
      .catch((err) => console.error(err))

    setStreakLoading(true)
    getStreaks(user.wallet)
      .then((data) => setStreakData(data))
      .catch((err) => console.error(err))
      .finally(() => setStreakLoading(false))

    setFollowingLoading(true)
    getFollowing(user.wallet)
      .then((data) => setFollowing(data.users || []))
      .catch((err) => console.error(err))
      .finally(() => setFollowingLoading(false))
  }, [user])

  async function handleAvatarSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    setError(null)
    try {
      const uploaded = await uploadMedia(file)
      setAvatarUrl(uploaded.url)
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleSave() {
    setStatus('saving')
    setError(null)
    try {
      await updateProfile(token, { displayName, username, bio, avatarUrl: avatarUrl.trim() || null })
      setStatus('saved')
      setMode('view')
    } catch (err) {
      console.error(err)
      setError(err.message)
      setStatus('error')
    }
  }

  if (!isLoggedIn) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>
        Connect your wallet to edit your profile.
      </div>
    )
  }

  return (
    <div style={{ padding: 16, maxWidth: 380, margin: '0 auto', textAlign: 'center' }}>
      {mode === 'view' ? (
        <div>
          <Avatar url={avatarUrl} fallback={username} size={72} />
          <h2 style={{ margin: '12px 0 2px' }}>{displayName || username || 'Unnamed'}</h2>
          {username && <div style={{ color: 'var(--accent-color)', fontSize: 13 }}>@{username}</div>}
          {bio && <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '0 0 16px' }}>{bio}</p>}

          <button
            onClick={() => setMode('edit')}
            style={{
              background: 'transparent',
              border: '1px solid var(--accent-color)',
              color: 'var(--accent-color)',
              borderRadius: 20,
              padding: '7px 20px',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Edit profile
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 12 }}>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{ position: 'relative', cursor: 'pointer', display: 'inline-block' }}
            >
              <Avatar url={avatarUrl} fallback={username} size={72} />
              <div
                style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: 'var(--accent-color)',
                  border: '2px solid var(--bg-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--bg-color)" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
              {uploadingAvatar && (
                <div
                  style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.5)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 10,
                  }}
                >
                  ...
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarSelect}
              style={{ display: 'none' }}
            />
          </div>

          <h2 style={{ margin: '0 0 24px' }}>Edit Profile</h2>

          <div style={{ textAlign: 'left' }}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Name</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={{ width: '100%', marginTop: 4 }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ width: '100%', marginTop: 4 }}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                style={{ width: '100%', marginTop: 4, height: 80, resize: 'none' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={handleSave}
              disabled={status === 'saving'}
              style={{
                background: 'var(--accent-color)',
                color: 'var(--bg-color)',
                border: 'none',
                borderRadius: 20,
                padding: '9px 28px',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                opacity: status === 'saving' ? 0.6 : 1,
              }}
            >
              {status === 'saving' ? 'Saving...' : 'Save Profile'}
            </button>

            {username && (
              <button
                onClick={() => setMode('view')}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--nav-border)',
                  color: 'var(--text-muted)',
                  borderRadius: 20,
                  padding: '9px 20px',
                  fontFamily: 'var(--font-display)',
                }}
              >
                Cancel
              </button>
            )}
          </div>

          {error && <p style={{ color: '#e0245e', fontSize: 13, marginTop: 10 }}>{error}</p>}
        </div>
      )}

      <hr style={{ border: 'none', borderTop: '1px solid var(--nav-border)', margin: '32px 0' }} />

      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12, textAlign: 'left' }}>Following</h3>
        {followingLoading ? (
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading...</p>
        ) : following.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Not following anyone yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
            {following.map((person) => (
              <div key={person.wallet} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--nav-border)', borderRadius: 12 }}>
                <Avatar url={person.avatarUrl} fallback={person.username || person.wallet} size={28} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{person.displayName || person.username || person.wallet}</div>
                  {person.username && <div style={{ color: 'var(--accent-color)', fontSize: 11 }}>@{person.username}</div>}
                  {person.bio && <div style={{ color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.bio}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <h3 style={{ fontSize: 15, marginBottom: 16 }}>Activity</h3>

      {streakLoading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      ) : streakData ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 20 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--accent-color)' }}>
                {streakData.currentStreak}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Current streak</div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--accent-color)' }}>
                {streakData.longestStreak}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Longest streak</div>
            </div>
          </div>

          {streakData.badges && streakData.badges.length > 0 ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {streakData.badges.map((badge, i) => (
                <span
                  key={i}
                  style={{
                    border: '1px solid var(--accent-color)',
                    color: 'var(--accent-color)',
                    borderRadius: 14,
                    padding: '5px 14px',
                    fontSize: 12.5,
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                  }}
                >
                  {typeof badge === 'string' ? badge : badge.name || JSON.stringify(badge)}
                </span>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No badges yet.</p>
          )}
        </div>
      ) : (
        <p style={{ color: 'var(--text-muted)' }}>No streak data yet.</p>
      )}
    </div>
  )
}

export default Profile