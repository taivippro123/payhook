export default function Privacy() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Chính sách bảo mật – Payhook</h1>
          <p className="mt-2 text-sm text-gray-500">Cập nhật lần cuối: {new Date().toLocaleDateString('vi-VN')}</p>
        </header>

        <section className="space-y-4 text-sm text-gray-600 leading-relaxed">
          <p>
            Payhook sử dụng Gmail API (scope <code className="bg-gray-100 px-1 rounded text-xs">https://www.googleapis.com/auth/gmail.readonly</code>) để nhận thông báo giao dịch ngân hàng CAKE và gửi webhook về hệ thống của bạn. Chúng tôi tuân thủ chính sách dữ liệu người dùng Google và chỉ truy cập các dữ liệu cần thiết cho chức năng này.
          </p>

          <h2 className="text-xl font-semibold text-gray-900">1. Dữ liệu chúng tôi truy cập</h2>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Địa chỉ email Gmail bạn đã kết nối thông qua Google OAuth.</li>
            <li>Nội dung email từ ngân hàng CAKE (subject, from, body) được sử dụng để phân tích giao dịch.</li>
            <li>Refresh token do Google cấp để duy trì kết nối Gmail.</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900">2. Mục đích sử dụng dữ liệu</h2>
          <p>
            Dữ liệu được sử dụng duy nhất để phát hiện giao dịch CAKE mới và gửi webhook/WebSocket đến ứng dụng của bạn. Payhook không chia sẻ dữ liệu với bên thứ ba và không sử dụng cho quảng cáo.
          </p>

          <h2 className="text-xl font-semibold text-gray-900">3. Cách chúng tôi lưu trữ &amp; bảo mật</h2>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Refresh token được lưu trữ trong cơ sở dữ liệu bảo mật của Payhook.</li>
            <li>Chúng tôi chỉ lưu thông tin giao dịch cần thiết (ID giao dịch, số tiền, mô tả, thời gian...).</li>
            <li>Webhook retry và log giúp bạn kiểm soát việc gửi dữ liệu.</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900">4. Quyền kiểm soát của người dùng</h2>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Ngắt kết nối Gmail bất cứ lúc nào trong Dashboard Payhook (xóa cấu hình email).</li>
            <li>Thu hồi quyền từ Google: vào <a href="https://myaccount.google.com/permissions" className="text-blue-600 hover:underline">Google Account → Security → Third-party apps with account access</a>.</li>
            <li>Yêu cầu xóa dữ liệu khỏi Payhook bằng cách liên hệ support hoặc xóa tài khoản.</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900">5. Liên hệ</h2>
          <p>
            Nếu bạn có câu hỏi về chính sách bảo mật, vui lòng liên hệ email hỗ trợ: <a href="mailto:phanvothanhtai1007@gmail.com" className="text-blue-600 hover:underline">support@payhook.vn</a>.
          </p>
        </section>
      </div>
    </div>
  )
}

