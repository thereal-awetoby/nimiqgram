import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { getFeed, createPost, toggleLike, addComment, getPost } from '../lib/api'
import { uploadMedia, getMediaType } from '../lib/upload'
import TipModal from '../components/TipModal'
import Avatar from '../components/Avatar'

const MAX_VIDEO_SECONDS = 5 * 60
const URL_REGEX = /(https?:\/\/[^\s]+)/g

function renderTextWithLinks(text) {
  const parts = text.split(URL_REGEX)
  return parts.map((part, i) =>
    URL_REGEX.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

function HeartIcon({ filled }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
      <path d="M12 21s-7.5-4.6-10-9.3C.5 8 2.2 4.5 6 4a5.6 5.6 0 0 1 6 3 5.6 5.6 0 0 1 6-3c3.8.5 5.5 4 4 7.7C19.5 16.4 12 21 12 21z" />
    </svg>
  )
}

function CommentIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3 1-4.5A8 8 0 1 1 21 12z" />
    </svg>
  )
}

function TipIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.3c0-1.1 1.1-2 2.5-2s2.5.7 2.5 1.8c0 2.5-5 1.7-5 4.2 0 1.1 1.1 1.9 2.5 1.9s2.5-.9 2.5-2" />
    </svg>
  )
}

function ActionButton({ onClick, disabled, active, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'transparent', border: 'none', padding: '4px 8px',
        color: active ? 'var(--accent-color)' : 'var(--text-muted)',
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'var(--font-body)', fontSize: 13,
      }}
    >
      {children}
    </button>
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

  const [mediaFile, setMediaFile] = useState(null)
  const [mediaPreview, setMediaPreview] = useState(null)
  const [mediaType, setMediaType] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  async function loadFeed() {
    setLoading(true)
    try {
      const data = await getFeed()
      setPosts(data.posts || [])
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadFeed() }, [])

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
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likeCount: result.likeCount } : p)))
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
        <div style={{ padding: 16, borderBottom: '1px solid var(--nav-border)' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <Avatar url={user?.avatarUrl} fallback={user?.username || user?.wallet} />
            <div style={{ flex: 1 }}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What's happening?"
                style={{ width: '100%', minHeight: 50, border: 'none', padding: 0, background: 'transparent', fontSize: 15, resize: 'vertical' }}
              />

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

              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileSelect} style={{ display: 'none' }} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--nav-border)',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    color: 'var(--accent-color)',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
                <button
                  onClick={handlePost}
                  disabled={posting || (!text.trim() && !mediaFile)}
                  style={{
                    background: 'var(--accent-color)', color: 'var(--bg-color)', border: 'none',
                    borderRadius: 20, padding: '8px 20px', fontWeight: 600, fontFamily: 'var(--font-display)',
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

      {loading ? (
        <p style={{ padding: 16, color: 'var(--text-muted)' }}>Loading feed...</p>
      ) : posts.length === 0 ? (
        <p style={{ padding: 16, color: 'var(--text-muted)' }}>No posts yet — be the first!</p>
      ) : (
        posts.map((post) => {
          const cState = commentState[post.id]
          const isLiked = likedMap[post.id]
          return (
            <div key={post.id} style={{ padding: '16px', borderBottom: '1px solid var(--nav-border)' }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <Avatar url={post.author?.avatarUrl} fallback={post.author?.username || post.author?.wallet} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: 14.5 }}>{post.author?.username || post.author?.wallet}</strong>
                  <p style={{ margin: '4px 0 10px', fontSize: 15, lineHeight: 1.45 }}>
                    {renderTextWithLinks(post.text || '')}
                  </p>

                  {post.mediaUrl && (
                    <div style={{ marginBottom: 10 }}>
                      {post.mediaType === 'video' ? (
                        <video src={post.mediaUrl} controls style={{ maxWidth: '100%', maxHeight: 380, borderRadius: 12 }} />
                      ) : (
                        <img src={post.mediaUrl} alt="" style={{ maxWidth: '100%', maxHeight: 380, borderRadius: 12 }} />
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 24 }}>
                    <ActionButton onClick={() => handleLike(post.id)} disabled={!isLoggedIn} active={isLiked}>
                      <HeartIcon filled={isLiked} /> {post.likeCount}
                    </ActionButton>
                    <ActionButton onClick={() => toggleComments(post.id)} active={cState?.open}>
                      <CommentIcon /> {post.commentCount}
                    </ActionButton>
                    <ActionButton onClick={() => setTippingPost(post)} disabled={!isLoggedIn}>
                      <TipIcon /> {post.tipTotal}
                    </ActionButton>
                  </div>

                  {cState?.open && (
                    <div style={{ marginTop: 12, paddingLeft: 12, borderLeft: '2px solid var(--nav-border)' }}>
                      {cState.loading ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading comments...</p>
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