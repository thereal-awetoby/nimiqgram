import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getFeed, createPost } from '../lib/api'

function Feed() {
  const { token, isLoggedIn } = useAuth()
  const [posts, setPosts] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState(null)

  async function loadFeed() {
    setLoading(true)
    try {
      const data = await getFeed()
      console.log('FEED DATA:', data)
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
        posts.map((post) => (
          <div key={post.id} style={{ borderBottom: '1px solid var(--nav-border)', padding: '12px 0' }}>
            <strong>{post.username || post.wallet}</strong>
            <p>{post.text}</p>
          </div>
        ))
      )}
    </div>
  )
}

export default Feed