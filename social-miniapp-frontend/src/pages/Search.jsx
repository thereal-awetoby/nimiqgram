import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { searchApp } from '../lib/api'
import Avatar from '../components/Avatar'
import LoadingHexagon from '../components/LoadingHexagon'

function Search() {
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState('people')
  const [results, setResults] = useState({ people: [], posts: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const term = query.trim()
    if (!term) {
      Promise.resolve().then(() => {
        setResults({ people: [], posts: [] })
        setLoading(false)
      })
      return undefined
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await searchApp(term)
        if (!cancelled) setResults(data)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  const people = results.people || []
  const posts = results.posts || []

  return (
    <div style={{ padding: 16, maxWidth: 560, margin: '0 auto' }}>
      <div style={{ position: 'relative' }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ position: 'absolute', left: 12, top: 12 }}>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 5 5" />
        </svg>
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search people or topics"
          aria-label="Search people or topics"
          style={{ width: '100%', height: 42, paddingLeft: 38, borderRadius: 21 }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, margin: '18px 0 12px' }}>
        {[
          ['people', 'People'],
          ['posts', 'Topics'],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setActiveTab(value)}
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: 10,
              border: '1px solid var(--nav-border)',
              background: activeTab === value ? 'var(--accent-color)' : 'transparent',
              color: activeTab === value ? 'var(--bg-color)' : 'var(--text-color)',
              fontWeight: 700,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p style={{ color: '#e0245e' }}>{error}</p>}
      {loading ? (
        <LoadingHexagon label="Searching" />
      ) : !query.trim() ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>Search for a person or topic.</p>
      ) : activeTab === 'people' ? (
        people.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No people found.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {people.map((person) => (
              <Link key={person.wallet} to={`/profile/${encodeURIComponent(person.wallet)}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: '1px solid var(--nav-border)', borderRadius: 12, color: 'inherit' }}>
                <Avatar url={person.avatarUrl} fallback={person.username || person.wallet} size={42} />
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block' }}>{person.displayName || person.username || person.wallet}</strong>
                  {person.username && <span style={{ color: 'var(--accent-color)', fontSize: 12 }}>@{person.username}</span>}
                  {person.bio && <div style={{ color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.bio}</div>}
                </div>
              </Link>
            ))}
          </div>
        )
      ) : posts.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No topics found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {posts.map((post) => (
            <div key={post.id} style={{ padding: 12, border: '1px solid var(--nav-border)', borderRadius: 12 }}>
              <Link to={`/profile/${encodeURIComponent(post.author.wallet)}`} style={{ color: 'var(--accent-color)', fontSize: 12, fontWeight: 700 }}>
                {post.author.displayName || post.author.username || post.author.wallet}
              </Link>
              <p style={{ margin: '7px 0 0', lineHeight: 1.4 }}>{post.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Search
