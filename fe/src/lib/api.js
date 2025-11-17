import axios from 'axios'
import { rateLimitManager } from './rateLimitManager'

const stripTrailingSlash = (value) => {
  if (!value) return value
  return value.endsWith('/') ? value.slice(0, -1) : value
}

export const API_BASE_URL = stripTrailingSlash(import.meta.env.VITE_API_URL || 'http://localhost:3000')
const defaultWsBase = API_BASE_URL.replace(/^http/, 'ws')
export const WS_BASE_URL = stripTrailingSlash(import.meta.env.VITE_WS_URL || defaultWsBase)

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  } else {
    console.warn('⚠️ No token found in localStorage')
  }
  return config
}, (error) => {
  return Promise.reject(error)
})

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid, clear storage and redirect to login
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      // Only redirect if not already on login/register page
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
        window.location.href = '/login'
      }
    } else if (error.response?.status === 429) {
      // Rate limit exceeded
      const url = error.config?.url || ''
      let rateLimitType = 'api'
      
      // Determine rate limit type based on endpoint
      if (url.includes('/api/auth/login') || url.includes('/api/auth/register')) {
        rateLimitType = 'auth'
      } else if (url.includes('/api/webhook') || url.includes('/api/email-configs')) {
        rateLimitType = 'webhook'
      }
      
      // Get Retry-After header if available
      const retryAfter = error.response?.headers?.['retry-after'] 
        ? parseInt(error.response.headers['retry-after'], 10)
        : null
      
      // Set rate limit
      rateLimitManager.setRateLimit(rateLimitType, retryAfter)
      
      // Show Vietnamese alert message
      const message = 'Too many request, vui lòng thử lại sau'
      alert(message)
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authAPI = {
  register: async (data) => {
    const response = await api.post('/api/auth/register', data)
    return response.data
  },
  login: async (data) => {
    const response = await api.post('/api/auth/login', data)
    return response.data
  },
}

// Email Config API
export const emailConfigAPI = {
  getAll: async () => {
    const response = await api.get('/api/email-configs')
    return response.data
  },
  update: async (id, data) => {
    const response = await api.put(`/api/email-configs/${id}`, data)
    return response.data
  },
  delete: async (id) => {
    const response = await api.delete(`/api/email-configs/${id}`)
    return response.data
  },
  sendTestEmail: async (id, overrides = {}) => {
    const response = await api.post(`/api/email-configs/${id}/send-test-email`, { overrides })
    return response.data
  },
}

export const gmailAPI = {
  getAuthUrl: async () => {
    const response = await api.get('/api/auth/google')
    return response.data
  },
  getLoginAuthUrl: async () => {
    const response = await api.get('/api/auth/google/login')
    return response.data
  },
}

// Transactions API
export const transactionsAPI = {
  getAll: async (params = {}) => {
    const response = await api.get('/api/transactions', { params })
    return response.data
  },
}

export const webhookLogsAPI = {
  list: async (params = {}) => {
    const response = await api.get('/api/webhook-logs', { params })
    return response.data
  },
  getById: async (id) => {
    const response = await api.get(`/api/webhook-logs/${id}`)
    return response.data
  },
}

// Users API
export const usersAPI = {
  getAll: async (params = {}) => {
    const response = await api.get('/api/users', { params })
    return response.data
  },
  getMe: async () => {
    const response = await api.get('/api/users/me')
    return response.data
  },
  updateMe: async (data) => {
    const response = await api.put('/api/users/me', data)
    return response.data
  },
  getById: async (id) => {
    const response = await api.get(`/api/users/${id}`)
    return response.data
  },
  update: async (id, data) => {
    const response = await api.put(`/api/users/${id}`, data)
    return response.data
  },
  delete: async (id) => {
    const response = await api.delete(`/api/users/${id}`)
    return response.data
  },
  updateRole: async (id, role) => {
    const response = await api.put(`/api/users/${id}/role`, { role })
    return response.data
  },
}

// QR API (helper to compose image URL)
export const qrAPI = {
  imageUrl: ({ acc, amount, des, bank = 'cake' }) => {
    const u = new URL(`${API_BASE_URL}/api/qr/img`)
    if (acc) u.searchParams.set('acc', acc)
    if (bank) u.searchParams.set('bank', bank)
    if (amount) u.searchParams.set('amount', amount)
    if (des) u.searchParams.set('des', des)
    return u.toString()
  },
}

// Push Notifications API
export const pushNotificationsAPI = {
  getPublicKey: async () => {
    const response = await api.get('/api/push/public-key')
    return response.data
  },
  subscribe: async (subscription, settings) => {
    const response = await api.post('/api/push/subscribe', { subscription, settings })
    return response.data
  },
  unsubscribe: async (endpoint) => {
    const response = await api.post('/api/push/unsubscribe', { endpoint })
    return response.data
  },
  getSettings: async () => {
    const response = await api.get('/api/push/settings')
    return response.data
  },
  updateSettings: async (settings) => {
    const response = await api.put('/api/push/settings', settings)
    return response.data
  },
}

// TTS API
export const ttsAPI = {
  generatePaymentSuccess: async (amount) => {
    const response = await api.post('/api/tts/payment-success', { amount })
    return response.data
  },
  test: async (text) => {
    const response = await api.post('/api/tts/test', { text })
    return response.data
  },
}

export default api

