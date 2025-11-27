import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { authAPI } from '@/lib/api'

const REFRESH_THRESHOLD_MS = 10 * 60 * 1000 // 10 phút

const decodeToken = (token) => {
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decoded)
  } catch (error) {
    console.error('❌ Failed to decode token:', error)
    return null
  }
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const refreshTimeoutRef = useRef(null)
  const refreshTokenRef = useRef(null)

  const clearRefreshTimer = () => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
      refreshTimeoutRef.current = null
    }
  }

  const scheduleTokenRefresh = useCallback((token) => {
    clearRefreshTimer()
    if (!token) return

    const decoded = decodeToken(token)
    if (!decoded?.exp) return

    const expiresAt = decoded.exp * 1000
    const timeUntilRefresh = expiresAt - Date.now() - REFRESH_THRESHOLD_MS

    const triggerRefresh = () => {
      if (refreshTokenRef.current) {
        refreshTokenRef.current()
      }
    }

    if (timeUntilRefresh <= 0) {
      triggerRefresh()
    } else {
      refreshTimeoutRef.current = setTimeout(triggerRefresh, timeUntilRefresh)
    }
  }, [])

  const refreshToken = useCallback(async () => {
    try {
      const response = await authAPI.refresh()
      if (response?.token) {
        localStorage.setItem('token', response.token)
        if (response.user) {
          localStorage.setItem('user', JSON.stringify(response.user))
          setUser(response.user)
        }
        scheduleTokenRefresh(response.token)
      }
    } catch (error) {
      console.error('❌ Token refresh error:', error)
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setUser(null)
    }
  }, [scheduleTokenRefresh])

  useEffect(() => {
    refreshTokenRef.current = refreshToken
    return () => {
      refreshTokenRef.current = null
      clearRefreshTimer()
    }
  }, [refreshToken])

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    if (token && userData) {
      setUser(JSON.parse(userData))
      scheduleTokenRefresh(token)
    }
    setLoading(false)
  }, [scheduleTokenRefresh])

  const login = async (username, password, token = null) => {
    try {
      let response
      if (token) {
        // Login với token (từ Google OAuth)
        localStorage.setItem('token', token)
        // Fetch user info từ API
        const { usersAPI } = await import('@/lib/api')
        const userData = await usersAPI.getMe()
        response = {
          token,
          user: userData,
        }
      } else {
        // Login thông thường
        response = await authAPI.login({ username, password })
      }
      localStorage.setItem('token', response.token)
      localStorage.setItem('user', JSON.stringify(response.user))
      setUser(response.user)
      scheduleTokenRefresh(response.token)
      return response
    } catch (error) {
      console.error('❌ Login error:', error)
      throw error
    }
  }

  const register = async (username, password, email) => {
    try {
      const response = await authAPI.register({ username, password, email })
      localStorage.setItem('token', response.token)
      localStorage.setItem('user', JSON.stringify(response.user))
      setUser(response.user)
      scheduleTokenRefresh(response.token)
      return response
    } catch (error) {
      console.error('❌ Register error:', error)
      throw error
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    clearRefreshTimer()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

