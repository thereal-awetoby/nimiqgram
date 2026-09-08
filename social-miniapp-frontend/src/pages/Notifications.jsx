import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getNotifications, markNotificationsRead } from '../lib/api'
import LoadingHexagon from '../components/LoadingHexagon'

function Notifications() {
  const { token, isLoggedIn } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
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

    Promise.resolve().then(load)
  }, [isLoggedIn, token])

  async function handleMarkAllRead() {
    try {
      await markNotificationsRead(token)
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })))
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

  const unreadCount = notifications.filter((n) => !n.readAt).length

  function notificationText(notification) {
    const actor = notification.actorUsername || 'Someone'
    if (notification.type === 'like') return `${actor} liked your post.`
    if (notification.type === 'comment') return `${actor} commented on your post.`
    if (notification.type === 'tip') return `${actor} sent you a tip.`
    return `${actor} interacted with your post.`
  }

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
        <LoadingHexagon label="Loading notifications" />
      ) : notifications.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No notifications yet.</p>
      ) : (
        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notifications.map((n, i) => (
            <Link
              key={n.id || i}
              to={n.postId ? `/post/${n.postId}` : '#'}
              style={{
                padding: '12px 16px',
                border: '1px solid var(--nav-border)',
                borderRadius: 12,
                background: n.readAt ? 'transparent' : 'rgba(242, 169, 59, 0.08)',
                fontWeight: n.readAt ? 400 : 600,
                fontSize: 14,
                color: 'var(--text-color)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: n.readAt ? 'var(--nav-border)' : 'var(--accent-color)', flexShrink: 0 }} />
              <span>{notificationText(n)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default Notifications