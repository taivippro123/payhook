import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useRateLimit } from '@/contexts/RateLimitContext'
import { getRedirectPath } from '@/utils/redirect'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import PayhookLogo from '@/assets/Payhook.png'
import { PageSEO } from '@/components/SEO'
import { gmailAPI } from '@/lib/api'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login, user, loading: authLoading } = useAuth()
  const { isRateLimited, rateLimitType } = useRateLimit()
  
  // Check if auth is rate limited
  const isAuthRateLimited = isRateLimited && rateLimitType === 'auth'

  // Redirect nếu đã login rồi
  useEffect(() => {
    if (!authLoading && user) {
      const redirectPath = getRedirectPath(user)
      navigate(redirectPath, { replace: true })
    }
  }, [user, authLoading, navigate])

  // Xử lý callback từ Google OAuth
  useEffect(() => {
    const token = searchParams.get('token')
    const success = searchParams.get('success')
    const errorParam = searchParams.get('error')

    if (errorParam) {
      let errorMessage = 'Đăng nhập thất bại. Vui lòng thử lại.'
      switch (errorParam) {
        case 'oauth_failed':
          errorMessage = 'Xác thực Google thất bại. Vui lòng thử lại.'
          break
        case 'no_code':
          errorMessage = 'Không nhận được mã xác thực từ Google.'
          break
        case 'no_email':
          errorMessage = 'Không lấy được email từ Google.'
          break
        case 'login_failed':
          errorMessage = 'Đăng nhập thất bại. Vui lòng thử lại.'
          break
      }
      setError(errorMessage)
      // Xóa query params để không hiển thị lại lỗi khi refresh
      window.history.replaceState({}, '', '/login')
    }

    if (token && success) {
      // Lưu token và redirect
      localStorage.setItem('token', token)
      // Fetch user info và redirect
      login('', '', token).then(() => {
        navigate('/dashboard')
      }).catch(() => {
        setError('Đăng nhập thành công nhưng không thể lấy thông tin người dùng.')
      })
      // Xóa query params
      window.history.replaceState({}, '', '/login')
    }
  }, [searchParams, navigate, login])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (loading || isAuthRateLimited) return

    setError('')
    setLoading(true)

    try {
      const response = await login(username.trim(), password)
      const redirectPath = getRedirectPath(response.user)
      navigate(redirectPath)
    } catch (err) {
      setError(err.response?.data?.error || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    if (googleLoading || isAuthRateLimited) return

    setError('')
    setGoogleLoading(true)

    try {
      const response = await gmailAPI.getLoginAuthUrl()
      if (response.authUrl) {
        window.location.href = response.authUrl
      } else {
        setError('Không thể tạo liên kết đăng nhập Google. Vui lòng thử lại.')
        setGoogleLoading(false)
      }
    } catch (err) {
      console.error('Error getting Google login URL:', err)
      setError(err.response?.data?.error || 'Không thể kết nối với Google. Vui lòng thử lại.')
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <PageSEO
        title="Đăng nhập"
        description="Đăng nhập Payhook để theo dõi giao dịch CAKE realtime, quản lý webhook và cấu hình Gmail."
        pathname="/login"
        robots="noindex,nofollow"
      />
      <img src={PayhookLogo} alt="Payhook" className="mb-6 h-32 w-32" />
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Đăng nhập</CardTitle>
          <CardDescription>Nhập thông tin để truy cập hệ thống</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">Tên đăng nhập</Label>
              <Input
                id="username"
                type="text"
                placeholder="Nhập tên đăng nhập"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading || isAuthRateLimited}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading || isAuthRateLimited}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading || isAuthRateLimited}>
              {loading ? 'Đang đăng nhập...' : isAuthRateLimited ? 'Too many request, vui lòng thử lại sau' : 'Đăng nhập'}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">Hoặc</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleLogin}
              disabled={googleLoading || isAuthRateLimited}
            >
              {googleLoading ? (
                'Đang chuyển hướng...'
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Đăng nhập với Google
                </div>
              )}
            </Button>

            <div className="text-center text-sm text-gray-600">
              Chưa có tài khoản?{' '}
              <Link to="/register" className="text-primary hover:underline">
                Đăng ký ngay
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
