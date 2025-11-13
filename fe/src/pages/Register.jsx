import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useRateLimit } from '@/contexts/RateLimitContext'
import { getRedirectPath } from '@/utils/redirect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import PayhookLogo from '@/assets/Payhook.png'
import { PageSEO } from '@/components/SEO'

export default function Register() {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()
  const { isRateLimited, rateLimitType } = useRateLimit()
  
  // Check if auth is rate limited
  const isAuthRateLimited = isRateLimited && rateLimitType === 'auth'

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isAuthRateLimited) return
    
    setError('')
    setLoading(true)

    if (formData.password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự')
      setLoading(false)
      return
    }

    try {
      const response = await register(formData.username, formData.password, formData.email)
      const redirectPath = getRedirectPath(response.user)
      navigate(redirectPath)
    } catch (err) {
      setError(err.response?.data?.error || 'Đăng ký thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <PageSEO
        title="Đăng ký"
        description="Tạo tài khoản Payhook để tự động nhận giao dịch CAKE qua webhook, dashboard realtime và log chi tiết."
        pathname="/register"
        robots="noindex,nofollow"
      />
      <img src={PayhookLogo} alt="Payhook" className="mb-6 h-32 w-32" />
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold text-center">Đăng ký</CardTitle>
          <CardDescription className="text-center">
            Tạo tài khoản mới để bắt đầu sử dụng
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">Tên đăng nhập</Label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="Nhập tên đăng nhập"
                value={formData.username}
                onChange={handleChange}
                required
                disabled={loading || isAuthRateLimited}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Nhập email"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={loading || isAuthRateLimited}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={loading || isAuthRateLimited}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading || isAuthRateLimited}>
              {loading ? 'Đang đăng ký...' : isAuthRateLimited ? 'Too many request, vui lòng thử lại sau' : 'Đăng ký'}
            </Button>

            <div className="text-center text-sm text-gray-600">
              Đã có tài khoản?{' '}
              <Link to="/login" className="text-primary hover:underline">
                Đăng nhập ngay
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

