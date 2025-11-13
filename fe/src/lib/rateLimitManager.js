// Rate limit manager that can be used outside React components
let rateLimitState = {
  isRateLimited: false,
  rateLimitType: null,
  rateLimitExpiresAt: null,
  listeners: new Set(),
}

// Load from localStorage on initialization
const loadFromStorage = () => {
  try {
    const stored = localStorage.getItem('rateLimit')
    if (stored) {
      const { isRateLimited, expiresAt, type } = JSON.parse(stored)
      if (expiresAt && new Date(expiresAt) > new Date()) {
        rateLimitState.isRateLimited = isRateLimited
        rateLimitState.rateLimitType = type
        rateLimitState.rateLimitExpiresAt = new Date(expiresAt)
        return true
      } else {
        localStorage.removeItem('rateLimit')
      }
    }
  } catch (e) {
    console.error('Error loading rate limit from localStorage:', e)
    localStorage.removeItem('rateLimit')
  }
  return false
}

// Initialize from storage
loadFromStorage()

// Notify all listeners
const notifyListeners = () => {
  rateLimitState.listeners.forEach((listener) => {
    try {
      listener({
        isRateLimited: rateLimitState.isRateLimited,
        rateLimitType: rateLimitState.rateLimitType,
        rateLimitExpiresAt: rateLimitState.rateLimitExpiresAt,
      })
    } catch (e) {
      console.error('Error notifying rate limit listener:', e)
    }
  })
}

export const rateLimitManager = {
  setRateLimit: (type, retryAfterSeconds = null) => {
    // Default retry after times based on rate limit type
    let defaultRetryAfter = 900 // 15 minutes in seconds
    if (type === 'auth') {
      defaultRetryAfter = 900 // 15 minutes
    } else if (type === 'api') {
      defaultRetryAfter = 900 // 15 minutes
    } else if (type === 'webhook') {
      defaultRetryAfter = 3600 // 1 hour
    }

    const retryAfter = retryAfterSeconds || defaultRetryAfter
    const expiresAt = new Date(Date.now() + retryAfter * 1000)

    rateLimitState.isRateLimited = true
    rateLimitState.rateLimitType = type
    rateLimitState.rateLimitExpiresAt = expiresAt

    // Store in localStorage
    localStorage.setItem('rateLimit', JSON.stringify({
      isRateLimited: true,
      type,
      expiresAt: expiresAt.toISOString()
    }))

    notifyListeners()
  },

  clearRateLimit: () => {
    rateLimitState.isRateLimited = false
    rateLimitState.rateLimitType = null
    rateLimitState.rateLimitExpiresAt = null
    localStorage.removeItem('rateLimit')
    notifyListeners()
  },

  getState: () => ({
    isRateLimited: rateLimitState.isRateLimited,
    rateLimitType: rateLimitState.rateLimitType,
    rateLimitExpiresAt: rateLimitState.rateLimitExpiresAt,
  }),

  subscribe: (listener) => {
    rateLimitState.listeners.add(listener)
    // Immediately call with current state
    listener(rateLimitManager.getState())
    // Return unsubscribe function
    return () => {
      rateLimitState.listeners.delete(listener)
    }
  },

  isRateLimited: () => {
    // Check if expired
    if (rateLimitState.rateLimitExpiresAt) {
      const now = new Date()
      const expiresAt = new Date(rateLimitState.rateLimitExpiresAt)
      if (expiresAt <= now) {
        rateLimitManager.clearRateLimit()
        return false
      }
    }
    return rateLimitState.isRateLimited
  },
}

// Auto-clear expired rate limits
setInterval(() => {
  if (rateLimitState.isRateLimited && rateLimitState.rateLimitExpiresAt) {
    const now = new Date()
    const expiresAt = new Date(rateLimitState.rateLimitExpiresAt)
    if (expiresAt <= now) {
      rateLimitManager.clearRateLimit()
    }
  }
}, 1000) // Check every second

