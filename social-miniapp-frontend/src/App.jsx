import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import Feed from './pages/Feed'
import Profile from './pages/Profile'
import Leaderboard from './pages/Leaderboard'
import Notifications from './pages/Notifications'
import WalletConnect from './components/WalletConnect'
import NimiqWatermark from './components/NimiqWatermark'

const NAV_ITEMS = [
  { to: '/', label: 'Feed', icon: 'home' },
  { to: '/leaderboard', label: 'Leaderboard', icon: 'chart' },
  { to: '/notifications', label: 'Notifications', icon: 'bell' },
  { to: '/profile', label: 'Profile', icon: 'user' },
]

function NavIcon({ type, active }) {
  const common = {
    width: 15,
    height: 15,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: active ? 'var(--bg-color)' : 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }

  switch (type) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V20h14V9.5" />
        </svg>
      )
    case 'chart':
      return (
        <svg {...common}>
          <path d="M4 18h16" />
          <path d="M7 15V9" />
          <path d="M12 15V5" />
          <path d="M17 15v-7" />
        </svg>
      )
    case 'bell':
      return (
        <svg {...common}>
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h11" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
      )
    case 'user':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 19c1.5-3 5-4.5 8-4.5s6.5 1.5 8 4.5" />
        </svg>
      )
    default:
      return null
  }
}

function BottomNav() {
  const location = useLocation()

  return (
    <nav
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 0,
        transform: 'translateX(-50%)',
        width: 'min(100%, 560px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 0,
        padding: '10px 8px 12px',
        borderTop: '1px solid var(--nav-border)',
        background: 'var(--bg-elevated)',
        zIndex: 50,
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
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              minHeight: 42,
              padding: '8px 10px',
              borderRadius: 10,
              background: active ? 'rgba(184, 121, 14, 0.12)' : 'transparent',
              color: active ? 'var(--accent-color)' : 'var(--text-muted)',
              transition: 'all 0.18s ease',
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            <NavIcon type={item.icon} active={active} />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [isBooting, setIsBooting] = useState(true)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    const timer = window.setTimeout(() => setIsBooting(false), 1200)
    return () => window.clearTimeout(timer)
  }, [])

  function toggleTheme() {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  if (isBooting) {
    return (
      <div className="boot-screen">
        <div className="boot-loader" aria-label="Loading app">
          <div className="polygon-shape" />
        </div>
      </div>
    )
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