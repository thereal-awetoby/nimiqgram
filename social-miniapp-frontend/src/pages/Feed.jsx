import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getFeed, createPost, toggleLike, addComment, getPost, getProfile, recordPostView, getFollowing } from '../lib/api'
import { uploadMedia, getMediaType } from '../lib/upload'
import TipModal from '../components/TipModal'
import Avatar from '../components/Avatar'
import LoadingHexagon from '../components/LoadingHexagon'

const MAX_VIDEO_SECONDS = 5 * 60
const URL_REGEX = /(https?:\/\/[^\s]+)/g
const MENTION_REGEX = /(@[a-zA-Z0-9_]{1,32})/g

function renderTextWithLinks(text) {
  const parts = text.split(URL_REGEX)
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
    ) : (
      part.split(MENTION_REGEX).map((segment, mentionIndex) =>
        /^@[a-zA-Z0-9_]{1,32}$/.test(segment) ? (
          <span key={`${i}-${mentionIndex}`} style={{ color: 'var(--accent-color)', fontWeight: 700 }}>{segment}</span>
        ) : (
          <span key={`${i}-${mentionIndex}`}>{segment}</span>
        )
      )
    )
  )
}

function HeartIcon({ filled }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
      <path d="M12 21s-7.5-4.6-10-9.3C.5 8 2.2 4.5 6 4a5.6 5.6 0 0 1 6 3 5.6 5.6 0 0 1 6-3c3.8.5 5.5 4 4 7.7C19.5 16.4 12 21 12 21z" />
    </svg>
  )
}

function CommentIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3 1-4.5A8 8 0 1 1 21 12z" />
    </svg>
  )
}

function TipIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.3c0-1.1 1.1-2 2.5-2s2.5.7 2.5 1.8c0 2.5-5 1.7-5 4.2 0 1.1 1.1 1.9 2.5 1.9s2.5-.9 2.5-2" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function ActionButton({ onClick, disabled, active, children, compact = false, color = 'var(--text-muted)' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        background: active ? 'rgba(184, 121, 14, 0.1)' : 'transparent',
        border: 'none', borderRadius: 10, padding: compact ? '5px 0' : '5px 6px',
        color: active ? '#b6780a' : color,
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600,
        minWidth: compact ? 38 : 48,
        flex: 1,
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  )
}

function ShareIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8a3 3 0 1 0-2.8-4H13a3 3 0 0 0 0 6h.2A3 3 0 0 0 16 8Z" />
      <path d="M8 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
      <path d="M18 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M10.5 15.5 15 12.5M10.5 8.5 15 11.5" />
    </svg>
  )
}

function PostMedia({ url, type }) {
  const videoRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [lightbox, setLightbox] = useState(false)

  if (type === 'video') {
    function togglePlay() {
      const el = videoRef.current
      if (!el) return
      if (el.paused) { el.play(); setPlaying(true) } else { el.pause(); setPlaying(false) }
    }
    function goFullscreen(e) {
      e.stopPropagation()
      videoRef.current?.requestFullscreen?.()
    }
    return (
      <div style={{ position: 'relative', margin: '0 auto', maxWidth: '100%', borderRadius: 12, overflow: 'hidden' }} onClick={togglePlay}>
        <video ref={videoRef} src={url} playsInline controls={playing} style={{ display: 'block', width: '100%', maxHeight: 380, borderRadius: 12 }} />
        {!playing && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
            </div>
          </div>
        )}
        <button onClick={goFullscreen} style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3" /></svg>
        </button>
      </div>
    )
  }

  return (
    <>
      <img
        src={url} alt="" onClick={() => setLightbox(true)}
        style={{ display: 'block', margin: '0 auto', maxWidth: '100%', maxHeight: 380, borderRadius: 12, cursor: 'zoom-in' }}
      />
      {lightbox && (
        <div
          onClick={() => setLightbox(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox(false) }}
            style={{ position: 'absolute', top: 16, left: 16, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
          <img src={url} alt="" style={{ maxWidth: '92%', maxHeight: '85%', borderRadius: 8 }} />

          <a href={url} download onClick={(e) => e.stopPropagation()}
            style={{ position: 'absolute', bottom: 24, background: 'var(--accent-color)', color: 'var(--bg-color)', padding: '8px 20px', borderRadius: 20, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13 }}
          >
            Download
          </a>
        </div>
      )}
    </>
  )
}

function Feed() {
  const { token, isLoggedIn, user } = useAuth()
  const [posts, setPosts] = useState([])
  const [likedMap, setLikedMap] = useState({})
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState(null)
  const [commentState, setCommentState] = useState({})
  const [tippingPost, setTippingPost] = useState(null)
  const [followingUsers, setFollowingUsers] = useState([])
  const [feedScope, setFeedScope] = useState('following')

  const [mediaFile, setMediaFile] = useState(null)
  const [mediaPreview, setMediaPreview] = useState(null)
  const [mediaType, setMediaType] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)
  const [myAvatar, setMyAvatar] = useState(null)
  const viewedPostsRef = useRef(new Set())

  async function loadFeed() {
    setLoading(true)
    try {
      const data = await getFeed(undefined, token || undefined, feedScope)
      const nextPosts = data.posts || []
      setPosts(nextPosts)
      setLikedMap(Object.fromEntries(nextPosts.map((post) => [post.id, Boolean(post.likedByMe)])))
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user?.wallet) {
      setFeedScope('all')
      return
    }

    getFollowing(user.wallet)
      .then((data) => setFollowingUsers(data.users || []))
      .catch(() => setFollowingUsers([]))

    if (!token) {
      setFeedScope('all')
      return
    }

    setFeedScope((prev) => (prev === 'following' || prev === 'all' ? prev : 'following'))
  }, [user, token])

  useEffect(() => {
    if (!token && !user) {
      setFeedScope('all')
    }
    loadFeed()
  }, [feedScope, token])

  useEffect(() => {
    if (!isLoggedIn || !posts.length || !token) return

    posts.forEach(async (post) => {
      if (viewedPostsRef.current.has(post.id)) return
      viewedPostsRef.current.add(post.id)
      try {
        const result = await recordPostView(token, post.id)
        setPosts((prev) => prev.map((item) => item.id === post.id ? { ...item, viewCount: result.viewCount } : item))
      } catch (err) {
        console.error('Failed to record post view', err)
      }
    })
  }, [posts, isLoggedIn, token])

  useEffect(() => {
    if (!user?.wallet) return
    getProfile(user.wallet).then((p) => setMyAvatar(p.avatarUrl || null)).catch(() => {})
  }, [user])

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const type = getMediaType(file)
    if (!type) {
      setError('Unsupported file type. Use an image, GIF, or video.')
      return
    }
    if (type === 'video') {
      const videoEl = document.createElement('video')
      videoEl.preload = 'metadata'
      videoEl.onloadedmetadata = () => {
        window.URL.revokeObjectURL(videoEl.src)
        if (videoEl.duration > MAX_VIDEO_SECONDS) {
          setError('Video must be 5 minutes or shorter.')
          return
        }
        setMediaFile(file)
        setMediaType(type)
        setMediaPreview(URL.createObjectURL(file))
        setError(null)
      }
      videoEl.src = URL.createObjectURL(file)
    } else {
      setMediaFile(file)
      setMediaType(type)
      setMediaPreview(URL.createObjectURL(file))
      setError(null)
    }
  }

  function clearMedia() {
    setMediaFile(null)
    setMediaPreview(null)
    setMediaType(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handlePost() {
    if (!text.trim() && !mediaFile) return
    setPosting(true)
    setError(null)
    try {
      let mediaUrl = null
      let finalMediaType = null
      if (mediaFile) {
        setUploading(true)
        const uploaded = await uploadMedia(mediaFile)
        mediaUrl = uploaded.url
        finalMediaType = mediaType
        setUploading(false)
      }
      await createPost(token, { text, mediaUrl, mediaType: finalMediaType })
      setText('')
      clearMedia()
      await loadFeed()
    } catch (err) {
      console.error(err)
      setError(err.message)
      setUploading(false)
    } finally {
      setPosting(false)
    }
  }

  async function handleLike(postId) {
    if (!isLoggedIn) return
    try {
      const result = await toggleLike(token, postId)
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likeCount: result.likeCount, likedByMe: result.liked } : p)))
      setLikedMap((prev) => ({ ...prev, [postId]: result.liked }))
    } catch (err) {
      console.error(err)
    }
  }

  async function toggleComments(postId) {
    const current = commentState[postId]
    if (current?.open) {
      setCommentState((prev) => ({ ...prev, [postId]: { ...current, open: false } }))
      return
    }
    setCommentState((prev) => ({ ...prev, [postId]: { open: true, loading: true, comments: [], draft: '', submitting: false } }))
    try {
      const post = await getPost(postId)
      setCommentState((prev) => ({ ...prev, [postId]: { open: true, loading: false, comments: post.comments || [], draft: '', submitting: false } }))
    } catch (err) {
      console.error(err)
      setCommentState((prev) => ({ ...prev, [postId]: { open: true, loading: false, comments: [], draft: '', submitting: false } }))
    }
  }

  function setDraft(postId, value) {
    setCommentState((prev) => ({ ...prev, [postId]: { ...prev[postId], draft: value } }))
  }

  async function submitComment(postId) {
    const draft = commentState[postId]?.draft?.trim()
    if (!draft) return
    setCommentState((prev) => ({ ...prev, [postId]: { ...prev[postId], submitting: true } }))
    try {
      const newComment = await addComment(token, postId, draft)
      setCommentState((prev) => ({
        ...prev,
        [postId]: { ...prev[postId], comments: [...(prev[postId]?.comments || []), newComment], draft: '', submitting: false },
      }))
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p)))
    } catch (err) {
      console.error(err)
      setCommentState((prev) => ({ ...prev, [postId]: { ...prev[postId], submitting: false } }))
    }
  }

  return (
    <div>
      {isLoggedIn ? (
        <div style={{ padding: '12px 12px 10px', borderBottom: '1px solid var(--nav-border)' }}>
          <div style={{ display: 'flex', gap: 10 }}>
              <Avatar url={myAvatar} fallback={user?.username || user?.wallet} />
            <div style={{ flex: 1 }}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What's happening?"
                style={{ width: '100%', minHeight: 48, border: 'none', padding: 0, background: 'transparent', fontSize: 15, resize: 'vertical' }}
              />
              <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>Use @username to tag someone.</div>

              {mediaPreview && (
                <div style={{ marginTop: 8, position: 'relative', display: 'inline-block' }}>
                  {mediaType === 'video' ? (
                    <video src={mediaPreview} controls style={{ maxWidth: 220, maxHeight: 220, borderRadius: 10 }} />
                  ) : (
                    <img src={mediaPreview} alt="preview" style={{ maxWidth: 220, maxHeight: 220, borderRadius: 10 }} />
                  )}
                  <button onClick={clearMedia} style={{ display: 'block', marginTop: 4, background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 12 }}>
                    Remove
                  </button>
                </div>
              )}

              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileSelect} style={{ display: 'none' }} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--nav-border)',
                    borderRadius: '50%',
                    width: 30,
                    height: 30,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    color: 'var(--accent-color)',
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
                <button
                  onClick={handlePost}
                  disabled={posting || (!text.trim() && !mediaFile)}
                  style={{
                    background: 'var(--accent-color)', color: 'var(--bg-color)', border: 'none',
                    borderRadius: 18, padding: '7px 16px', fontWeight: 600, fontFamily: 'var(--font-display)',
                    opacity: posting || (!text.trim() && !mediaFile) ? 0.5 : 1,
                  }}
                >
                  {uploading ? 'Uploading...' : posting ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p style={{ padding: 16, color: 'var(--text-muted)' }}>Connect your wallet to post.</p>
      )}

      {error && <p style={{ color: '#e0245e', padding: '0 16px' }}>{error}</p>}

      {isLoggedIn && (
        <div style={{ padding: '12px 12px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <strong style={{ fontSize: 13, color: 'var(--text-muted)' }}>Following</strong>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setFeedScope('following')} style={{ background: feedScope === 'following' ? 'var(--accent-color)' : 'transparent', color: feedScope === 'following' ? 'var(--bg-color)' : 'var(--text-color)', border: '1px solid var(--nav-border)', borderRadius: 999, padding: '5px 10px', fontSize: 12, fontWeight: 700 }}>
                Following
              </button>
              <button onClick={() => setFeedScope('all')} style={{ background: feedScope === 'all' ? 'var(--accent-color)' : 'transparent', color: feedScope === 'all' ? 'var(--bg-color)' : 'var(--text-color)', border: '1px solid var(--nav-border)', borderRadius: 999, padding: '5px 10px', fontSize: 12, fontWeight: 700 }}>
                For you
              </button>
            </div>
          </div>

          {followingUsers.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12 }}>Follow people to build your feed.</p>
          ) : (
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
              {followingUsers.map((person) => (
                <div key={person.wallet} style={{ minWidth: 60, textAlign: 'center' }}>
                  <Avatar url={person.avatarUrl} fallback={person.username || person.wallet} size={38} />
                  <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 60 }}>
                    {person.displayName || person.username || person.wallet.slice(0, 8)}
                    {person.username && <span style={{ display: 'block', color: 'var(--accent-color)' }}>@{person.username}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <LoadingHexagon label="Loading feed" />
      ) : posts.length === 0 ? (
        <p style={{ padding: 16, color: 'var(--text-muted)' }}>No posts yet — be the first!</p>
      ) : (
        posts.map((post) => {
          const cState = commentState[post.id]
          const isLiked = likedMap[post.id]
          return (
            <div key={post.id} style={{ padding: '10px 10px 8px', borderBottom: '1px solid var(--nav-border)' }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <Link to={`/profile/${encodeURIComponent(post.author?.wallet || '')}`} aria-label={`Open ${post.author?.displayName || post.author?.username || 'profile'}`} style={{ height: 40 }}>
                  <Avatar url={post.author?.avatarUrl} fallback={post.author?.username || post.author?.wallet} />
                </Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link to={`/profile/${encodeURIComponent(post.author?.wallet || '')}`} style={{ color: 'inherit' }}>
                    <strong style={{ fontSize: 14.5 }}>{post.author?.displayName || post.author?.username || post.author?.wallet}</strong>
                    {post.author?.username && <span style={{ color: 'var(--accent-color)', fontSize: 12, marginLeft: 6 }}>@{post.author.username}</span>}
                  </Link>
                  <p style={{ margin: '4px 0 7px', fontSize: 15, lineHeight: 1.4 }}>
                    {renderTextWithLinks(post.text || '')}
                  </p>

                  {post.mediaUrl && (
                    <div style={{ marginBottom: 10 }}>
                      <PostMedia url={post.mediaUrl} type={post.mediaType} />
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '6px 2px 0',
                      marginTop: 2,
                      borderTop: '1px solid var(--nav-border)',
                      gap: 2,
                    }}
                  >
                    <ActionButton onClick={() => toggleComments(post.id)} active={cState?.open} compact color="var(--comment-accent)">
                      <CommentIcon /> {post.commentCount ?? 0}
                    </ActionButton>
                    <ActionButton onClick={() => setTippingPost(post)} disabled={!isLoggedIn} compact color="var(--tip-accent)">
                      <TipIcon /> {post.tipTotal ?? 0}
                    </ActionButton>
                    <ActionButton onClick={() => handleLike(post.id)} disabled={!isLoggedIn} active={isLiked} compact color="var(--like-accent)">
                      <HeartIcon filled={isLiked} /> {post.likeCount ?? 0}
                    </ActionButton>
                    <ActionButton disabled compact color="var(--view-accent)">
                      <EyeIcon /> {post.viewCount ?? 0}
                    </ActionButton>
                    <ActionButton disabled compact color="var(--share-accent)">
                      <ShareIcon />
                    </ActionButton>
                  </div>

                  {cState?.open && (
                    <div style={{ marginTop: 12, paddingLeft: 12, borderLeft: '2px solid var(--nav-border)' }}>
                      {cState.loading ? (
                        <LoadingHexagon label="Loading comments" />
                      ) : cState.comments.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No comments yet.</p>
                      ) : (
                        cState.comments.map((c, i) => (
                          <div key={c.id || i} style={{ marginBottom: 8, fontSize: 13.5 }}>
                            <strong>{c.author?.username || c.author?.wallet || 'unknown'}</strong>: {c.text}
                          </div>
                        ))
                      )}
                      {isLoggedIn && (
                        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                          <input
                            value={cState.draft || ''}
                            onChange={(e) => setDraft(post.id, e.target.value)}
                            placeholder="Write a comment..."
                            style={{ flex: 1, fontSize: 13 }}
                          />
                          <button
                            onClick={() => submitComment(post.id)}
                            disabled={cState.submitting || !cState.draft?.trim()}
                            style={{ background: 'transparent', border: '1px solid var(--nav-border)', borderRadius: 8, color: 'var(--accent-color)', fontSize: 13 }}
                          >
                            {cState.submitting ? '...' : 'Reply'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })
      )}

      {tippingPost && (
        <TipModal
          post={tippingPost}
          onClose={() => setTippingPost(null)}
          onSuccess={() => { setTippingPost(null); loadFeed() }}
        />
      )}
    </div>
  )
}

export default Feed