import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { getRedirectPath } from '@/utils/redirect'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Đang tải...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Redirect admin away from /dashboard to /admin
  if (user.role === 'admin' && location.pathname === '/dashboard') {
    return <Navigate to="/admin" replace />
  }

  // Redirect regular users away from /admin to /dashboard
  if (user.role !== 'admin' && location.pathname === '/admin') {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

