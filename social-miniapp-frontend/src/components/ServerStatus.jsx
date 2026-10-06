import { useEffect, useState } from 'react'
import { getServerHealth } from '../lib/api'

function ServerStatus() {
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    let active = true

    async function checkServer() {
      try {
        const result = await getServerHealth()
        if (result?.status !== 'ok') throw new Error('Unexpected server health response')
        if (active) setStatus('online')
      } catch (error) {
        console.error('Nimiqgram server health check failed:', error)
        if (active) setStatus('offline')
      }
    }

    void checkServer()
    const interval = window.setInterval(checkServer, 60_000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  const label = {
    checking: 'Checking server',
    online: 'Server online',
    offline: 'Server unavailable',
  }[status]

  return (
    <span className={`server-status server-status--${status}`} role="status" aria-live="polite">
      <span className="server-status__dot" aria-hidden="true" />
      {label}
    </span>
  )
}

export default ServerStatus
