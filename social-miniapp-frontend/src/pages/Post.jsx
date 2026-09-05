import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { addComment, getPost, getBookmarkStatus, bookmarkPost, removeBookmark } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'
import LoadingHexagon from '../components/LoadingHexagon'

function Post() {
  const { postId } = useParams()
  const { token, isLoggedIn } = useAuth()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getPost(postId)
      .then((data) => {
        if (!cancelled) setPost(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    getBookmarkStatus(postId, token).then((data) => setBookmarked(Boolean(data.bookmarked))).catch(() => {})
    return () => { cancelled = true }
  }, [postId, token])

  async function toggleBookmark() {
    if (!isLoggedIn) return
    try {
      if (bookmarked) await removeBookmark(postId, token)
      else await bookmarkPost(postId, token)
      setBookmarked((value) => !value)
    } catch (err) {
      setError(err.message)
    }
  }

  async function submitComment(event) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || !isLoggedIn) return
    setSubmitting(true)
    setError(null)
    try {
      const comment = await addComment(token, postId, text)
      setPost((current) => ({ ...current, comments: [...(current.comments || []), comment], commentCount: (current.commentCount || 0) + 1 }))
      setDraft('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingHexagon label="Loading post" />
  if (error) return <p style={{ padding: 16, color: '#e0245e' }}>{error}</p>
  if (!post) return <p style={{ padding: 16, color: 'var(--text-muted)' }}>Post not found.</p>

  return (
    <div style={{ padding: 16, maxWidth: 560, margin: '0 auto' }}>
      <Link to="/" style={{ color: 'var(--accent-color)', fontSize: 13, fontWeight: 700 }}>Back to feed</Link>

      <article style={{ marginTop: 18, paddingBottom: 20, borderBottom: '1px solid var(--nav-border)' }}>
        <Link to={`/profile/${encodeURIComponent(post.author?.wallet || '')}`} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'inherit' }}>
          <Avatar url={post.author?.avatarUrl} fallback={post.author?.username || post.author?.wallet} />
          <div>
            <strong>{post.author?.displayName || post.author?.username || post.author?.wallet}</strong>
            {post.author?.username && <div style={{ color: 'var(--accent-color)', fontSize: 12 }}>@{post.author.username}</div>}
          </div>
        </Link>

        <p style={{ margin: '18px 0 12px', fontSize: 17, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{post.text}</p>
        {post.mediaUrl && post.mediaType === 'video' && <video src={post.mediaUrl} controls style={{ width: '100%', maxHeight: 480, borderRadius: 12 }} />}
        {post.mediaUrl && post.mediaType !== 'video' && <img src={post.mediaUrl} alt="" style={{ display: 'block', width: '100%', maxHeight: 480, objectFit: 'contain', borderRadius: 12 }} />}

        <div style={{ display: 'flex', gap: 18, marginTop: 14, color: 'var(--text-muted)', fontSize: 13 }}>
          <span>{post.likeCount ?? 0} likes</span>
          <span>{post.commentCount ?? 0} comments</span>
          <span>{post.viewCount ?? 0} views</span>
          {isLoggedIn && <button onClick={toggleBookmark} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: bookmarked ? 'var(--accent-color)' : 'var(--text-muted)', fontWeight: 700 }}>{bookmarked ? 'Bookmarked' : 'Bookmark'}</button>}
        </div>
      </article>

      <section style={{ paddingTop: 18 }}>
        <h2 style={{ fontSize: 18, margin: '0 0 14px' }}>Comments</h2>
        {isLoggedIn ? (
          <form onSubmit={submitComment} style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a comment..." style={{ flex: 1 }} />
            <button type="submit" disabled={submitting || !draft.trim()} style={{ background: 'var(--accent-color)', color: 'var(--bg-color)', border: 'none', borderRadius: 8, padding: '0 14px', fontWeight: 700 }}>{submitting ? '...' : 'Reply'}</button>
          </form>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Connect your wallet to comment.</p>
        )}
        {error && <p style={{ color: '#e0245e', fontSize: 13 }}>{error}</p>}
        {(post.comments || []).length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No comments yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {post.comments.map((comment, index) => (
              <div key={comment.id || index} style={{ paddingBottom: 12, borderBottom: '1px solid var(--nav-border)' }}>
                <strong style={{ fontSize: 13 }}>{comment.author?.username || comment.authorWallet || 'User'}</strong>
                <div style={{ marginTop: 4, lineHeight: 1.4 }}>{comment.text}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default Post
