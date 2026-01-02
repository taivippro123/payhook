import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { IconCode, IconCheck, IconAlertCircle, IconExternalLink, IconSettings, IconCopy, IconSparkles, IconRobot } from '@tabler/icons-react'

export default function XiaozhiGuide() {
  const [copied, setCopied] = useState(false)

  const generateMarkdown = () => {
    return `# Hướng dẫn tích hợp Xiaozhi với Payhook

Tài liệu hướng dẫn chi tiết cách cấu hình Xiaozhi AI để nhận thông báo giao dịch từ Payhook qua MCP (Model Context Protocol).

## 1. Tổng quan

Xiaozhi là một AI assistant có thể được tích hợp với Payhook để tự động thông báo khi có giao dịch mới. Khi có giao dịch, Payhook sẽ gửi thông báo qua WebSocket tới Xiaozhi MCP, và AI sẽ đọc số tiền: "Đã nhận ... đồng".

## 2. Các bước cấu hình

### Bước 1: Truy cập Xiaozhi Dashboard

1. Truy cập https://xiaozhi.me/
2. Đăng nhập vào tài khoản của bạn
3. Chọn **"Bảng điều khiển"** (Console)

### Bước 2: Cấu hình vai trò

1. Trong bảng điều khiển, tìm phần **"Cấu hình vai trò"** hoặc **"Role Configuration"**
2. Cấu hình vai trò cho AI assistant của bạn (nếu chưa có)

### Bước 3: Cài đặt MCP

1. Tìm phần **"Cài đặt MCP"** hoặc **"MCP Settings"** trong bảng điều khiển
2. Bấm vào **"Lấy điểm cuối MCP"** (Get MCP Endpoint)
3. Một modal sẽ hiển thị với URL điểm cuối MCP (dạng: \`wss://api.xiaozhi.me/mcp/?token=...\`)
4. Bấm **"Sao chép"** (Copy) để copy URL này

### Bước 4: Cấu hình trên Payhook Dashboard

1. Quay lại Payhook Dashboard
2. Tìm phần **"Xiaozhi MCP URL"** trong cấu hình Gmail của bạn
3. Bấm **"Thêm Xiaozhi MCP"** hoặc **"Chỉnh sửa"** (nếu đã có)
4. Dán URL đã copy từ Xiaozhi vào ô input
5. Bấm **"Lưu"** để lưu cấu hình

### Bước 5: Làm mới và kiểm tra

1. Sau khi lưu, bấm **"Làm mới"** (Refresh) trong Xiaozhi Dashboard
2. Kiểm tra xem đã hiển thị 2 tool:
   - \`check_unnotified_payment\` - Kiểm tra giao dịch chưa thông báo
   - \`check_payment_status\` - Kiểm tra trạng thái thanh toán

## 3. Sử dụng

Sau khi cấu hình xong, bạn có thể hỏi AI Xiaozhi:

**"Có giao dịch mới không?"**

AI Xiaozhi sẽ tự động kiểm tra và trả lời về các giao dịch mới nhất từ Payhook.

## 4. Cách hoạt động

- Khi có giao dịch mới từ Payhook, hệ thống sẽ gửi thông báo qua WebSocket tới Xiaozhi MCP
- AI Xiaozhi sẽ nhận được thông báo và có thể đọc số tiền: "Đã nhận ... đồng"
- Bạn có thể hỏi AI về giao dịch bất cứ lúc nào

## 5. Troubleshooting

### Không thấy 2 tool sau khi làm mới

- Kiểm tra lại URL MCP đã đúng chưa
- Đảm bảo đã lưu cấu hình trên Payhook Dashboard
- Thử xóa đi và thêm lại Xiaozhi MCP URL trên Payhook Dashboard

### AI không trả lời về giao dịch

- Kiểm tra xem đã có giao dịch mới trong Payhook chưa
- Kiểm tra kết nối WebSocket giữa Payhook và Xiaozhi
- Xem lại cấu hình MCP URL trên Payhook Dashboard

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
              <CardTitle className="text-xl flex items-center gap-2">
                <IconRobot className="w-6 h-6" />
                Hướng dẫn tích hợp Xiaozhi
              </CardTitle>
              <CardDescription>
                Tài liệu hướng dẫn chi tiết cách cấu hình Xiaozhi AI để nhận thông báo giao dịch từ Payhook qua MCP (Model Context Protocol).
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
              <strong>💡 Mẹo:</strong> Bạn có thể bấm <strong>"Copy as Markdown"</strong> ở trên để copy toàn bộ tài liệu này và dán cho AI (ChatGPT, Claude, v.v.) để được hỗ trợ tích hợp Xiaozhi theo đúng tài liệu Payhook.
            </AlertDescription>
          </Alert>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tổng quan */}
          <div>
            <h3 className="font-semibold text-lg mb-3">1. Tổng quan</h3>
            <p className="text-gray-600 mb-3">
              Xiaozhi là một AI assistant có thể được tích hợp với Payhook để tự động thông báo khi có giao dịch mới. 
              Khi có giao dịch, Payhook sẽ gửi thông báo qua WebSocket tới Xiaozhi MCP, và AI sẽ đọc số tiền: <strong>"Đã nhận ... đồng"</strong>.
            </p>
          </div>

          {/* Các bước cấu hình */}
          <div>
            <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <IconSettings className="w-5 h-5" />
              2. Các bước cấu hình
            </h3>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold">
                  1
                </div>
                <div className="flex-1">
                  <h4 className="font-medium mb-2 text-gray-700">Truy cập Xiaozhi Dashboard</h4>
                  <ol className="list-decimal list-inside space-y-1 text-gray-600 ml-4">
                    <li>Truy cập <a href="https://xiaozhi.me/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 font-medium">https://xiaozhi.me/</a></li>
                    <li>Đăng nhập vào tài khoản của bạn</li>
                    <li>Chọn <strong>"Bảng điều khiển"</strong> (Dashboard)</li>
                  </ol>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold">
                  2
                </div>
                <div className="flex-1">
                  <h4 className="font-medium mb-2 text-gray-700">Cấu hình vai trò</h4>
                  <p className="text-gray-600">
                    Trong bảng điều khiển, tìm phần <strong>"Cấu hình vai trò"</strong> hoặc <strong>"Role Configuration"</strong> và cấu hình vai trò cho AI assistant của bạn (nếu chưa có).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold">
                  3
                </div>
                <div className="flex-1">
                  <h4 className="font-medium mb-2 text-gray-700">Cài đặt MCP</h4>
                  <ol className="list-decimal list-inside space-y-1 text-gray-600 ml-4">
                    <li>Tìm phần <strong>"Cài đặt MCP"</strong> hoặc <strong>"MCP Settings"</strong> trong bảng điều khiển</li>
                    <li>Bấm vào <strong>"Lấy điểm cuối MCP"</strong> (Get MCP Endpoint)</li>
                    <li>Một modal sẽ hiển thị với URL điểm cuối MCP (dạng: <code className="bg-gray-100 px-1 rounded text-xs">wss://api.xiaozhi.me/mcp/?token=...</code>)</li>
                    <li>Bấm <strong>"Sao chép"</strong> (Copy) để copy URL này</li>
                  </ol>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold">
                  4
                </div>
                <div className="flex-1">
                  <h4 className="font-medium mb-2 text-gray-700">Cấu hình trên Payhook Dashboard</h4>
                  <ol className="list-decimal list-inside space-y-1 text-gray-600 ml-4">
                    <li>Quay lại Payhook Dashboard</li>
                    <li>Tìm phần <strong>"Xiaozhi MCP URL"</strong> trong cấu hình Gmail của bạn</li>
                    <li>Bấm <strong>"Thêm Xiaozhi MCP"</strong> hoặc <strong>"Chỉnh sửa"</strong> (nếu đã có)</li>
                    <li>Dán URL đã copy từ Xiaozhi vào ô input</li>
                    <li>Bấm <strong>"Lưu"</strong> để lưu cấu hình</li>
                  </ol>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-semibold">
                  5
                </div>
                <div className="flex-1">
                  <h4 className="font-medium mb-2 text-gray-700">Làm mới và kiểm tra</h4>
                  <ol className="list-decimal list-inside space-y-1 text-gray-600 ml-4">
                    <li>Sau khi lưu, bấm <strong>"Làm mới"</strong> (Refresh) trong Xiaozhi Dashboard</li>
                    <li>Kiểm tra xem đã hiển thị 2 tool:
                      <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                        <li><code className="bg-gray-100 px-1 rounded text-xs">check_unnotified_payment</code> - Kiểm tra giao dịch chưa thông báo</li>
                        <li><code className="bg-gray-100 px-1 rounded text-xs">check_payment_status</code> - Kiểm tra trạng thái thanh toán</li>
                      </ul>
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          {/* Sử dụng */}
          <div>
            <h3 className="font-semibold text-lg mb-3">3. Sử dụng</h3>
            <p className="text-gray-600 mb-3">
              Sau khi cấu hình xong, bạn có thể hỏi AI Xiaozhi:
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <p className="text-blue-800 font-medium">
                <strong>"Có giao dịch mới không?"</strong>
              </p>
            </div>
            <p className="text-gray-600 mt-3">
              AI Xiaozhi sẽ tự động kiểm tra và trả lời về các giao dịch mới nhất từ Payhook.
            </p>
          </div>

          {/* Cách hoạt động */}
          <div>
            <h3 className="font-semibold text-lg mb-3">4. Cách hoạt động</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-600 ml-4">
              <li>Khi có giao dịch mới từ Payhook, hệ thống sẽ gửi thông báo qua WebSocket tới Xiaozhi MCP</li>
              <li>AI Xiaozhi sẽ nhận được thông báo và có thể đọc số tiền: <strong>"Đã nhận ... đồng"</strong></li>
              <li>Bạn có thể hỏi AI về giao dịch bất cứ lúc nào</li>
            </ul>
          </div>

          {/* Troubleshooting */}
          <div>
            <h3 className="font-semibold text-lg mb-3">5. Troubleshooting</h3>
            
            <div className="space-y-3">
              <div>
                <h4 className="font-medium mb-2 text-gray-700">Không thấy 2 tool sau khi làm mới</h4>
                <ul className="list-disc list-inside space-y-1 text-gray-600 ml-4">
                  <li>Kiểm tra lại URL MCP đã đúng chưa</li>
                  <li>Đảm bảo đã lưu cấu hình trên Payhook Dashboard</li>
                  <li>Thử xóa đi và thêm lại Xiaozhi MCP URL trên Payhook Dashboard</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2 text-gray-700">AI không trả lời về giao dịch</h4>
                <ul className="list-disc list-inside space-y-1 text-gray-600 ml-4">
                  <li>Kiểm tra xem đã có giao dịch mới trong Payhook chưa</li>
                  <li>Kiểm tra kết nối WebSocket giữa Payhook và Xiaozhi</li>
                  <li>Xem lại cấu hình MCP URL trên Payhook Dashboard</li>
                </ul>
              </div>
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

