import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import Feed from './pages/Feed'
import Profile from './pages/Profile'
import Leaderboard from './pages/Leaderboard'
import Notifications from './pages/Notifications'
import WalletConnect from './components/WalletConnect'
import NimiqWatermark from './components/NimiqWatermark'

const NAV_ITEMS = [
  { to: '/', label: 'Feed' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/notifications', label: 'Notifications' },
  { to: '/profile', label: 'Profile' },
]

function BottomNav() {
  const location = useLocation()

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)',
        maxWidth: 528,
        display: 'flex',
        border: '1px solid var(--nav-border)',
        borderRadius: 20,
        padding: 4,
        background: 'var(--bg-elevated)',
      }}
    >
      {NAV_ITEMS.map((item) => {
        const active = location.pathname === item.to
        return (
          <Link
            key={item.to}
            to={item.to}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '8px 4px',
              borderRadius: 16,
              fontSize: 12.5,
              fontWeight: 600,
              background: active ? 'var(--accent-color)' : 'transparent',
              color: active ? 'var(--bg-color)' : 'var(--text-muted)',
            }}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  return (
    <BrowserRouter>
      <NimiqWatermark />

      <div
        style={{
          maxWidth: 560,
          margin: '0 auto',
          minHeight: '100vh',
          borderLeft: '1px solid var(--nav-border)',
          borderRight: '1px solid var(--nav-border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 16px',
            borderBottom: '1px solid var(--nav-border)',
          }}
        >
          <WalletConnect />
          <button
            onClick={toggleTheme}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--nav-border)',
              borderRadius: '50%',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
              padding: 0,
              lineHeight: 1,
            }}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>

        <div style={{ paddingBottom: 90 }}>
          <Routes>
            <Route path="/" element={<Feed />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/notifications" element={<Notifications />} />
          </Routes>
        </div>

        <BottomNav />
      </div>
    </BrowserRouter>
  )
}

export default App