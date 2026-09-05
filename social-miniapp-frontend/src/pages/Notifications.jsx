import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getNotifications, markNotificationsRead } from '../lib/api'

function Notifications() {
  const { token, isLoggedIn } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    if (!isLoggedIn) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await getNotifications(token)
      setNotifications(data.notifications || [])
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [isLoggedIn])

  async function handleMarkAllRead() {
    try {
      await markNotificationsRead(token)
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch (err) {
      console.error(err)
      setError(err.message)
    }
  }

  if (!isLoggedIn) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>
        Connect your wallet to see notifications.
      </div>
    )
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div style={{ padding: 16, maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
      <h2 style={{ margin: '0 0 6px' }}>Notifications</h2>
      {unreadCount > 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
          {unreadCount} unread
        </p>
      )}

      {unreadCount > 0 && (
        <button
          onClick={handleMarkAllRead}
          style={{
            background: 'transparent',
            border: '1px solid var(--nav-border)',
            borderRadius: 16,
            padding: '6px 16px',
            fontSize: 12.5,
            color: 'var(--text-muted)',
            marginBottom: 20,
          }}
        >
          Mark all read
        </button>
      )}

      {error && <p style={{ color: '#e0245e' }}>{error}</p>}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      ) : notifications.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No notifications yet.</p>
      ) : (
        <div style={{ textAlign: 'left', border: '1px solid var(--nav-border)', borderRadius: 14, overflow: 'hidden' }}>
          {notifications.map((n, i) => (
            <div
              key={n.id || i}
              style={{
                padding: '12px 16px',
                borderBottom: i < notifications.length - 1 ? '1px solid var(--nav-border)' : 'none',
                fontWeight: n.read ? 400 : 600,
                fontSize: 14,
              }}
            >
              {n.message || n.text || JSON.stringify(n)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Notifications