import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import Silk from '@/components/Silk'
import PillNav from '@/components/PillNav'
import Faq02 from '@/components/faq-02'
import { HoverEffect } from '@/components/ui/card-hover-effect'
import { PageSEO, generateOrganizationSchema } from '@/components/SEO'
import ogImage from '@/assets/Payhook.png'
import GradientText from '@/components/GradientText'

export default function Home() {
  const navItems = useMemo(
    () => [
      { label: 'Trang chủ', href: '/#' },
      { label: 'Chính sách', href: '/privacy' },
      { label: 'Đăng nhập', href: '/login' },
    ],
    []
  )

  const featureItems = useMemo(
    () => [
      {
        title: 'Kết nối Gmail an toàn',
        description:
          'Ủy quyền qua Google OAuth, Payhook chỉ đọc email từ ngân hàng CAKE và mã hóa refresh token để đảm bảo bảo mật.',
        link: '/guide',
      },
      {
        title: 'Push realtime',
        description:
          'Nhận giao dịch trong vài giây nhờ Gmail Push Notifications, không cần cron hay polling thủ công.',
        link: '/guide',
      },
      {
        title: 'Webhook linh hoạt',
        description:
          'Payload đơn giản, retry tối đa 5 lần với độ trễ tăng dần. Theo dõi log dễ dàng để kiểm tra trạng thái.',
        link: '/guide',
      },
      {
        title: 'Dashboard rõ ràng',
        description:
          'Theo dõi trạng thái push, thời gian hết hạn, webhook URL và giao dịch mới nhất trong một giao diện trực quan.',
        link: '/dashboard',
      },
      {
        title: 'Auto gia hạn Gmail watch',
        description:
          'Scheduler nền tự gia hạn `users.watch()` trước khi hết hạn 24 giờ, không cần thao tác thủ công.',
        link: '/guide',
      },
      {
        title: 'Tài liệu tiếng Việt chi tiết',
        description:
          'Hướng dẫn tích hợp từng bước, mô tả payload mẫu, chính sách bảo mật rõ ràng và cập nhật liên tục.',
        link: '/guide',
      },
    ],
    []
  )

  const organizationSchema = useMemo(() => generateOrganizationSchema(), [])

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <PageSEO
        description="Kết nối Gmail CAKE của bạn với Payhook để nhận giao dịch trong vài giây, webhook realtime và dashboard giám sát tiện lợi."
        pathname="/"
        image={ogImage}
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Payhook',
          url: 'https://www.payhook.codes/',
          description:
            'Payhook giúp nhận giao dịch ngân hàng CAKE theo thời gian thực thông qua Gmail Push Notifications và webhook.',
          potentialAction: {
            '@type': 'SearchAction',
            target: {
              '@type': 'EntryPoint',
              urlTemplate: 'https://www.payhook.codes/guide?q={search_term_string}',
            },
            'query-input': 'required name=search_term_string',
          },
          inLanguage: 'vi-VN',
          author: {
            '@type': 'Organization',
            name: 'Payhook',
            url: 'https://www.payhook.codes/',
          },
          publisher: {
            '@type': 'Organization',
            name: 'Payhook',
            url: 'https://www.payhook.codes/',
          },
          mainEntity: organizationSchema,
        }}
      />
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
              Payhook
            </h1>
            <h1 className="text-3xl font-bold sm:text-4xl md:text-5xl">
              Nhận thông báo giao dịch
            </h1>
            <GradientText
              colors={['#40ffaa', '#4079ff', '#40ffaa', '#4079ff', '#40ffaa']}
              animationSpeed={3}
              showBorder={false}
              className="text-3xl font-bold sm:text-4xl md:text-5xl"
            >
              ngay lập tức
            </GradientText>
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
            <div className="max-w-3xl">
              <h2 className="text-2xl font-semibold text-gray-900">Tính năng nổi bật</h2>
            </div>
            <HoverEffect items={featureItems} className="mt-8" />
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

        <Faq02 />
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

