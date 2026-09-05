import { useState, useEffect } from 'react'
import { getLeaderboard } from '../lib/api'

function LeaderboardTable({ title, list, emptyLabel }) {
  return (
    <div
      style={{
        flex: '1 1 260px',
        minWidth: 240,
        border: '1px solid var(--nav-border)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--nav-border)' }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>{title}</h3>
      </div>

      {list.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 14, padding: 16, margin: 0 }}>
          {emptyLabel}
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={headStyle('left')}>Rank</th>
              <th style={headStyle('left')}>User</th>
              <th style={headStyle('right')}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {list.map((entry, i) => (
              <tr key={entry.wallet || i}>
                <td style={cellStyle('left')}>{i + 1}</td>
                <td style={{ ...cellStyle('left'), maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.username || entry.wallet}
                </td>
                <td style={{ ...cellStyle('right'), color: 'var(--accent-color)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                  {entry.total ?? entry.amount ?? entry.tipTotal} NIM
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function headStyle(align) {
  return {
    textAlign: align,
    fontSize: 12,
    fontFamily: 'var(--font-display)',
    fontWeight: 600,
    color: 'var(--text-muted)',
    padding: '8px 16px',
    borderBottom: '1px solid var(--nav-border)',
  }
}

function cellStyle(align) {
  return {
    textAlign: align,
    fontSize: 14,
    padding: '10px 16px',
    borderBottom: '1px solid var(--nav-border)',
  }
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
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap', textAlign: 'left' }}>
          <LeaderboardTable title="Top Tippers" list={topTippers} emptyLabel="No tips yet." />
          <LeaderboardTable title="Top Earners" list={topEarners} emptyLabel="No tips yet." />
        </div>
      )}
    </div>
  )
}

export default Leaderboard