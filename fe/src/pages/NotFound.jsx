import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { PageSEO } from '@/components/SEO'
import logo from '/Payhook.png'

export default function NotFound() {
  return (
    <>
      <PageSEO
        title="404 - Trang không tìm thấy"
        description="Trang bạn đang tìm kiếm không tồn tại."
        robots="noindex, nofollow"
      />
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-blue-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 px-4">
        <div className="text-center space-y-8 max-w-md w-full">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img
              src={logo}
              alt="Payhook Logo"
              className="h-24 w-auto object-contain"
            />
          </div>

          {/* 404 Text */}
          <div className="space-y-4">
            <h1 className="text-8xl font-bold bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 bg-clip-text text-transparent">
              404
            </h1>
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
              Trang không tìm thấy
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-center text-sm">
              Xin lỗi, trang bạn đang tìm kiếm không tồn tại hoặc đã bị di chuyển.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button asChild size="lg" className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
              <Link to="/">Về trang chủ</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/dashboard">Đi đến Dashboard</Link>
            </Button>
          </div>

          {/* Helpful Links */}
          <div className="pt-8 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Có thể bạn đang tìm:
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Link
                to="/guide"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Hướng dẫn
              </Link>
              <span className="text-gray-400">•</span>
              <Link
                to="/privacy"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Chính sách
              </Link>
              <span className="text-gray-400">•</span>
              <Link
                to="/login"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Đăng nhập
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

