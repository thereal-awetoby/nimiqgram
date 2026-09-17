import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import Feed from './pages/Feed'
import Profile from './pages/Profile'
import Leaderboard from './pages/Leaderboard'
import Notifications from './pages/Notifications'
import Search from './pages/Search'
import Post from './pages/Post'
import WalletConnect from './components/WalletConnect'
import BouncingHexagon, { HexIcon } from './BouncingHexagon'

const NAV_ITEMS = [
  { to: '/', label: 'Feed', icon: 'home' },
  { to: '/search', label: 'Search', icon: 'search' },
  { to: '/leaderboard', label: 'Leaderboard', icon: 'chart' },
  { to: '/notifications', label: 'Notifications', icon: 'bell' },
  { to: '/profile', label: 'Profile', icon: 'user' },
]

function NavIcon({ type, active }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: active ? 'var(--accent-color)' : 'currentColor',
    strokeWidth: 2,
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
    case 'search':
      return (
        <svg {...common}>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 5 5" />
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
      className="glass-surface"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 0,
        transform: 'translateX(-50%)',
        width: 'min(100%, 560px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '10px 14px 12px',
        borderTop: '1px solid var(--nav-border)',
        zIndex: 50,
      }}
    >
      {NAV_ITEMS.map((item) => {
        const active = location.pathname === item.to
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-label={item.label}
            className="tap-scale"
            style={{
              width: 42,
              height: 42,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              color: active ? 'var(--accent-color)' : 'var(--text-muted)',
              transition: 'color 0.18s ease',
            }}
          >
            <NavIcon type={item.icon} active={active} />
            <span
              style={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: active ? 'var(--accent-color)' : 'transparent',
              }}
            />
          </Link>
        )
      })}
    </nav>
  )
}

function HexWatermark() {
  return (
    <svg viewBox="0 0 400 350" className="hex-watermark" aria-hidden="true">
      <polygon
        points="100,10 300,10 390,175 300,340 100,340 10,175"
        fill="var(--accent-color)"
      />
    </svg>
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
    const timer = window.setTimeout(() => setIsBooting(false), 4000)
    return () => window.clearTimeout(timer)
  }, [])

  function toggleTheme() {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  if (isBooting) {
    return (
      <div className="boot-screen">
        <BouncingHexagon theme={theme} />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <div
        style={{
          maxWidth: 560,
          margin: '0 auto',
          minHeight: '100vh',
          borderLeft: '1px solid var(--nav-border)',
          borderRight: '1px solid var(--nav-border)',
          position: 'relative',
        }}
      >
        <HexWatermark />

        <div
          className="glass-surface"
          style={{
            position: 'sticky',
            top: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 16px',
            borderBottom: '1px solid var(--nav-border)',
            zIndex: 40,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              aria-label="Nimiqgram logo"
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--nav-border)',
                background: '#fff',
                overflow: 'hidden',
              }}
            >
              <HexIcon size={28} />
            </div>
            <button
              onClick={toggleTheme}
              className="tap-scale"
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
          <WalletConnect />
        </div>

        <div style={{ paddingBottom: 90, position: 'relative', zIndex: 1 }}>
          <Routes>
            <Route path="/" element={<Feed />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:wallet" element={<Profile />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/search" element={<Search />} />
            <Route path="/post/:postId" element={<Post />} />
          </Routes>
        </div>

        <BottomNav />
      </div>
    </BrowserRouter>
  )
}

export default App