import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import Feed from './pages/Feed'
import Profile from './pages/Profile'
import Leaderboard from './pages/Leaderboard'
import Notifications from './pages/Notifications'
import WalletConnect from './components/WalletConnect'
import NimiqWatermark from './components/NimiqWatermark'

function NavLink({ to, label }) {
  const location = useLocation()
  const active = location.pathname === to
  return (
    <Link
      to={to}
      style={{
        color: active ? 'var(--accent-color)' : 'var(--text-muted)',
        fontWeight: active ? 600 : 500,
        fontSize: 13,
      }}
    >
      {label}
    </Link>
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
              background: 'transparent',
              border: '1px solid var(--nav-border)',
              borderRadius: 20,
              padding: '6px 14px',
              color: 'var(--text-color)',
            }}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>

        <div style={{ paddingBottom: 70 }}>
          <Routes>
            <Route path="/" element={<Feed />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/notifications" element={<Notifications />} />
          </Routes>
        </div>

        <nav
          style={{
            position: 'fixed',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: 560,
            display: 'flex',
            justifyContent: 'space-around',
            padding: '14px 0',
            borderTop: '1px solid var(--nav-border)',
            backgroundColor: 'var(--bg-color)',
          }}
        >
          <NavLink to="/" label="Feed" />
          <NavLink to="/leaderboard" label="Leaderboard" />
          <NavLink to="/notifications" label="Notifications" />
          <NavLink to="/profile" label="Profile" />
        </nav>
      </div>
    </BrowserRouter>
  )
}

export default App