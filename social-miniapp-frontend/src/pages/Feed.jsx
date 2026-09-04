import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { getFeed, createPost, toggleLike, addComment, getPost } from '../lib/api'
import { uploadMedia, getMediaType } from '../lib/upload'
import TipModal from '../components/TipModal'

const MAX_VIDEO_SECONDS = 5 * 60 // 5 minutes
const URL_REGEX = /(https?:\/\/[^\s]+)/g

// Turns plain text into text + clickable links, splitting on URLs
function renderTextWithLinks(text) {
  const parts = text.split(URL_REGEX)
  return parts.map((part, i) =>
    URL_REGEX.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

function Feed() {
  const { token, isLoggedIn } = useAuth()
  const [posts, setPosts] = useState([])
  const [likedMap, setLikedMap] = useState({})
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState(null)
  const [commentState, setCommentState] = useState({})
  const [tippingPost, setTippingPost] = useState(null)

  // Media attach state
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

  useEffect(() => {
    loadFeed()
  }, [])

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const type = getMediaType(file)
    if (!type) {
      setError('Unsupported file type. Use an image, GIF, or video.')
      return
    }

    if (type === 'video') {
      // Check duration client-side before uploading
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
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, likeCount: result.likeCount } : p))
      )
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

    setCommentState((prev) => ({
      ...prev,
      [postId]: { open: true, loading: true, comments: [], draft: '', submitting: false },
    }))

    try {
      const post = await getPost(postId)
      setCommentState((prev) => ({
        ...prev,
        [postId]: { open: true, loading: false, comments: post.comments || [], draft: '', submitting: false },
      }))
    } catch (err) {
      console.error(err)
      setCommentState((prev) => ({
        ...prev,
        [postId]: { open: true, loading: false, comments: [], draft: '', submitting: false },
      }))
    }
  }

  function setDraft(postId, value) {
    setCommentState((prev) => ({
      ...prev,
      [postId]: { ...prev[postId], draft: value },
    }))
  }

  async function submitComment(postId) {
    const draft = commentState[postId]?.draft?.trim()
    if (!draft) return

    setCommentState((prev) => ({
      ...prev,
      [postId]: { ...prev[postId], submitting: true },
    }))

    try {
      const newComment = await addComment(token, postId, draft)
      setCommentState((prev) => ({
        ...prev,
        [postId]: {
          ...prev[postId],
          comments: [...(prev[postId]?.comments || []), newComment],
          draft: '',
          submitting: false,
        },
      }))
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p))
      )
    } catch (err) {
      console.error(err)
      setCommentState((prev) => ({
        ...prev,
        [postId]: { ...prev[postId], submitting: false },
      }))
    }
  }

  return (
    <div style={{ padding: 16 }}>
      {isLoggedIn ? (
        <div style={{ marginBottom: 24 }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's happening? (emoji work fine — just type or use your device's emoji keyboard)"
            style={{ width: '100%', minHeight: 60 }}
          />

          {mediaPreview && (
            <div style={{ marginTop: 8, position: 'relative', display: 'inline-block' }}>
              {mediaType === 'video' ? (
                <video src={mediaPreview} controls style={{ maxWidth: 240, maxHeight: 240 }} />
              ) : (
                <img src={mediaPreview} alt="preview" style={{ maxWidth: 240, maxHeight: 240 }} />
              )}
              <button onClick={clearMedia} style={{ display: 'block', marginTop: 4 }}>
                Remove
              </button>
            </div>
          )}

          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="media-input"
            />
            <button onClick={() => fileInputRef.current?.click()} type="button">
              📎 Attach image/gif/video
            </button>
            <button
              onClick={handlePost}
              disabled={posting || (!text.trim() && !mediaFile)}
            >
              {uploading ? 'Uploading media...' : posting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>
      ) : (
        <p>Connect your wallet to post.</p>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {loading ? (
        <p>Loading feed...</p>
      ) : posts.length === 0 ? (
        <p>No posts yet — be the first!</p>
      ) : (
        posts.map((post) => {
          const cState = commentState[post.id]
          const isLiked = likedMap[post.id]
          return (
            <div key={post.id} style={{ borderBottom: '1px solid var(--nav-border)', padding: '12px 0' }}>
              <strong>{post.author?.username || post.author?.wallet}</strong>
              <p>{renderTextWithLinks(post.text || '')}</p>

              {post.mediaUrl && (
                <div style={{ marginBottom: 8 }}>
                  {post.mediaType === 'video' ? (
                    <video src={post.mediaUrl} controls style={{ maxWidth: '100%', maxHeight: 400 }} />
                  ) : (
                    <img src={post.mediaUrl} alt="" style={{ maxWidth: '100%', maxHeight: 400 }} />
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <button
                  onClick={() => handleLike(post.id)}
                  disabled={!isLoggedIn}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--nav-border)',
                    borderRadius: 6,
                    padding: '4px 10px',
                    color: isLiked ? '#e0245e' : 'var(--text-color)',
                    cursor: isLoggedIn ? 'pointer' : 'default',
                  }}
                >
                  {isLiked ? '♥' : '♡'} {post.likeCount}
                </button>
                <button onClick={() => toggleComments(post.id)}>
                  💬 {post.commentCount} {cState?.open ? '(hide)' : ''}
                </button>
                <button onClick={() => setTippingPost(post)} disabled={!isLoggedIn}>
                  $ Tip ({post.tipTotal})
                </button>
              </div>

              {cState?.open && (
                <div style={{ marginTop: 12, paddingLeft: 12, borderLeft: '2px solid var(--nav-border)' }}>
                  {cState.loading ? (
                    <p>Loading comments...</p>
                  ) : cState.comments.length === 0 ? (
                    <p style={{ opacity: 0.6 }}>No comments yet.</p>
                  ) : (
                    cState.comments.map((c, i) => (
                      <div key={c.id || i} style={{ marginBottom: 8 }}>
                        <strong>{c.author?.username || c.author?.wallet || 'unknown'}</strong>: {c.text}
                      </div>
                    ))
                  )}

                  {isLoggedIn && (
                    <div style={{ marginTop: 8 }}>
                      <input
                        value={cState.draft || ''}
                        onChange={(e) => setDraft(post.id, e.target.value)}
                        placeholder="Write a comment..."
                      />
                      <button
                        onClick={() => submitComment(post.id)}
                        disabled={cState.submitting || !cState.draft?.trim()}
                      >
                        {cState.submitting ? 'Sending...' : 'Reply'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })
      )}

      {tippingPost && (
        <TipModal
          post={tippingPost}
          onClose={() => setTippingPost(null)}
          onSuccess={() => {
            setTippingPost(null)
            loadFeed()
          }}
        />
      )}
    </div>
  )
}

export default Feed