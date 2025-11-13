import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { IconCode, IconCheck, IconAlertCircle, IconExternalLink, IconSettings } from '@tabler/icons-react'

export default function WebhookGuide() {
  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Hướng dẫn tích hợp Webhooks</CardTitle>
          <CardDescription>
            Tài liệu hướng dẫn chi tiết cách cấu hình và tích hợp webhook của Payhook để đồng bộ giao dịch ngân hàng vào hệ thống riêng của bạn (POS, CRM, ERP, v.v.).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tổng quan */}
          <div>
            <h3 className="font-semibold text-lg mb-3">1. Tổng quan</h3>
            <p className="text-gray-600 mb-3">
              Khi Payhook quét email ngân hàng và phát hiện giao dịch mới, hệ thống sẽ lập tức gửi một yêu cầu <code className="bg-gray-100 px-2 py-1 rounded text-sm">POST</code> chứa thông tin giao dịch đến địa chỉ webhook mà bạn cấu hình.
            </p>
            <p className="text-gray-600 mb-3">Nhờ vậy, ứng dụng của bạn có thể:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600 ml-4">
              <li>Tự động đổi trạng thái đơn hàng sang "đã thanh toán"</li>
              <li>Gửi thông báo nội bộ, kích hoạt workflow tự động</li>
              <li>Đồng bộ dữ liệu giao dịch với các hệ thống kế toán/BI khác</li>
            </ul>
            <Alert className="mt-3">
              <IconAlertCircle className="h-4 w-4" />
              <AlertDescription>
                Payhook tích hợp cơ chế retry tối đa <strong>5 lần</strong> với Fibonacci delay (10s → 10s → 20s → 30s → 50s) nếu webhook trả về lỗi hoặc không phản hồi.
              </AlertDescription>
            </Alert>
            <Alert className="mt-3 bg-blue-50 border-blue-200">
              <IconAlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Cơ chế xác minh đơn hàng:</strong> Payhook chỉ bắn webhook khi nội dung chuyển khoản chứa mã đơn hàng theo định dạng <code className="bg-blue-100 px-1 rounded text-xs">PAYHOOKxxx</code> (ví dụ: <code className="bg-blue-100 px-1 rounded text-xs">PAYHOOK123</code>). 
                Lưu ý: Ngân hàng CAKE không cho phép dấu gạch dưới (_) trong nội dung, nên sử dụng format không có dấu gạch dưới. 
                Điều này đảm bảo chỉ các giao dịch có liên quan đến đơn hàng cụ thể mới được xử lý, tránh nhầm lẫn khi có nhiều giao dịch cùng số tiền.
              </AlertDescription>
            </Alert>
          </div>

          {/* Cấu hình */}
          <div>
            <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <IconSettings className="w-5 h-5" />
              2. Các bước cấu hình trên Payhook
            </h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2 text-gray-700">Trên giao diện Dashboard</h4>
                <ol className="list-decimal list-inside space-y-2 text-gray-600 ml-4">
                  <li>Đăng nhập Payhook với tài khoản của bạn</li>
                  <li>Vào menu <strong>Cấu hình Email</strong> → chọn cấu hình hiện có hoặc nhấn <strong>Thêm cấu hình</strong></li>
                  <li>Nhập/kiểm tra các trường sau:
                    <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                      <li><strong>Email:</strong> Gmail nhận thông báo ngân hàng</li>
                      <li><strong>App Password:</strong> Mật khẩu ứng dụng Gmail tương ứng</li>
                      <li><strong>Webhook URL:</strong> Địa chỉ HTTPS của webhook nhận giao dịch (ví dụ <code className="bg-gray-100 px-1 rounded text-xs">https://pos.example.com/webhook/payhook</code>)</li>
                      <li><strong>Scan Interval</strong> (tùy chọn): chu kỳ quét email (1000 = 1 giây)</li>
                    </ul>
                  </li>
                  <li>Nhấn <strong>Lưu</strong>. Kể từ lúc này, mỗi giao dịch mới đọc được từ hộp thư sẽ được gửi tới webhook</li>
                </ol>
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mt-3">
                  <p className="text-sm text-blue-800">
                    <strong>Mẹo:</strong> Khi muốn chỉnh sửa webhook, nhấn nút <strong>Sửa</strong> tại cấu hình tương ứng, cập nhật URL rồi lưu lại.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Thông tin yêu cầu */}
          <div>
            <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <IconCode className="w-5 h-5" />
              3. Thông tin yêu cầu Webhook
            </h3>
            <div className="overflow-x-auto border border-gray-200 rounded-md">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Thuộc tính</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Giá trị</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">Method</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">POST</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">Header</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">
                      Content-Type: application/json<br />
                      User-Agent: Payhook/1.0
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">Timeout</td>
                    <td className="px-4 py-3 text-sm text-gray-600">10 giây</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">Retry</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Tối đa 5 lần với Fibonacci delay: 10s → 10s → 20s → 30s → 50s nếu lỗi mạng hoặc không nhận mã 2xx</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4">
              <h4 className="font-medium mb-2 text-gray-700">3.1. Cấu trúc JSON gửi đi</h4>
              <div className="bg-gray-900 text-gray-100 rounded-md p-4 font-mono text-sm overflow-x-auto">
                <pre className="text-gray-300">
{`{
  "event": "transaction.detected",
  "timestamp": "2025-11-12T12:34:56.789Z",
  "orderId": "123",
  "transaction": {
    "_id": "6743b5e7f1d3cfa1e3b12345",
    "userId": "6720e9cbe2a7496d4b123456",
    "emailConfigId": "6720ea3de2a7496d4b654321",
    "transactionId": "FT123456789",
    "bank": "CAKE",
    "amountVND": 1500000,
    "description": "PAYHOOK123",
    "emailUid": 1234,
    "emailDate": "2025-11-12T12:33:45.000Z",
    "detectedAt": "2025-11-12T12:34:56.789Z",
    "createdAt": "2025-11-12T12:34:56.789Z",
    "rawAmount": "1.500.000",
    "accountNumber": "0123456789"
  }
}`}
                </pre>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mt-3">
                <p className="text-sm text-yellow-800">
                  <strong>Ghi chú:</strong> 
                </p>
                <ul className="list-disc list-inside text-sm text-yellow-800 mt-1 ml-4 space-y-1">
                  <li>Trường <code className="bg-yellow-100 px-1 rounded">transactionId</code> và <code className="bg-yellow-100 px-1 rounded">emailUid</code> có thể dùng để chống xử lý trùng.</li>
                  <li>Trường <code className="bg-yellow-100 px-1 rounded">orderId</code> được trích xuất từ <code className="bg-yellow-100 px-1 rounded">description</code> nếu chứa <code className="bg-yellow-100 px-1 rounded">PAYHOOKxxx</code> (ví dụ: <code className="bg-yellow-100 px-1 rounded">PAYHOOK123</code>).</li>
                  <li><strong>Quan trọng:</strong> Webhook chỉ được bắn khi <code className="bg-yellow-100 px-1 rounded">description</code> chứa mã đơn hàng theo định dạng <code className="bg-yellow-100 px-1 rounded">PAYHOOKxxx</code> (không có dấu gạch dưới vì ngân hàng CAKE không cho phép).</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Yêu cầu phản hồi */}
          <div>
            <h3 className="font-semibold text-lg mb-3">4. Yêu cầu phản hồi từ hệ thống nhận</h3>
            <div className="overflow-x-auto border border-gray-200 rounded-md">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Trường hợp</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Hành vi Payhook</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">HTTP 2xx (200/201/204)</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Xem là thành công, dừng retry</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">HTTP 4xx</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Không retry (giả định payload không hợp lệ)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">HTTP 5xx hoặc timeout</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Retry tối đa 5 lần với Fibonacci delay: 10s → 10s → 20s → 30s → 50s</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">Ví dụ phản hồi hợp lệ:</p>
              <div className="bg-gray-900 text-gray-100 rounded-md p-4 font-mono text-sm">
                <pre className="text-gray-300">{`{\n  "success": true\n}`}</pre>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Hãy bảo đảm webhook trả lời trong vòng 10 giây. Nếu cần xử lý lâu, nên xếp công việc vào hàng đợi rồi phản hồi ngay.
              </p>
            </div>
          </div>

          {/* Ví dụ code */}
          <div>
            <h3 className="font-semibold text-lg mb-3">5. Ví dụ code nhận webhook</h3>
            <div className="bg-gray-900 text-gray-100 rounded-md p-4 font-mono text-sm overflow-x-auto">
              <pre className="text-gray-300">
{`const express = require('express');
const app = express();

app.use(express.json());

app.post('/webhook/payhook', async (req, res) => {
  const { event, transaction, orderId } = req.body;

  if (event !== 'transaction.detected' || !transaction?.transactionId) {
    return res.status(400).json({ error: 'Payload không hợp lệ' });
  }

  // Kiểm tra orderId từ description PAYHOOKxxx
  if (!orderId) {
    return res.status(400).json({ error: 'Không tìm thấy mã đơn hàng trong description' });
  }

  const {
    transactionId,
    amountVND,
    description,
    detectedAt
  } = transaction;

  // Xác minh đơn hàng: tìm đơn hàng theo orderId và kiểm tra số tiền
  const order = await findOrderById(orderId);
  if (!order) {
    return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  }

  if (order.total_amount !== amountVND) {
    return res.status(400).json({ error: 'Số tiền không khớp với đơn hàng' });
  }

  if (order.payment_status === 'paid') {
    return res.json({ success: true, message: 'Đơn hàng đã được thanh toán trước đó' });
  }

  // Cập nhật trạng thái thanh toán
  await markOrderAsPaid(orderId, transactionId, amountVND, detectedAt);

  return res.json({ success: true });
});

app.listen(3000, () => console.log('Webhook server listening on port 3000'));`}
              </pre>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-md p-3 mt-3">
              <p className="text-sm text-green-800">
                <strong>Lưu ý:</strong> Code mẫu trên đã bao gồm logic xác minh đơn hàng:
              </p>
              <ul className="list-disc list-inside text-sm text-green-800 mt-1 ml-4 space-y-1">
                <li>Kiểm tra <code className="bg-green-100 px-1 rounded">orderId</code> từ webhook payload</li>
                <li>Xác minh đơn hàng tồn tại trong hệ thống</li>
                <li>Kiểm tra số tiền khớp với đơn hàng</li>
                <li>Tránh xử lý trùng nếu đơn hàng đã thanh toán</li>
              </ul>
            </div>
          </div>

          {/* Khuyến nghị bảo mật */}
          <div>
            <h3 className="font-semibold text-lg mb-3">6. Khuyến nghị bảo mật</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-600 ml-4">
              <li>Sử dụng HTTPS cho webhook</li>
              <li>Xác thực nguồn gửi (ví dụ kiểm tra IP, dùng secret trong header, hoặc ký chữ ký HMAC)</li>
              <li><strong>Luôn kiểm tra <code className="bg-gray-100 px-1 rounded text-xs">orderId</code> và <code className="bg-gray-100 px-1 rounded text-xs">amountVND</code>:</strong> Đối chiếu với đơn hàng trong hệ thống để tránh cập nhật nhầm</li>
              <li>Kiểm tra trạng thái đơn hàng (chỉ cập nhật nếu đang ở trạng thái "pending")</li>
              <li>Ghi log chi tiết (thời gian nhận, payload, trạng thái xử lý) để dễ truy vết</li>
              <li>Sử dụng cơ chế idempotency (xử lý trùng) dựa trên <code className="bg-gray-100 px-1 rounded text-xs">transactionId</code> hoặc <code className="bg-gray-100 px-1 rounded text-xs">orderId</code></li>
            </ul>
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mt-3">
              <p className="text-sm text-red-800">
                <strong>⚠️ Cảnh báo:</strong> Nếu không kiểm tra <code className="bg-red-100 px-1 rounded text-xs">orderId</code> và số tiền, hệ thống có thể nhầm lẫn khi có nhiều giao dịch cùng số tiền. 
                Luôn xác minh đơn hàng trước khi cập nhật trạng thái thanh toán.
              </p>
            </div>
          </div>

          <Alert className="bg-green-50 border-green-200">
            <IconCheck className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>Chúc bạn tích hợp thành công!</strong> Nếu có thắc mắc, vui lòng liên hệ đội ngũ Payhook.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}

