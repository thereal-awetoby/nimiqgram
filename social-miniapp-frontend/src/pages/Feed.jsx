import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getFeed, createPost, toggleLike, addComment, getPost } from '../lib/api'

function Feed() {
  const { token, isLoggedIn } = useAuth()
  const [posts, setPosts] = useState([])
  const [likedMap, setLikedMap] = useState({}) // { [postId]: true/false } — tracks whether THIS session has liked it
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState(null)
  const [commentState, setCommentState] = useState({})

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

  async function handlePost() {
    if (!text.trim()) return
    setPosting(true)
    setError(null)
    try {
      await createPost(token, text)
      setText('')
      await loadFeed()
    } catch (err) {
      console.error(err)
      setError(err.message)
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
      console.log('POST DETAIL:', post) // TEMP debug
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
            placeholder="What's happening?"
            style={{ width: '100%', minHeight: 60 }}
          />
          <br />
          <button onClick={handlePost} disabled={posting || !text.trim()}>
            {posting ? 'Posting...' : 'Post'}
          </button>
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
              <p>{post.text}</p>

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
                <span style={{ opacity: 0.6 }}>$ {post.tipTotal} tipped</span>
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
    </div>
  )
}

export default Feed