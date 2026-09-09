import { useState, useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getProfile, updateProfile, getStreaks, getFollowing, getFollowers, getFollowStatus, followUser, unfollowUser, getProfilePosts, getProfileLikes, getTipActivity, verifyTip, getBookmarks } from '../lib/api'
import { uploadMedia } from '../lib/upload'
import Avatar from '../components/Avatar'
import LoadingHexagon from '../components/LoadingHexagon'
import { formatPostDate } from '../lib/date'
import VideoPreview from '../components/VideoPreview'

function HeartIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 21s-7.5-4.6-10-9.3C.5 8 2.2 4.5 6 4a5.6 5.6 0 0 1 6 3 5.6 5.6 0 0 1 6-3c3.8.5 5.5 4 4 7.7C19.5 16.4 12 21 12 21z" />
    </svg>
  )
}

function CommentIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3 1-4.5A8 8 0 1 1 21 12z" />
    </svg>
  )
}

function TipIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.3c0-1.1 1.1-2 2.5-2s2.5.7 2.5 1.8c0 2.5-5 1.7-5 4.2 0 1.1 1.1 1.9 2.5 1.9s2.5-.9 2.5-2" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function BookmarkIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 4.5A2.5 2.5 0 0 1 8.5 2h7A2.5 2.5 0 0 1 18 4.5V22l-6-3.5L6 22V4.5Z" />
    </svg>
  )
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

function Profile() {
  const { user, token, isLoggedIn } = useAuth()
  const { wallet: profileWallet } = useParams()
  const targetWallet = profileWallet || user?.wallet
  const isOwnProfile = Boolean(user?.wallet && targetWallet === user.wallet)
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [bannerUrl, setBannerUrl] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [mode, setMode] = useState('view') // 'view' | 'edit'
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const fileInputRef = useRef(null)
  const bannerInputRef = useRef(null)

  const [streakData, setStreakData] = useState(null)
  const [streakLoading, setStreakLoading] = useState(true)
  const [following, setFollowing] = useState([])
  const [followers, setFollowers] = useState([])
  const [followingLoading, setFollowingLoading] = useState(true)
  const [peopleTab, setPeopleTab] = useState(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [profileTab, setProfileTab] = useState('posts')
  const [tabData, setTabData] = useState({ posts: [], likes: [], tips: [], bookmarks: [], bookmarkCount: 0 })
  const [tabLoading, setTabLoading] = useState(true)

  function ProfilePostMedia({ post }) {
    if (!post.mediaUrl) return null
    if (post.mediaType === 'video') return <VideoPreview src={post.mediaUrl} style={{ width: '100%', maxHeight: 260, marginTop: 8, borderRadius: 10 }} />
    return <img src={post.mediaUrl} alt="" style={{ display: 'block', width: '100%', maxHeight: 260, objectFit: 'cover', marginTop: 8, borderRadius: 10 }} />
  }

  function ProfilePost({ post }) {
    return (
      <Link to={`/post/${post.id}`} style={{ display: 'block', color: 'inherit', padding: '10px 0', borderBottom: '1px solid var(--nav-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{post.author?.displayName || post.author?.username || post.author?.wallet}</div>
          {formatPostDate(post.createdAt) && <time dateTime={post.createdAt} style={{ color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>{formatPostDate(post.createdAt)}</time>}
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.4, marginTop: 5 }}>{post.text}</div>
        <ProfilePostMedia post={post} />
        {post.redPacket && (
          <div style={{ marginTop: 8, padding: 10, border: '1px solid var(--tip-accent)', borderRadius: 10, background: 'rgba(200, 139, 20, 0.08)' }}>
            <strong style={{ color: 'var(--tip-accent)' }}>Red packet</strong>
            <div style={{ marginTop: 3, fontSize: 12 }}>{post.redPacket.remainingAmount} NIM remaining for {Math.max(0, Number(post.redPacket.claimLimit) - Number(post.redPacket.claimedCount))} people</div>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 9, gap: 2, fontSize: 12.5, fontWeight: 600 }}>
          <span title="Comments" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, minWidth: 38, flex: 1, color: 'var(--comment-accent)' }}><CommentIcon /> {post.commentCount ?? 0}</span>
          <span title="Tips" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, minWidth: 38, flex: 1, color: 'var(--tip-accent)' }}><TipIcon /> {post.tipTotal ?? 0}</span>
          <span title="Likes" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, minWidth: 38, flex: 1, color: 'var(--like-accent)' }}><HeartIcon /> {post.likeCount ?? 0}</span>
          <span title="Views" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, minWidth: 38, flex: 1, color: 'var(--view-accent)' }}><EyeIcon /> {post.viewCount ?? 0}</span>
          <span title="Bookmarks" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, minWidth: 38, flex: 1, color: 'var(--accent-color)' }}><BookmarkIcon /> {post.bookmarkCount ?? 0}</span>
        </div>
      </Link>
    )
  }

  useEffect(() => {
    if (!targetWallet) return

    Promise.resolve().then(() => setProfileLoading(true))
    getProfile(targetWallet)
      .then((profile) => {
        setDisplayName(profile.displayName || profile.username || '')
        setUsername(profile.username || '')
        setBio(profile.bio || '')
        setAvatarUrl(profile.avatarUrl || '')
        setBannerUrl(profile.bannerUrl || '')
        setMode(isOwnProfile && !profile.username ? 'edit' : 'view')
      })
      .catch((err) => console.error(err))
      .finally(() => setProfileLoading(false))

    Promise.resolve().then(() => setStreakLoading(true))
    getStreaks(targetWallet)
      .then((data) => setStreakData(data))
      .catch((err) => console.error(err))
      .finally(() => setStreakLoading(false))

    Promise.resolve().then(() => setFollowingLoading(true))
    Promise.all([getFollowing(targetWallet), getFollowers(targetWallet)])
      .then(([followingData, followersData]) => {
        setFollowing(followingData.users || [])
        setFollowers(followersData.users || [])
      })
      .catch((err) => console.error(err))
      .finally(() => setFollowingLoading(false))

    if (isLoggedIn && !isOwnProfile) {
      getFollowStatus(targetWallet, token)
        .then((data) => setIsFollowing(Boolean(data.following)))
        .catch((err) => console.error(err))
    }

    Promise.resolve().then(() => setTabLoading(true))
    Promise.all([
      getProfilePosts(targetWallet),
      getProfileLikes(targetWallet),
      getTipActivity(targetWallet),
      isOwnProfile && isLoggedIn ? getBookmarks(targetWallet, token) : Promise.resolve({ posts: [] })
    ])
      .then(async ([posts, likes, tips, bookmarks]) => {
        const pendingTips = isOwnProfile && isLoggedIn
          ? (tips.tips || []).filter((tip) => tip.status === 'pending').slice(0, 3)
          : []
        const verifiedTips = []
        for (const tip of pendingTips) {
          const verifiedTip = await verifyTip(token, tip.id).catch(() => null)
          verifiedTips.push(verifiedTip)
          await wait(1500)
        }
        const verifiedById = new Map(verifiedTips.filter(Boolean).map((tip) => [tip.id, tip]))
        const refreshedTips = (tips.tips || []).map((tip) => ({ ...tip, status: verifiedById.get(tip.id)?.status || tip.status }))
        const postsWereUpdated = verifiedTips.some((tip) => tip?.status === 'verified')
        const refreshedPosts = postsWereUpdated ? await getProfilePosts(targetWallet) : posts
        setTabData({ posts: refreshedPosts.posts || [], likes: likes.posts || [], tips: refreshedTips, bookmarks: bookmarks.posts || [], bookmarkCount: bookmarks.count ?? bookmarks.posts?.length ?? 0 })
      })
      .catch((err) => setError(err.message))
      .finally(() => setTabLoading(false))
  }, [targetWallet, isOwnProfile, isLoggedIn, token])

  async function toggleFollow() {
    if (!isLoggedIn || !targetWallet || isOwnProfile) return
    setFollowLoading(true)
    setError(null)
    try {
      if (isFollowing) {
        await unfollowUser(targetWallet, token)
        setIsFollowing(false)
        setFollowers((current) => current.filter((person) => person.wallet !== user.wallet))
      } else {
        await followUser(targetWallet, token)
        setIsFollowing(true)
        setFollowers((current) => current.some((person) => person.wallet === user.wallet) ? current : [...current, { wallet: user.wallet, username: user.username }])
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

  async function handleBannerSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingBanner(true)
    setError(null)
    try {
      const uploaded = await uploadMedia(file)
      if (!uploaded.url) throw new Error('Image upload did not return a public URL.')
      setBannerUrl(uploaded.url)
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setUploadingBanner(false)
    }
  }

  async function handleSave() {
    if (uploadingAvatar || uploadingBanner) return
    setStatus('saving')
    setError(null)
    try {
      await updateProfile(token, { displayName, username, bio, avatarUrl: avatarUrl.trim() || null, bannerUrl: bannerUrl.trim() || null })
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
    <div style={{ width: '100%', maxWidth: 760, margin: 0, padding: 0, textAlign: 'left' }}>
      {mode === 'view' ? (
        <>
          <div
            style={{
              position: 'relative',
              minHeight: 150,
              margin: 0,
              borderBottom: '1px solid var(--nav-border)',
              background: (bannerUrl || avatarUrl)
                ? `linear-gradient(rgba(0,0,0,0.22), rgba(0,0,0,0.58)), url(${bannerUrl || avatarUrl}) center/cover no-repeat`
                : 'linear-gradient(135deg, rgba(242,183,5,0.3), rgba(94,93,255,0.2), rgba(14,165,233,0.16))',
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(15,23,42,0.05), rgba(15,23,42,0.42))' }} />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 12, padding: '82px 16px 14px', flexWrap: 'wrap' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-color)', border: '3px solid var(--bg-color)', boxShadow: '0 10px 18px rgba(0,0,0,0.12)' }}>
                <Avatar url={avatarUrl} fallback={username} size={74} />
              </div>
              <div style={{ flex: 1, minWidth: 0, color: '#fff', paddingRight: 8 }}>
                <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>{displayName || username || 'Unnamed'}</div>
                {username && <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: 13, marginTop: 2 }}>@{username}</div>}
              </div>

              {isOwnProfile ? (
                <button onClick={() => setMode('edit')} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.28)', color: '#fff', borderRadius: 20, padding: '7px 18px', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, marginLeft: 'auto' }}>
                  Edit profile
                </button>
              ) : isLoggedIn ? (
                <button
                  onClick={toggleFollow}
                  disabled={followLoading}
                  aria-label={isFollowing ? 'Unfollow user' : 'Follow user'}
                  aria-pressed={isFollowing}
                  style={{ background: isFollowing ? 'transparent' : 'var(--accent-color)', color: isFollowing ? 'var(--accent-color)' : 'var(--bg-color)', border: '1px solid var(--accent-color)', borderRadius: 20, padding: '7px 18px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, opacity: followLoading ? 0.6 : 1, marginLeft: 'auto' }}
                >
                  {followLoading ? '...' : isFollowing ? 'Unfollow' : 'Follow'}
                </button>
              ) : null}
            </div>
          </div>

          <div style={{ padding: '16px 16px 0' }}>
            {bio && <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.5, margin: '0 0 12px' }}>{bio}</p>}
            {!bio && isOwnProfile && <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 12px' }}>Add a bio to tell people a little about you.</p>}

             <div style={{ display: 'flex', gap: 8, marginTop: bio || isOwnProfile ? 0 : 12, justifyContent: 'center' }}>
              {['followers', 'following'].map((tab) => {
                const people = tab === 'followers' ? followers : following
                const label = tab === 'followers' ? 'Followers' : 'Following'
                return (
                  <button
                    key={tab}
                    onClick={() => setPeopleTab((current) => current === tab ? null : tab)}
                    aria-pressed={peopleTab === tab}
                    style={{ background: peopleTab === tab ? 'var(--accent-color)' : 'transparent', color: peopleTab === tab ? 'var(--bg-color)' : 'var(--text-muted)', border: '1px solid var(--nav-border)', borderRadius: 16, padding: '6px 12px', fontSize: 12.5, fontWeight: 700 }}
                  >
                    {label} {people.length}
                  </button>
                )
              })}
            </div>

            {peopleTab && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {followingLoading ? <LoadingHexagon label={`Loading ${peopleTab}`} /> : (peopleTab === 'followers' ? followers : following).length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>No {peopleTab} yet.</p>
                ) : (
                  (peopleTab === 'followers' ? followers : following).map((person) => (
                    <Link key={person.wallet} to={`/profile/${encodeURIComponent(person.wallet)}`} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', color: 'inherit' }}>
                      <Avatar url={person.avatarUrl} fallback={person.username || person.wallet} size={30} />
                      <span style={{ minWidth: 0 }}>
                        <strong style={{ display: 'block', fontSize: 13 }}>{person.displayName || person.username || person.wallet}</strong>
                        {person.username && <span style={{ color: 'var(--accent-color)', fontSize: 11 }}>@{person.username}</span>}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ padding: 16 }}>
          <div
            onClick={() => bannerInputRef.current?.click()}
            style={{
              position: 'relative', height: 150, marginBottom: 18, borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
              background: (bannerUrl || avatarUrl)
                ? `linear-gradient(rgba(0,0,0,0.18), rgba(0,0,0,0.48)), url(${bannerUrl || avatarUrl}) center/cover no-repeat`
                : 'linear-gradient(135deg, rgba(242,183,5,0.3), rgba(94,93,255,0.2), rgba(14,165,233,0.16))',
            }}
          >
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
              {uploadingBanner ? 'Uploading...' : 'Change banner'}
            </div>
          </div>
          <input ref={bannerInputRef} type="file" accept="image/*" onChange={handleBannerSelect} style={{ display: 'none' }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: 12 }}>
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

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-start' }}>
            <button
              onClick={handleSave}
              disabled={status === 'saving' || uploadingAvatar || uploadingBanner}
              style={{
                background: 'var(--accent-color)',
                color: 'var(--bg-color)',
                border: 'none',
                borderRadius: 20,
                padding: '9px 28px',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                opacity: status === 'saving' || uploadingAvatar || uploadingBanner ? 0.6 : 1,
              }}
            >
              {uploadingAvatar || uploadingBanner ? 'Uploading...' : status === 'saving' ? 'Saving...' : 'Save Profile'}
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

      <div style={{ padding: '0 16px' }}>
        <hr style={{ border: 'none', borderTop: '1px solid var(--nav-border)', margin: '24px 0 18px' }} />

        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--nav-border)', marginBottom: 18 }}>
          {[['posts', 'Posts'], ['activity', 'Activity'], ['likes', 'Likes'], ...(isOwnProfile ? [['bookmarks', `Bookmarks ${tabData.bookmarkCount}`]] : [])].map(([value, label]) => (
            <button key={value} onClick={() => setProfileTab(value)} style={{ flex: 1, padding: '9px 4px', background: 'transparent', border: 'none', borderBottom: profileTab === value ? '2px solid var(--accent-color)' : '2px solid transparent', color: profileTab === value ? 'var(--accent-color)' : 'var(--text-muted)', fontSize: 12, fontWeight: 700 }}>{label}</button>
          ))}
        </div>

        {tabLoading ? <LoadingHexagon label="Loading profile content" /> : (
          <div style={{ textAlign: 'left' }}>
            {profileTab === 'activity' ? (
              <div>
                {streakLoading ? <LoadingHexagon label="Loading activity" /> : <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 18 }}><div><strong style={{ color: 'var(--accent-color)', fontSize: 22 }}>{streakData?.currentStreak || 0}</strong><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Current streak</div></div><div><strong style={{ color: 'var(--accent-color)', fontSize: 22 }}>{streakData?.longestStreak || 0}</strong><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Longest streak</div></div></div>}
                {tabData.posts.filter((post) => post.redPacket).map((post) => <ProfilePost key={`red-packet-${post.id}`} post={post} />)}
                {tabData.tips.length === 0 && !tabData.posts.some((post) => post.redPacket) ? <p style={{ color: 'var(--text-muted)' }}>No activity yet.</p> : tabData.tips.map((tip) => {
                  const isReceived = tip.kind === 'received';
                  const counterparty = isReceived ? (tip.from_display_name || tip.from_username || tip.from_wallet || tip.counterparty_wallet) : (tip.to_display_name || tip.to_username || tip.to_wallet || tip.counterparty_wallet);
                  const actionLabel = isReceived ? 'Tip received from' : 'Tip sent to';
                  return (
                    <div key={tip.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--nav-border)' }}>
                      <span>{tip.status === 'pending' ? actionLabel : isReceived ? 'Received from' : 'Sent to'} </span>
                      <strong>{counterparty}</strong>
                      <span style={{ color: 'var(--accent-color)', marginLeft: 8 }}>{tip.amount} NIM</span>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{tip.status === 'pending' ? 'Awaiting blockchain verification' : tip.status}</div>
                      {formatPostDate(tip.created_at) && <time dateTime={tip.created_at} style={{ color: 'var(--text-muted)', fontSize: 11 }}>{formatPostDate(tip.created_at)}</time>}
                    </div>
                  )
                })}
              </div>
            ) : profileTab === 'bookmarks' ? (
              tabData.bookmarks.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No bookmarks yet.</p> : tabData.bookmarks.map((post) => <ProfilePost key={post.id} post={post} />)
            ) : (
              (tabData[profileTab] || []).length === 0 ? <p style={{ color: 'var(--text-muted)' }}>{profileTab === 'likes' ? 'No liked posts yet.' : 'No posts yet.'}</p> : (tabData[profileTab] || []).map((post) => <ProfilePost key={post.id} post={post} />)
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Profile