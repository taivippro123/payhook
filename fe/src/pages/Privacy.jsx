import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import PillNav from '@/components/PillNav'
import Silk from '@/components/Silk'
import { PageSEO } from '@/components/SEO'
import ogImage from '@/assets/Payhook.png'

export default function Privacy() {
  const navItems = useMemo(
    () => [
      { label: 'Trang chủ', href: '/' },
      { label: 'Chính sách', href: '/#privacy' },
      { label: 'Đăng nhập', href: '/login' },
    ],
    []
  )

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <PageSEO
        title="Chính sách bảo mật"
        description="Tìm hiểu cách Payhook thu thập, sử dụng và bảo vệ dữ liệu giao dịch từ ngân hàng CAKE, cùng quyền kiểm soát của người dùng."
        pathname="/privacy"
        image={ogImage}
        type="article"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'PrivacyPolicy',
          name: 'Chính sách bảo mật Payhook',
          url: 'https://payhook.vercel.app/privacy',
          publisher: {
            '@type': 'Organization',
            name: 'Payhook',
            url: 'https://payhook.vercel.app/',
          },
          datePublished: '2025-11-13',
          dateModified: new Date().toISOString().split('T')[0],
          inLanguage: 'vi-VN',
        }}
      />
      <main>
        <section className="relative overflow-hidden border-b border-gray-200 bg-black text-white">
          <div className="absolute inset-0">
            <Silk color="#4515FF" speed={4} scale={1.2} noiseIntensity={1.1} />
          </div>
          <div className="relative z-20 mx-auto flex max-w-4xl justify-center px-4 pt-16">
            <PillNav
              className="pill-nav-glass"
              baseColor="rgba(255,255,255,0.12)"
              pillColor="rgba(255,255,255,0.2)"
              pillTextColor="rgba(255,255,255,0.95)"
              hoveredPillTextColor="#060010"
              items={navItems}
              activeHref="/privacy"
              ease="power3.easeOut"
              initialLoadAnimation={false}
            />
          </div>
          <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 py-24 text-center sm:px-12">
            <h1 className="text-3xl font-bold sm:text-4xl md:text-5xl">Chính sách bảo mật Payhook</h1>
            <p className="max-w-2xl text-sm text-white/90 sm:text-base">
              Chúng tôi cam kết chỉ thu thập và sử dụng dữ liệu cần thiết để gửi thông báo giao dịch một cách an toàn,
              minh bạch. Đọc đầy đủ chi tiết bên dưới.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link to="/register">
                <Button size="lg" variant="outline" className="bg-white/10 text-white hover:bg-white/20">
                  Đăng ký ngay
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-4xl px-4 py-12">
            <header className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900">Chi tiết chính sách</h2>
              <p className="mt-2 text-sm text-gray-500">Cập nhật lần cuối: {new Date().toLocaleDateString('vi-VN')}</p>
            </header>

            <div className="space-y-4 text-sm leading-relaxed text-gray-600">
              <p>
                Payhook sử dụng Gmail API (scope <code className="bg-gray-100 px-1 rounded text-xs">https://www.googleapis.com/auth/gmail.readonly</code>)
                để nhận thông báo giao dịch ngân hàng CAKE và gửi webhook về hệ thống của bạn. Chúng tôi tuân thủ chính sách dữ liệu người dùng
                Google và chỉ truy cập các dữ liệu cần thiết cho chức năng này.
              </p>

              <h2 className="text-xl font-semibold text-gray-900">1. Dữ liệu chúng tôi truy cập</h2>
              <ul className="ml-4 list-disc space-y-2">
                <li>Địa chỉ email Gmail bạn đã kết nối thông qua Google OAuth.</li>
                <li>Nội dung email từ ngân hàng CAKE (subject, from, body) được sử dụng để phân tích giao dịch.</li>
                <li>Refresh token do Google cấp để duy trì kết nối Gmail.</li>
              </ul>

              <h2 className="text-xl font-semibold text-gray-900">2. Mục đích sử dụng dữ liệu</h2>
              <p>
                Dữ liệu được sử dụng duy nhất để phát hiện giao dịch CAKE mới và gửi webhook/WebSocket đến ứng dụng của bạn. Payhook không chia sẻ
                dữ liệu với bên thứ ba và không sử dụng cho quảng cáo.
              </p>

              <h2 className="text-xl font-semibold text-gray-900">3. Cách chúng tôi lưu trữ &amp; bảo mật</h2>
              <ul className="ml-4 list-disc space-y-2">
                <li>Refresh token được lưu trữ trong cơ sở dữ liệu bảo mật của Payhook.</li>
                <li>Chúng tôi chỉ lưu thông tin giao dịch cần thiết (ID giao dịch, số tiền, mô tả, thời gian...).</li>
                <li>Webhook retry và log giúp bạn kiểm soát việc gửi dữ liệu.</li>
              </ul>

              <h2 className="text-xl font-semibold text-gray-900">4. Quyền kiểm soát của người dùng</h2>
              <ul className="ml-4 list-disc space-y-2">
                <li>Ngắt kết nối Gmail bất cứ lúc nào trong Dashboard Payhook (xóa cấu hình email).</li>
                <li>
                  Thu hồi quyền từ Google: vào <a href="https://myaccount.google.com/permissions" className="text-blue-600 hover:underline">Google
                  Account → Security → Third-party apps with account access</a>.
                </li>
                <li>Yêu cầu xóa dữ liệu khỏi Payhook bằng cách liên hệ support hoặc xóa tài khoản.</li>
              </ul>

              <h2 className="text-xl font-semibold text-gray-900">5. Liên hệ</h2>
              <p>
                Nếu bạn có câu hỏi về chính sách bảo mật, vui lòng liên hệ email hỗ trợ:{' '}
                <a href="mailto:phanvothanhtai1007@gmail.com" className="text-blue-600 hover:underline">phanvothanhtai1007@gmail.com</a>
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
