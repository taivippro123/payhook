import { createContext, useContext, useState, useEffect } from 'react'
import { rateLimitManager } from '@/lib/rateLimitManager'

const RateLimitContext = createContext(null)

export function RateLimitProvider({ children }) {
  const [isRateLimited, setIsRateLimited] = useState(() => rateLimitManager.isRateLimited())
  const [rateLimitType, setRateLimitType] = useState(() => rateLimitManager.getState().rateLimitType)
  const [rateLimitExpiresAt, setRateLimitExpiresAt] = useState(() => rateLimitManager.getState().rateLimitExpiresAt)

  useEffect(() => {
    // Subscribe to rate limit changes
    const unsubscribe = rateLimitManager.subscribe((state) => {
      setIsRateLimited(state.isRateLimited)
      setRateLimitType(state.rateLimitType)
      setRateLimitExpiresAt(state.rateLimitExpiresAt)
    })

    return unsubscribe
  }, [])

  const setRateLimit = (type, retryAfterSeconds = null) => {
    rateLimitManager.setRateLimit(type, retryAfterSeconds)
  }

  const clearRateLimit = () => {
    rateLimitManager.clearRateLimit()
  }

  const getRemainingTime = () => {
    if (!rateLimitExpiresAt) return null
    const now = new Date()
    const expiresAt = new Date(rateLimitExpiresAt)
    const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000))
    return remaining
  }

  const getRemainingTimeFormatted = () => {
    const remaining = getRemainingTime()
    if (!remaining) return null
    
    const minutes = Math.floor(remaining / 60)
    const seconds = remaining % 60
    
    if (minutes > 0) {
      return `${minutes} phút ${seconds} giây`
    }
    return `${seconds} giây`
  }

  return (
    <RateLimitContext.Provider
      value={{
        isRateLimited,
        rateLimitType,
        rateLimitExpiresAt,
        setRateLimit,
        clearRateLimit,
        getRemainingTime,
        getRemainingTimeFormatted,
      }}
    >
      {children}
    </RateLimitContext.Provider>
  )
}

export function useRateLimit() {
  const context = useContext(RateLimitContext)
  if (!context) {
    throw new Error('useRateLimit must be used within RateLimitProvider')
  }
  return context
}

