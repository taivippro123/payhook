import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { IconCode, IconCheck, IconAlertCircle, IconExternalLink, IconSettings, IconCopy, IconSparkles } from '@tabler/icons-react'

export default function WebhookGuide() {
  const [copied, setCopied] = useState(false)

  const generateMarkdown = () => {
    return `# Hướng dẫn tích hợp Webhooks - Payhook

Tài liệu hướng dẫn chi tiết cách cấu hình và tích hợp webhook của Payhook để đồng bộ giao dịch ngân hàng vào hệ thống riêng của bạn (POS, CRM, ERP, v.v.).

## 1. Tổng quan

Ngay khi Gmail gửi push notification cho Payhook về một email giao dịch mới, hệ thống sẽ lập tức gửi một yêu cầu POST chứa thông tin giao dịch đến địa chỉ webhook mà bạn cấu hình.

Nhờ vậy, ứng dụng của bạn có thể:
- Tự động đổi trạng thái đơn hàng sang "đã thanh toán"
- Gửi thông báo nội bộ, kích hoạt workflow tự động
- Đồng bộ dữ liệu giao dịch với các hệ thống kế toán/BI khác

**Lưu ý:** Payhook tích hợp cơ chế retry tối đa 5 lần với Fibonacci delay (10s → 10s → 20s → 30s → 50s) nếu webhook trả về lỗi hoặc không phản hồi. Nếu vẫn thất bại sau 5 lần retry, webhook sẽ được đưa vào Dead Letter Queue và tự động retry lại sau 1h, 2h, 4h, 8h (tối đa 3 lần nữa).

**Cơ chế xác minh đơn hàng:** Payhook chỉ bắn webhook khi nội dung chuyển khoản chứa mã đơn hàng theo định dạng PAYHOOKxxx (ví dụ: PAYHOOK123). Điều này đảm bảo chỉ các giao dịch có liên quan đến đơn hàng cụ thể mới được xử lý, tránh nhầm lẫn khi có nhiều giao dịch cùng số tiền.

## 2. Các bước cấu hình trên Payhook

### Trên giao diện Dashboard

1. Đăng nhập Payhook với tài khoản của bạn.
2. Nhấn **Kết nối Gmail** trên Dashboard → Google mở trang xác nhận quyền → chọn đúng tài khoản Gmail CAKE và bấm **Allow**.
3. Sau khi quay lại Payhook, Gmail của bạn sẽ hiển thị trong danh sách cấu hình. Nhập **Webhook URL** (ví dụ: https://pos.example.com/webhook/payhook) và nhấn **Lưu webhook**.

   **Lưu ý:** Webhook URL phải sử dụng HTTPS và là domain name (không được dùng IP address, localhost, hoặc private IPs trong production). Nếu URL không hợp lệ, hệ thống sẽ hiển thị thông báo lỗi cụ thể.

4. Theo dõi nhãn thời gian "Hết hạn trong ...". Payhook auto gia hạn trước khi hết hạn, nếu trạng thái báo lỗi hãy kết nối lại Gmail.

## 3. Thông tin yêu cầu Webhook

| Thuộc tính | Giá trị |
|------------|---------|
| Method | POST |
| Header | Content-Type: application/json<br>User-Agent: Payhook/1.0<br>X-Payhook-Signature: [HMAC-SHA256 signature]<br>X-Payhook-Timestamp: [Unix timestamp in milliseconds] |
| Webhook URL | • Phải sử dụng HTTPS (trừ localhost trong development)<br>• Chỉ chấp nhận domain names (không chấp nhận IP addresses)<br>• Không cho phép localhost, private IPs trong production<br>• Chỉ cho phép ports 80 và 443 (standard ports) |
| Rate Limit | Tối đa 1000 webhooks/giờ cho mỗi user. Nếu vượt quá, webhook sẽ bị từ chối với thông báo lỗi. |
| Timeout | 10 giây |
| Retry | Tối đa 5 lần với Fibonacci delay: 10s → 10s → 20s → 30s → 50s nếu lỗi mạng hoặc không nhận mã 2xx |

### 3.1. Cấu trúc JSON gửi đi

\`\`\`json
{
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
}
\`\`\`

**Ghi chú:**
- Trường \`transactionId\` và \`emailUid\` có thể dùng để chống xử lý trùng.
- Trường \`orderId\` được trích xuất từ \`description\` nếu chứa \`PAYHOOKxxx\` (ví dụ: \`PAYHOOK123\`).
- **Quan trọng:** Webhook chỉ được bắn khi \`description\` chứa mã đơn hàng theo định dạng \`PAYHOOKxxx\`

## 4. Yêu cầu phản hồi từ hệ thống nhận

| Trường hợp | Hành vi Payhook |
|------------|----------------|
| HTTP 2xx (200/201/204) | Xem là thành công, dừng retry |
| HTTP 4xx | Không retry (giả định payload không hợp lệ) |
| HTTP 5xx hoặc timeout | Retry tối đa 5 lần với Fibonacci delay: 10s → 10s → 20s → 30s → 50s |

**Ví dụ phản hồi hợp lệ:**
\`\`\`json
{
  "success": true
}
\`\`\`

Hãy bảo đảm webhook trả lời trong vòng 10 giây. Nếu cần xử lý lâu, nên xếp công việc vào hàng đợi rồi phản hồi ngay.

## 5. Ví dụ code nhận webhook

\`\`\`javascript
const express = require('express');
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

app.listen(3000, () => {
  // Webhook server listening
});
\`\`\`

## 6. Xác thực Webhook (Webhook Signature)

Payhook tự động tạo một **webhook secret** duy nhất cho mỗi email config khi bạn thiết lập webhook URL. **Payhook server sẽ gửi signature trong header** mỗi khi gửi webhook request đến URL của bạn. Bạn sử dụng secret này để verify signature và xác thực rằng request thực sự đến từ Payhook.

**Hướng gửi:** Payhook server → Your webhook endpoint (không phải ngược lại). Header \`X-Payhook-Signature\` được Payhook gửi kèm trong mỗi webhook request.

**Headers:**
- X-Payhook-Signature: <HMAC-SHA256 signature>
- X-Payhook-Timestamp: <Unix timestamp in milliseconds>

### Cách verify signature (Node.js/Express):

Khi Payhook gửi webhook request đến endpoint của bạn, bạn cần verify signature để đảm bảo request đến từ Payhook:

\`\`\`javascript
const crypto = require('crypto');

// Endpoint nhận webhook từ Payhook
app.post('/webhook/payhook', express.raw({ type: 'application/json' }), (req, res) => {
  // Payhook gửi signature trong header này
  const signature = req.headers['x-payhook-signature'];
  const timestamp = req.headers['x-payhook-timestamp'];
  
  // Lấy secret từ dashboard Payhook (lưu trong biến môi trường)
  const webhookSecret = process.env.PAYHOOK_WEBHOOK_SECRET;
  
  if (!signature || !webhookSecret) {
    return res.status(401).json({ error: 'Missing signature or secret' });
  }
  
  // Tạo expected signature từ payload nhận được
  const payload = req.body.toString();
  const hmac = crypto.createHmac('sha256', webhookSecret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  
  // So sánh signature (constant-time comparison để tránh timing attack)
  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
  
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature - request không đến từ Payhook' });
  }
  
  // Kiểm tra timestamp để chống replay attack (tùy chọn nhưng khuyến nghị)
  const requestTime = parseInt(timestamp, 10);
  const now = Date.now();
  if (Math.abs(now - requestTime) > 5 * 60 * 1000) { // 5 phút
    return res.status(401).json({ error: 'Request timestamp too old' });
  }
  
  // Signature hợp lệ, parse JSON và xử lý webhook
  const data = JSON.parse(payload);
  // Xử lý webhook...
  
  res.json({ success: true });
});
\`\`\`

**Lưu ý:** Webhook secret được tạo tự động và chỉ hiển thị một lần khi bạn thiết lập webhook URL. Hãy lưu secret này vào biến môi trường hoặc secure storage. Nếu mất secret, bạn có thể tạo lại bằng cách cập nhật webhook URL.

## 7. Khuyến nghị bảo mật

- **Luôn verify webhook signature:** Sử dụng header \`X-Payhook-Signature\` để xác thực request đến từ Payhook
- Sử dụng HTTPS cho webhook (bắt buộc trong production)
- **Luôn kiểm tra \`orderId\` và \`amountVND\`:** Đối chiếu với đơn hàng trong hệ thống để tránh cập nhật nhầm
- Kiểm tra trạng thái đơn hàng (chỉ cập nhật nếu đang ở trạng thái "pending")
- Ghi log chi tiết (thời gian nhận, payload, trạng thái xử lý) để dễ truy vết
- Sử dụng cơ chế idempotency (xử lý trùng) dựa trên \`transactionId\` hoặc \`orderId\`
- Xử lý rate limiting: Payhook giới hạn 1000 webhooks/giờ cho mỗi user. Nếu vượt quá, hãy kiểm tra và tối ưu logic xử lý

**⚠️ Cảnh báo:** Nếu không kiểm tra \`orderId\` và số tiền, hệ thống có thể nhầm lẫn khi có nhiều giao dịch cùng số tiền. Luôn xác minh đơn hàng trước khi cập nhật trạng thái thanh toán.

## 8. Dead Letter Queue (DLQ)

Nếu webhook thất bại sau 5 lần retry ban đầu, Payhook sẽ tự động đưa vào **Dead Letter Queue** để retry lại sau.

| Lần retry | Thời gian chờ | Mô tả |
|-----------|---------------|-------|
| 1 | 1 giờ | Retry lần đầu sau khi thất bại |
| 2 | 2 giờ | Retry lần 2 (exponential backoff) |
| 3 | 4 giờ | Retry lần 3 (exponential backoff) |

**Lưu ý:** Sau 3 lần retry từ DLQ, nếu vẫn thất bại, webhook sẽ được đánh dấu là **failed**. Bạn có thể xem chi tiết trong Webhook Logs trên dashboard. Các entries cũ hơn 30 ngày sẽ tự động bị xóa.

---

**Chúc bạn tích hợp thành công!** Nếu có thắc mắc, vui lòng liên hệ đội ngũ Payhook.`
  }

  const handleCopyMarkdown = async () => {
    try {
      const markdown = generateMarkdown()
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy markdown:', error)
      alert('Không thể copy markdown. Vui lòng thử lại.')
    }
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-xl">Hướng dẫn tích hợp Webhooks</CardTitle>
              <CardDescription>
                Tài liệu hướng dẫn chi tiết cách cấu hình và tích hợp webhook của Payhook để đồng bộ giao dịch ngân hàng vào hệ thống riêng của bạn (POS, CRM, ERP, v.v.).
              </CardDescription>
            </div>
            <Button
              onClick={handleCopyMarkdown}
              variant="outline"
              className="shrink-0"
            >
              {copied ? (
                <>
                  <IconCheck className="h-4 w-4 mr-2" />
                  Đã copy!
                </>
              ) : (
                <>
                  <IconCopy className="h-4 w-4 mr-2" />
                  Copy as Markdown
                </>
              )}
            </Button>
          </div>
          <Alert className="mt-4 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
            <IconSparkles className="h-4 w-4 text-purple-600" />
            <AlertDescription className="text-purple-800">
              <strong>💡 Mẹo:</strong> Bạn có thể bấm <strong>"Copy as Markdown"</strong> ở trên để copy toàn bộ tài liệu này và dán cho AI (ChatGPT, Claude, v.v.) để được hỗ trợ tích hợp webhook theo đúng tài liệu Payhook.
            </AlertDescription>
          </Alert>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tổng quan */}
          <div>
            <h3 className="font-semibold text-lg mb-3">1. Tổng quan</h3>
            <p className="text-gray-600 mb-3">
              Ngay khi Gmail gửi push notification cho Payhook về một email giao dịch mới, hệ thống sẽ lập tức gửi một yêu cầu <code className="bg-gray-100 px-2 py-1 rounded text-sm">POST</code> chứa thông tin giao dịch đến địa chỉ webhook mà bạn cấu hình.
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
                Nếu vẫn thất bại sau 5 lần retry, webhook sẽ được đưa vào <strong>Dead Letter Queue</strong> và tự động retry lại sau 1h, 2h, 4h, 8h (tối đa 3 lần nữa).
              </AlertDescription>
            </Alert>
            <Alert className="mt-3 bg-blue-50 border-blue-200">
              <IconAlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Cơ chế xác minh đơn hàng:</strong> Payhook chỉ bắn webhook khi nội dung chuyển khoản chứa mã đơn hàng theo định dạng <code className="bg-blue-100 px-1 rounded text-xs">PAYHOOKxxx</code> (ví dụ: <code className="bg-blue-100 px-1 rounded text-xs">PAYHOOK123</code>).
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
                  <li>Đăng nhập Payhook với tài khoản của bạn.</li>
                  <li>Nhấn <strong>Kết nối Gmail</strong> trên Dashboard → Google mở trang xác nhận quyền → chọn đúng tài khoản Gmail CAKE và bấm <strong>Allow</strong>.</li>
                  <li>Sau khi quay lại Payhook, Gmail của bạn sẽ hiển thị trong danh sách cấu hình. Nhập <strong>Webhook URL</strong> (ví dụ <code className="bg-gray-100 px-1 rounded text-xs">https://pos.example.com/webhook/payhook</code>) và nhấn <strong>Lưu webhook</strong>.
                    <Alert className="mt-2 bg-yellow-50 border-yellow-200">
                      <IconAlertCircle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-yellow-800 text-sm">
                        <strong>Lưu ý:</strong> Webhook URL phải sử dụng HTTPS và là domain name (không được dùng IP address, localhost, hoặc private IPs trong production).
                        Nếu URL không hợp lệ, hệ thống sẽ hiển thị thông báo lỗi cụ thể.
                      </AlertDescription>
                    </Alert>
                  </li>
                  <li>Theo dõi nhãn thời gian “Hết hạn trong ...”. Payhook auto gia hạn trước khi hết hạn, nếu trạng thái báo lỗi hãy kết nối lại Gmail.</li>
                </ol>

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
                      User-Agent: Payhook/1.0<br />
                      X-Payhook-Signature: [HMAC-SHA256 signature]<br />
                      X-Payhook-Timestamp: [Unix timestamp]
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">Webhook URL</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <strong>Yêu cầu:</strong><br />
                      • Phải sử dụng HTTPS (trừ localhost trong development)<br />
                      • Chỉ chấp nhận domain names (không chấp nhận IP addresses)<br />
                      • Không cho phép localhost, private IPs trong production<br />
                      • Chỉ cho phép ports 80 và 443 (standard ports)
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">Rate Limit</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      Tối đa <strong>1000 webhooks/giờ</strong> cho mỗi user. Nếu vượt quá, webhook sẽ bị từ chối với thông báo lỗi.
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
                  <li><strong>Quan trọng:</strong> Webhook chỉ được bắn khi <code className="bg-yellow-100 px-1 rounded">description</code> chứa mã đơn hàng theo định dạng <code className="bg-yellow-100 px-1 rounded">PAYHOOKxxx</code></li>
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

app.listen(3000, () => {
  // Webhook server listening
});`}
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

          {/* Webhook Signature */}
          <div>
            <h3 className="font-semibold text-lg mb-3">6. Xác thực Webhook (Webhook Signature)</h3>
            <p className="text-gray-600 mb-3">
              Payhook tự động tạo một <strong>webhook secret</strong> duy nhất cho mỗi email config khi bạn thiết lập webhook URL.
              <strong> Payhook server sẽ gửi signature trong header</strong> mỗi khi gửi webhook request đến URL của bạn.
              Bạn sử dụng secret này để verify signature và xác thực rằng request thực sự đến từ Payhook.
            </p>
            <Alert className="bg-blue-50 border-blue-200 mb-3">
              <IconAlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Hướng gửi:</strong> Payhook server → Your webhook endpoint (không phải ngược lại).
                Header <code className="bg-blue-100 px-1 rounded text-xs">X-Payhook-Signature</code> được Payhook gửi kèm trong mỗi webhook request.
              </AlertDescription>
            </Alert>
            <div className="bg-gray-900 text-gray-100 rounded-md p-4 font-mono text-sm overflow-x-auto mb-3">
              <pre className="text-gray-300">
                {`Headers:
X-Payhook-Signature: <HMAC-SHA256 signature>
X-Payhook-Timestamp: <Unix timestamp in milliseconds>`}
              </pre>
            </div>
            <h4 className="font-medium mb-2 text-gray-700">Cách verify signature (Node.js/Express):</h4>
            <p className="text-sm text-gray-600 mb-2">
              Khi Payhook gửi webhook request đến endpoint của bạn, bạn cần verify signature để đảm bảo request đến từ Payhook:
            </p>
            <div className="bg-gray-900 text-gray-100 rounded-md p-4 font-mono text-sm overflow-x-auto">
              <pre className="text-gray-300">
                {`const crypto = require('crypto');

// Endpoint nhận webhook từ Payhook
app.post('/webhook/payhook', express.raw({ type: 'application/json' }), (req, res) => {
  // Payhook gửi signature trong header này
  const signature = req.headers['x-payhook-signature'];
  const timestamp = req.headers['x-payhook-timestamp'];
  
  // Lấy secret từ dashboard Payhook (lưu trong biến môi trường)
  const webhookSecret = process.env.PAYHOOK_WEBHOOK_SECRET;
  
  if (!signature || !webhookSecret) {
    return res.status(401).json({ error: 'Missing signature or secret' });
  }
  
  // Tạo expected signature từ payload nhận được
  const payload = req.body.toString();
  const hmac = crypto.createHmac('sha256', webhookSecret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  
  // So sánh signature (constant-time comparison để tránh timing attack)
  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
  
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature - request không đến từ Payhook' });
  }
  
  // Signature hợp lệ, parse JSON và xử lý webhook
  const data = JSON.parse(payload);
  // Xử lý webhook...
  
  res.json({ success: true });
});`}
              </pre>
            </div>
            <Alert className="mt-3 bg-blue-50 border-blue-200">
              <IconAlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Lưu ý:</strong> Webhook secret được tạo tự động và chỉ hiển thị một lần khi bạn thiết lập webhook URL.
                Hãy lưu secret này vào biến môi trường hoặc secure storage. Nếu mất secret, bạn có thể tạo lại bằng cách cập nhật webhook URL.
              </AlertDescription>
            </Alert>
          </div>

          {/* Khuyến nghị bảo mật */}
          <div>
            <h3 className="font-semibold text-lg mb-3">7. Khuyến nghị bảo mật</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-600 ml-4">
              <li><strong>Luôn verify webhook signature:</strong> Sử dụng header <code className="bg-gray-100 px-1 rounded text-xs">X-Payhook-Signature</code> để xác thực request đến từ Payhook</li>
              <li>Sử dụng HTTPS cho webhook (bắt buộc trong production)</li>
              <li><strong>Luôn kiểm tra <code className="bg-gray-100 px-1 rounded text-xs">orderId</code> và <code className="bg-gray-100 px-1 rounded text-xs">amountVND</code>:</strong> Đối chiếu với đơn hàng trong hệ thống để tránh cập nhật nhầm</li>
              <li>Kiểm tra trạng thái đơn hàng (chỉ cập nhật nếu đang ở trạng thái "pending")</li>
              <li>Ghi log chi tiết (thời gian nhận, payload, trạng thái xử lý) để dễ truy vết</li>
              <li>Sử dụng cơ chế idempotency (xử lý trùng) dựa trên <code className="bg-gray-100 px-1 rounded text-xs">transactionId</code> hoặc <code className="bg-gray-100 px-1 rounded text-xs">orderId</code></li>
              <li>Xử lý rate limiting: Payhook giới hạn 1000 webhooks/giờ cho mỗi user. Nếu vượt quá, hãy kiểm tra và tối ưu logic xử lý</li>
            </ul>
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mt-3">
              <p className="text-sm text-red-800">
                <strong>⚠️ Cảnh báo:</strong> Nếu không kiểm tra <code className="bg-red-100 px-1 rounded text-xs">orderId</code> và số tiền, hệ thống có thể nhầm lẫn khi có nhiều giao dịch cùng số tiền.
                Luôn xác minh đơn hàng trước khi cập nhật trạng thái thanh toán.
              </p>
            </div>
          </div>

          {/* Dead Letter Queue */}
          <div>
            <h3 className="font-semibold text-lg mb-3">8. Dead Letter Queue (DLQ)</h3>
            <p className="text-gray-600 mb-3">
              Nếu webhook thất bại sau 5 lần retry ban đầu, Payhook sẽ tự động đưa vào <strong>Dead Letter Queue</strong> để retry lại sau.
            </p>
            <div className="overflow-x-auto border border-gray-200 rounded-md mb-3">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Lần retry</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Thời gian chờ</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Mô tả</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">1</td>
                    <td className="px-4 py-3 text-sm text-gray-600">1 giờ</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Retry lần đầu sau khi thất bại</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">2</td>
                    <td className="px-4 py-3 text-sm text-gray-600">2 giờ</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Retry lần 2 (exponential backoff)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">3</td>
                    <td className="px-4 py-3 text-sm text-gray-600">4 giờ</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Retry lần 3 (exponential backoff)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <Alert className="bg-yellow-50 border-yellow-200">
              <IconAlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <strong>Lưu ý:</strong> Sau 3 lần retry từ DLQ, nếu vẫn thất bại, webhook sẽ được đánh dấu là <strong>failed</strong>.
                Bạn có thể xem chi tiết trong Webhook Logs trên dashboard. Các entries cũ hơn 30 ngày sẽ tự động bị xóa.
              </AlertDescription>
            </Alert>
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

