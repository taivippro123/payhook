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
        robots="index,follow"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'PrivacyPolicy',
          name: 'Chính sách bảo mật Payhook',
          url: 'https://www.payhook.codes/privacy',
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': 'https://www.payhook.codes/privacy',
          },
          publisher: {
            '@type': 'Organization',
            name: 'Payhook',
            url: 'https://www.payhook.codes/',
            logo: {
              '@type': 'ImageObject',
              url: 'https://www.payhook.codes/og-image.svg',
            },
          },
          datePublished: '2025-11-16',
          dateModified: '2025-11-16',
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
              <h2 className="text-3xl font-bold text-gray-900">Chính sách bảo mật Payhook</h2>
              <p className="mt-2 text-sm text-gray-500">Cập nhật lần cuối: 16/11/2025</p>
            </header>

            <div className="space-y-6 text-sm leading-relaxed text-gray-600">
              <p>
                Payhook sử dụng Gmail API (scope:{' '}
                <code className="bg-gray-100 px-1 rounded text-xs">https://www.googleapis.com/auth/gmail.readonly</code>) để đọc email thông báo giao dịch ngân hàng CAKE và gửi webhook theo cấu hình của bạn. Chúng tôi tuân thủ nghiêm ngặt{' '}
                <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                  Chính sách dữ liệu người dùng của Google
                </a>{' '}
                và các quy định bảo vệ dữ liệu cá nhân tại Việt Nam.
              </p>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">1. Dữ liệu chúng tôi truy cập</h2>
                <p className="text-gray-700">Payhook chỉ truy cập các dữ liệu tối thiểu cần thiết:</p>

                <div className="ml-4 space-y-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">1.1. Dữ liệu tài khoản Gmail</h3>
                    <ul className="ml-4 mt-1 list-disc space-y-1">
                      <li>Địa chỉ email bạn kết nối qua Google OAuth.</li>
                      <li>Refresh token do Google cấp để duy trì kết nối.</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900">1.2. Dữ liệu email từ ngân hàng CAKE</h3>
                    <ul className="ml-4 mt-1 list-disc space-y-1">
                      <li>Subject</li>
                      <li>Địa chỉ gửi</li>
                      <li>Nội dung email (chỉ để phân tích giao dịch)</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900">1.3. Giới hạn truy cập</h3>
                    <ul className="ml-4 mt-1 list-disc space-y-1">
                      <li>Chúng tôi <strong>KHÔNG</strong> đọc email nào ngoài email từ ngân hàng CAKE.</li>
                      <li>Chúng tôi <strong>KHÔNG</strong> lưu trữ toàn bộ nội dung email.</li>
                      <li>
                        Sau khi phân tích, chỉ các trường giao dịch cần thiết (số tiền, ID giao dịch, thời gian, nội dung chuyển khoản) được lưu trữ.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">2. Mục đích sử dụng dữ liệu</h2>
                <p className="text-gray-700">Dữ liệu được sử dụng duy nhất cho mục đích:</p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>Phát hiện giao dịch mới từ CAKE</li>
                  <li>Gửi webhook hoặc WebSocket đến server ứng dụng của bạn</li>
                </ul>
                <p className="text-gray-700 mt-3">Chúng tôi không:</p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>chia sẻ dữ liệu cho bên thứ ba</li>
                  <li>sử dụng dữ liệu cho quảng cáo</li>
                  <li>sử dụng dữ liệu để phân tích hành vi</li>
                  <li>sử dụng để huấn luyện AI/ML</li>
                  <li>bán hoặc cho thuê dữ liệu</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">3. Cách chúng tôi lưu trữ &amp; bảo mật</h2>

                <div className="ml-4 space-y-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">3.1. Lưu trữ</h3>
                    <ul className="ml-4 mt-1 list-disc space-y-1">
                      <li>
                        Refresh token Gmail được mã hóa bằng{' '}
                        <span className="font-mono text-xs">AES-256-GCM</span> (xem module{' '}
                        <code className="bg-gray-100 px-1 rounded text-xs">utils/encryption.js</code>) trước khi lưu tại MongoDB Atlas.
                      </li>
                      <li>Chỉ lưu các trường giao dịch đã trích xuất; nội dung email thô không được lưu trữ.</li>
                      <li>
                        Database MongoDB Atlas được giới hạn IP (chỉ Fly.io app server) và bật TLS ở cả chiều vào/ra.
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900">3.2. Truyền dữ liệu</h3>
                    <ul className="ml-4 mt-1 list-disc space-y-1">
                      <li>Webhook chỉ gửi qua HTTPS và đính kèm chữ ký `X-Payhook-Signature` để bạn xác thực.</li>
                      <li>Giao tiếp giữa trình duyệt và API đi qua Vercel + Fly.io đều dùng TLS 1.2+.</li>
                      <li>Push notification và WebSocket yêu cầu JWT hợp lệ và hết hạn sau 60 phút.</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900">3.3. Bảo mật vận hành</h3>
                    <ul className="ml-4 mt-1 list-disc space-y-1">
                      <li>Chỉ có một thành viên vận hành hệ thống; tài khoản Fly.io, MongoDB Atlas, Vercel đều bật MFA.</li>
                      <li>Truy cập server Fly.io được giới hạn qua SSH certificate; mọi thay đổi deploy đều log trong Git + Fly.io release log.</li>
                      <li>Theo dõi webhook, Gmail push và login bằng log tập trung; mọi sự kiện quan trọng đều kèm timestamp/IP.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">4. Thời gian lưu trữ dữ liệu (Retention)</h2>
                <ul className="ml-4 list-disc space-y-2">
                  <li>Dữ liệu giao dịch được giữ tối đa 90 ngày. Cron `dataRetention` chạy mỗi 6 giờ để xóa bản ghi cũ hơn ngưỡng này.</li>
                  <li>Webhook log giữ tối đa 30 ngày để phục vụ việc tra soát; Dead Letter Queue tự xóa các mục đã resolved hoặc failed sau 30 ngày.</li>
                  <li>Refresh token được lưu cho đến khi bạn hủy kết nối Gmail hoặc xóa tài khoản.</li>
                  <li>Sau khi bạn xóa tài khoản Payhook, toàn bộ user profile, Gmail config, transaction, webhook log và push subscription gắn với tài khoản sẽ bị xóa trong vòng 24 giờ.</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">5. Quyền của người dùng</h2>
                <p className="text-gray-700">Bạn có thể:</p>

                <div className="ml-4 space-y-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">5.1. Hủy quyền truy cập</h3>
                    <ul className="ml-4 mt-1 list-disc space-y-1">
                      <li>Tắt hoặc xóa kết nối Gmail trong Dashboard Payhook</li>
                      <li>
                        Hoặc thu hồi quyền tại{' '}
                        <a href="https://myaccount.google.com/permissions" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                          Google Account → Security → Third-party apps with access
                        </a>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900">5.2. Yêu cầu xóa dữ liệu</h3>
                    <p className="ml-4 mt-1">
                      Liên hệ email hỗ trợ hoặc xóa tài khoản để xóa toàn bộ dữ liệu khỏi Payhook.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900">5.3. Xem lại dữ liệu đã lưu</h3>
                    <p className="ml-4 mt-1">
                      Dashboard Payhook hiển thị toàn bộ lịch sử webhook/giao dịch Payhook đã xử lý cho bạn.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">6. Quy định bảo mật &amp; nhân sự</h2>
                <ul className="ml-4 list-disc space-y-2">
                  <li>Payhook là dự án cá nhân, chỉ có admin của dự án được phép truy cập dữ liệu sản xuất.</li>
                  <li>Không thuê ngoài/chia sẻ dữ liệu cho đối tác. Mọi thao tác vận hành đều thông qua tài khoản cá nhân bật MFA.</li>
                  <li>Thiết bị phát triển sử dụng disk encryption và khoá màn hình tự động trong &lt;5 phút.</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">7. Hạ tầng &amp; nhà cung cấp</h2>
                <ul className="ml-4 list-disc space-y-2">
                  <li>API Node.js chạy trên Fly.io (region Singapore) và chỉ mở cổng 443/80. Fly.io chỉ lưu log tạm thời tối đa 30 ngày.</li>
                  <li>Database MongoDB Atlas lưu trữ giao dịch sau khi đã mã hóa và giới hạn quyền truy cập qua IP allowlist.</li>
                  <li>Frontend (https://www.payhook.codes) được build và phục vụ bởi Vercel; không chứa dữ liệu người dùng.</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">8. Giải thích phạm vi truy cập tối thiểu</h2>
                <p className="text-gray-700">
                  Payhook chỉ yêu cầu scope{' '}
                  <code className="bg-gray-100 px-1 rounded text-xs">gmail.readonly</code> vì parser cần truy cập body email CAKE để trích xuất số tiền, mã giao dịch và nội dung chuyển khoản. Scope nhẹ hơn
                  như{' '}
                  <code className="bg-gray-100 px-1 rounded text-xs">gmail.metadata</code> không chứa đủ thông tin giao dịch (không có nội dung HTML). Ứng dụng không xin quyền sửa/xóa email, không truy cập Gmail
                  khác ngoài nhãn CAKE được định danh bằng bộ lọc sender + subject.
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">9. Quy trình ứng phó sự cố</h2>
                <ul className="ml-4 list-disc space-y-2">
                  <li>Nếu phát hiện truy cập trái phép, Payhook sẽ vô hiệu refresh token, tắt webhook và thông báo qua email trong vòng 24 giờ.</li>
                  <li>Log truy vết (IP, token, requestId) lưu tối thiểu 30 ngày để hỗ trợ điều tra.</li>
                  <li>Bạn có thể báo cáo sự cố qua <a href="mailto:phanvothanhtai1007@gmail.com" className="text-blue-600 hover:underline">phanvothanhtai1007@gmail.com</a>; chúng tôi phản hồi trong 1 ngày làm việc.</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">10. Cập nhật chính sách</h2>
                <ul className="ml-4 list-disc space-y-2">
                  <li>Payhook có thể cập nhật chính sách này khi dịch vụ thay đổi.</li>
                  <li>Chúng tôi sẽ thông báo trên dashboard hoặc email mỗi khi có thay đổi quan trọng.</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">11. Liên hệ</h2>
                <p>
                  Nếu bạn có câu hỏi, hãy liên hệ:{' '}
                  <a href="mailto:phanvothanhtai1007@gmail.com" className="text-blue-600 hover:underline">
                    phanvothanhtai1007@gmail.com
                  </a>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
