import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getProfile, updateProfile, getStreaks, getFollowing, getFollowStatus, followUser, unfollowUser, getProfilePosts, getProfileLikes, getTipActivity, getBookmarks } from '../lib/api'
import { uploadMedia } from '../lib/upload'
import Avatar from '../components/Avatar'
import LoadingHexagon from '../components/LoadingHexagon'

function Profile() {
  const { user, token, isLoggedIn } = useAuth()
  const { wallet: profileWallet } = useParams()
  const targetWallet = profileWallet || user?.wallet
  const isOwnProfile = Boolean(user?.wallet && targetWallet === user.wallet)
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [mode, setMode] = useState('view') // 'view' | 'edit'
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef(null)

  const [streakData, setStreakData] = useState(null)
  const [streakLoading, setStreakLoading] = useState(true)
  const [following, setFollowing] = useState([])
  const [followingLoading, setFollowingLoading] = useState(true)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [profileTab, setProfileTab] = useState('posts')
  const [tabData, setTabData] = useState({ posts: [], likes: [], tips: [], bookmarks: [] })
  const [tabLoading, setTabLoading] = useState(true)

  useEffect(() => {
    if (!targetWallet) return

    setProfileLoading(true)
    getProfile(targetWallet)
      .then((profile) => {
        setDisplayName(profile.displayName || profile.username || '')
        setUsername(profile.username || '')
        setBio(profile.bio || '')
        setAvatarUrl(profile.avatarUrl || '')
        setMode(isOwnProfile && !profile.username ? 'edit' : 'view')
      })
      .catch((err) => console.error(err))
      .finally(() => setProfileLoading(false))

    setStreakLoading(true)
    getStreaks(targetWallet)
      .then((data) => setStreakData(data))
      .catch((err) => console.error(err))
      .finally(() => setStreakLoading(false))

    if (isOwnProfile) {
      setFollowingLoading(true)
      getFollowing(targetWallet)
        .then((data) => setFollowing(data.users || []))
        .catch((err) => console.error(err))
        .finally(() => setFollowingLoading(false))
    } else {
      setFollowingLoading(false)
    }

    if (isLoggedIn && !isOwnProfile) {
      getFollowStatus(targetWallet, token)
        .then((data) => setIsFollowing(Boolean(data.following)))
        .catch((err) => console.error(err))
    }

    setTabLoading(true)
    Promise.all([
      getProfilePosts(targetWallet),
      getProfileLikes(targetWallet),
      getTipActivity(targetWallet),
      isOwnProfile && isLoggedIn ? getBookmarks(targetWallet, token) : Promise.resolve({ posts: [] })
    ])
      .then(([posts, likes, tips, bookmarks]) => setTabData({ posts: posts.posts || [], likes: likes.posts || [], tips: tips.tips || [], bookmarks: bookmarks.posts || [] }))
      .catch((err) => setError(err.message))
      .finally(() => setTabLoading(false))
  }, [targetWallet, isOwnProfile, isLoggedIn, token])

  async function toggleFollow() {
    if (!isLoggedIn || !targetWallet || isOwnProfile) return
    setFollowLoading(true)
    try {
      if (isFollowing) {
        await unfollowUser(targetWallet, token)
        setIsFollowing(false)
      } else {
        await followUser(targetWallet, token)
        setIsFollowing(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setFollowLoading(false)
    }
  }

  async function handleAvatarSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    setError(null)
    try {
      const uploaded = await uploadMedia(file)
      if (!uploaded.url) throw new Error('Image upload did not return a public URL.')
      setAvatarUrl(uploaded.url)
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleSave() {
    if (uploadingAvatar) return
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

  if (!targetWallet) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>
        Connect your wallet to edit your profile.
      </div>
    )
  }

  if (profileLoading) {
    return <LoadingHexagon label="Loading profile" />
  }

  return (
    <div style={{ padding: 16, maxWidth: 380, margin: '0 auto', textAlign: 'center' }}>
      {mode === 'view' ? (
        <div>
          <Avatar url={avatarUrl} fallback={username} size={72} />
          <h2 style={{ margin: '12px 0 2px' }}>{displayName || username || 'Unnamed'}</h2>
          {username && <div style={{ color: 'var(--accent-color)', fontSize: 13 }}>@{username}</div>}
          {bio && <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '0 0 16px' }}>{bio}</p>}

          {isOwnProfile ? (
            <button onClick={() => setMode('edit')} style={{ background: 'transparent', border: '1px solid var(--accent-color)', color: 'var(--accent-color)', borderRadius: 20, padding: '7px 20px', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13 }}>
              Edit profile
            </button>
          ) : isLoggedIn ? (
            <button onClick={toggleFollow} disabled={followLoading} style={{ background: isFollowing ? 'transparent' : 'var(--accent-color)', color: isFollowing ? 'var(--accent-color)' : 'var(--bg-color)', border: '1px solid var(--accent-color)', borderRadius: 20, padding: '7px 22px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, opacity: followLoading ? 0.6 : 1 }}>
              {followLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
            </button>
          ) : null}
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
              disabled={status === 'saving' || uploadingAvatar}
              style={{
                background: 'var(--accent-color)',
                color: 'var(--bg-color)',
                border: 'none',
                borderRadius: 20,
                padding: '9px 28px',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                opacity: status === 'saving' || uploadingAvatar ? 0.6 : 1,
              }}
            >
              {uploadingAvatar ? 'Uploading...' : status === 'saving' ? 'Saving...' : 'Save Profile'}
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

      <hr style={{ border: 'none', borderTop: '1px solid var(--nav-border)', margin: '32px 0 18px' }} />

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--nav-border)', marginBottom: 18 }}>
        {[['posts', 'Posts'], ['activity', 'Activity'], ['likes', 'Likes'], ...(isOwnProfile ? [['bookmarks', 'Bookmarks']] : [])].map(([value, label]) => (
          <button key={value} onClick={() => setProfileTab(value)} style={{ flex: 1, padding: '9px 4px', background: 'transparent', border: 'none', borderBottom: profileTab === value ? '2px solid var(--accent-color)' : '2px solid transparent', color: profileTab === value ? 'var(--accent-color)' : 'var(--text-muted)', fontSize: 12, fontWeight: 700 }}>{label}</button>
        ))}
      </div>

      {tabLoading ? <LoadingHexagon label="Loading profile content" /> : (
        <div style={{ textAlign: 'left' }}>
          {profileTab === 'activity' ? (
            <div>
              {streakLoading ? <LoadingHexagon label="Loading activity" /> : <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 18 }}><div><strong style={{ color: 'var(--accent-color)', fontSize: 22 }}>{streakData?.currentStreak || 0}</strong><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Current streak</div></div><div><strong style={{ color: 'var(--accent-color)', fontSize: 22 }}>{streakData?.longestStreak || 0}</strong><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Longest streak</div></div></div>}
              {tabData.tips.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No tips sent yet.</p> : tabData.tips.map((tip) => <div key={tip.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--nav-border)' }}>Tipped <strong>{tip.display_name || tip.username || tip.to_wallet}</strong> <span style={{ color: 'var(--accent-color)' }}>{tip.amount} NIM</span><div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{tip.status}</div></div>)}
            </div>
          ) : profileTab === 'bookmarks' ? (
            tabData.bookmarks.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No bookmarks yet.</p> : tabData.bookmarks.map((post) => <div key={post.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--nav-border)' }}>{post.text}</div>)
          ) : (
            (tabData[profileTab] || []).length === 0 ? <p style={{ color: 'var(--text-muted)' }}>{profileTab === 'likes' ? 'No liked posts yet.' : 'No posts yet.'}</p> : (tabData[profileTab] || []).map((post) => <div key={post.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--nav-border)' }}><div style={{ fontSize: 14, lineHeight: 1.4 }}>{post.text}</div><div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>{post.author?.displayName || post.author?.username || post.author?.wallet}</div></div>)
          )}
        </div>
      )}
    </div>
  )
}

export default Profile