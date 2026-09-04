import { useState, useEffect } from 'react'
import { getLeaderboard } from '../lib/api'

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

    return () => {
      cancelled = true
    }
  }, [range])

  function renderList(list, emptyLabel) {
    if (list.length === 0) {
      return <p style={{ opacity: 0.6 }}>{emptyLabel}</p>
    }
    return (
      <ol style={{ paddingLeft: 20 }}>
        {list.map((entry, i) => (
          <li key={entry.wallet || i} style={{ marginBottom: 8 }}>
            <strong>{entry.username || entry.wallet}</strong>
            {' — '}
            {entry.total || entry.amount || entry.tipTotal} NIM
          </li>
        ))}
      </ol>
    )
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Leaderboard</h2>

      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setRange('daily')}
          disabled={range === 'daily'}
          style={{ marginRight: 8 }}
        >
          Daily
        </button>
        <button onClick={() => setRange('weekly')} disabled={range === 'weekly'}>
          Weekly
        </button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {loading ? (
        <p>Loading leaderboard...</p>
      ) : (
        <>
          <h3>🏆 Top Tippers</h3>
          {renderList(topTippers, 'No tips yet.')}

          <h3>💰 Top Earners</h3>
          {renderList(topEarners, 'No tips yet.')}
        </>
      )}
    </div>
  )
}

export default Leaderboard