import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import Silk from '@/components/Silk'
import PillNav from '@/components/PillNav'

export default function Home() {
  const navItems = useMemo(
    () => [
      { label: 'Trang chủ', href: '/#' },
      { label: 'Chính sách', href: '/privacy' },
      { label: 'Đăng nhập', href: '/login' },
    ],
    []
  )

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="bg-white">
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
              activeHref="/"
              ease="power3.easeOut"
              initialLoadAnimation={false}
            />
          </div>
          <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center gap-8 px-6 py-24 text-center sm:px-12">
            <h1 className="text-3xl font-bold sm:text-4xl md:text-5xl">
              Nhận thông báo giao dịch
            </h1>
            <p className="text-3xl font-bold sm:text-4xl md:text-5xl">trong vài giây</p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link to="/register">
                <Button size="lg">Tạo tài khoản</Button>
              </Link>
              <Link to="/guide">
                <Button size="lg" variant="outline" className="bg-white/10 text-white hover:bg-white/20">
                  Xem tài liệu tích hợp
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section id="features" className="bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-2xl font-semibold text-gray-900">Tính năng nổi bật</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: 'Kết nối Gmail an toàn',
                  desc: 'Người dùng ủy quyền qua Google OAuth, Payhook chỉ đọc email từ CAKE và lưu refresh_token mã hóa.',
                },
                {
                  title: 'Push real-time',
                  desc: 'Gmail gửi push tới Pub/Sub → Payhook xử lý email → phát webhook / WebSocket ngay lập tức.',
                },
                {
                  title: 'Webhook linh hoạt',
                  desc: 'Payload đơn giản, retry tối đa 5 lần (10s→10s→20s→30s→50s). Ghi log để kiểm tra dễ dàng.',
                },
                {
                  title: 'Dashboard rõ ràng',
                  desc: 'Hiển thị trạng thái push, thời gian hết hạn, webhook URL, log giao dịch mới nhất.',
                },
                {
                  title: 'Auto gia hạn Gmail watch',
                  desc: 'Scheduler chạy nền, tự renew trước 24 giờ. Không cần thao tác thủ công.',
                },
                {
                  title: 'Tài liệu tiếng Việt chi tiết',
                  desc: 'Guide tích hợp từng bước, mô tả payload, ví dụ webhook và chính sách bảo mật rõ ràng.',
                },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-gray-200 bg-gray-50 p-5 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-2 text-sm text-gray-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="bg-gray-50">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-2xl font-semibold text-gray-900">Quy trình hoạt động</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <ol className="space-y-4 text-sm text-gray-600">
                  <li>1. Kết nối Gmail bằng OAuth trên Payhook (không yêu cầu mật khẩu ứng dụng).</li>
                  <li>2. Payhook đăng ký Gmail Push Notifications (Pub/Sub).</li>
                  <li>3. Khi có email mới từ CAKE, Gmail gửi push → Payhook lấy email → parse giao dịch.</li>
                  <li>4. Giao dịch mới được lưu, bắn WebSocket và gửi webhook đến hệ thống của bạn.</li>
                  <li>5. Scheduler của Payhook tự renew `users.watch()` trước khi hết hạn.</li>
                </ol>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">Kịch bản sử dụng điển hình</h3>
                <ul className="mt-4 space-y-3 text-sm text-gray-600">
                  <li>• Tự động xác nhận thanh toán cho cửa hàng/website.</li>
                  <li>• Thêm giao dịch mới vào CRM/ERP hoặc Google Sheets.</li>
                  <li>• Gửi thông báo realtime tới người bán qua WebSocket.</li>
                  <li>• Đồng bộ giao dịch vào báo cáo BI của doanh nghiệp.</li>
                </ul>
                <div className="mt-6">
                  <Link to="/guide">
                    <Button variant="outline">Xem chi tiết API &amp; webhook payload</Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-gray-500">
            © {new Date().getFullYear()} Payhook. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}

