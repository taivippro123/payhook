import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { IconExternalLink, IconAlertCircle, IconRefresh, IconCheck } from '@tabler/icons-react'

export default function GmailConnection() {
  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Kết nối Gmail bằng Google OAuth</CardTitle>
          <CardDescription>
            Kể từ phiên bản mới, Payhook sử dụng Gmail Push Notifications – không còn cần App Password. Bạn chỉ cần ủy quyền tài khoản Gmail thông qua Google OAuth.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="bg-blue-50 border-blue-200">
            <IconAlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>Gmail hết hạn mỗi ~7 ngày:</strong> Google tự động hủy subscription của API <code className="bg-blue-100 px-1 rounded text-xs">users.watch()</code>.
              Payhook có scheduler tự gia hạn trước khi hết hạn, đồng thời hiển thị đếm ngược để bạn nắm trạng thái.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold">
                1
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">Nhấn “Kết nối Gmail” trên Dashboard</h3>
                <p className="text-gray-600">
                  Payhook sẽ tạo một đường dẫn OAuth thông qua Google. Bạn nên mở trên trình duyệt đã đăng nhập sẵn Gmail cần kết nối.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold">
                2
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="font-semibold text-lg">Chọn tài khoản và chấp nhận quyền</h3>
                <p className="text-gray-600">
                  Google hiển thị “Ứng dụng Payhook muốn đọc Gmail của bạn (read-only)”. Quyền này chỉ cho phép Payhook đọc nội dung email ngân hàng để phát hiện giao dịch.
                </p>
                <Alert className="bg-yellow-50 border-yellow-200">
                  <IconAlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    <strong>Cảnh báo ứng dụng chưa xác minh?</strong> Đây là thông báo tiêu chuẩn của Google khi app chưa publish. Chọn “Advanced” → “Go to Payhook (unsafe)” để tiếp tục.
                  </AlertDescription>
                </Alert>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold">
                3
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="font-semibold text-lg">Hoàn tất ủy quyền và quay lại Payhook</h3>
                <p className="text-gray-600">
                  Sau khi bấm <strong>Allow</strong>, Google sẽ chuyển hướng về Payhook. Bạn sẽ thấy Gmail xuất hiện trong danh sách cấu hình cùng thời gian hết hạn push.
                </p>
                <Alert className="bg-green-50 border-green-200">
                  <IconCheck className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Đừng quên điền <strong>Webhook URL</strong> để Payhook gửi giao dịch về hệ thống của bạn.
                  </AlertDescription>
                </Alert>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-semibold">
                <IconRefresh className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="font-semibold text-lg">Theo dõi trạng thái push</h3>
                <p className="text-gray-600">
                  Gmail chỉ giữ subscription tối đa ~7 ngày. Payhook tự động gia hạn trước hạn chót và hiển thị trạng thái “Hết hạn trong X ngày” để bạn dễ kiểm soát.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Tài liệu thêm</h3>
            <a
              href="https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/watch"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col sm:flex-row sm:items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
            >
              <IconExternalLink className="w-4 h-4" />
              <span className="leading-snug">Gmail API – users.watch()</span>
            </a>
            <a
              href="https://developers.google.com/workspace/gmail/api/guides/push"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col sm:flex-row sm:items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
            >
              <IconExternalLink className="w-4 h-4" />
              <span className="leading-snug">Hướng dẫn thiết lập Push Notifications</span>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
