import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('authToken') || null)
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('authUser')
    return saved ? JSON.parse(saved) : null
  })

  useEffect(() => {
    if (token) localStorage.setItem('authToken', token)
    else localStorage.removeItem('authToken')
  }, [token])

  useEffect(() => {
    if (user) localStorage.setItem('authUser', JSON.stringify(user))
    else localStorage.removeItem('authUser')
  }, [user])

  function login({ token, user }) {
    setToken(token)
    setUser(user)
  }

  function logout() {
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isLoggedIn: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

// Auth hook is exported with the provider for the existing import surface.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}