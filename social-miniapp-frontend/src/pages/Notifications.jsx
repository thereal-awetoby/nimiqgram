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

  useEffect(() => {
    load()
  }, [isLoggedIn])

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
    return <div style={{ padding: 16 }}>Connect your wallet to see notifications.</div>
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Notifications {unreadCount > 0 && `(${unreadCount})`}</h2>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead}>Mark all read</button>
        )}
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : notifications.length === 0 ? (
        <p style={{ opacity: 0.6 }}>No notifications yet.</p>
      ) : (
        notifications.map((n, i) => (
          <div
            key={n.id || i}
            style={{
              padding: '10px 0',
              borderBottom: '1px solid var(--nav-border)',
              fontWeight: n.read ? 'normal' : 'bold',
            }}
          >
            {n.message || n.text || JSON.stringify(n)}
          </div>
        ))
      )}
    </div>
  )
}

export default Notifications