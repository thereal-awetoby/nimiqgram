import { useState, useEffect } from 'react'
import { getLeaderboard } from '../lib/api'

function RankedList({ list, emptyLabel }) {
  if (list.length === 0) {
    return <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{emptyLabel}</p>
  }
  return (
    <div>
      {list.map((entry, i) => (
        <div
          key={entry.wallet || i}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '10px 0',
            borderBottom: i < list.length - 1 ? '1px solid var(--nav-border)' : 'none',
          }}
        >
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-muted)', fontSize: 13 }}>
            {i + 1}
          </span>
          <span style={{ fontSize: 14, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.username || entry.wallet}
          </span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13.5, color: 'var(--accent-color)' }}>
            {entry.total ?? entry.amount ?? entry.tipTotal} NIM
          </span>
        </div>
      ))}
    </div>
  )
}

function Leaderboard() {
  const [range, setRange] = useState('daily')
  const [topTippers, setTopTippers] = useState([])
  const [topEarners, setTopEarners] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    getLeaderboard(range)
      .then((data) => {
        if (cancelled) return
        setTopTippers(data.topTippers || [])
        setTopEarners(data.topEarners || [])
      })
      .catch((err) => {
        if (cancelled) return
        console.error(err)
        setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [range])

  return (
    <div style={{ padding: 16, textAlign: 'center' }}>
      <h2 style={{ margin: '0 0 16px' }}>Leaderboard</h2>

      <div
        style={{
          display: 'inline-flex',
          border: '1px solid var(--nav-border)',
          borderRadius: 20,
          padding: 3,
          marginBottom: 32,
        }}
      >
        {['daily', 'weekly'].map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            style={{
              background: range === r ? 'var(--accent-color)' : 'transparent',
              color: range === r ? 'var(--bg-color)' : 'var(--text-muted)',
              border: 'none',
              borderRadius: 18,
              padding: '6px 18px',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 13,
              textTransform: 'capitalize',
            }}
          >
            {r}
          </button>
        ))}
      </div>

      {error && <p style={{ color: '#e0245e' }}>{error}</p>}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading leaderboard...</p>
      ) : (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 48,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 220, maxWidth: 260 }}>