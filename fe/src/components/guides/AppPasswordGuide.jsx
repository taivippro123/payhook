import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { IconExternalLink, IconCheck, IconAlertCircle } from '@tabler/icons-react'

export default function AppPasswordGuide() {
  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Hướng dẫn lấy App Password từ Google</CardTitle>
          <CardDescription>
            App Password là mật khẩu ứng dụng dùng để Payhook truy cập vào hộp thư Gmail của bạn một cách an toàn.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <IconAlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Lưu ý quan trọng:</strong> Bạn phải bật 2-Step Verification (Xác minh 2 bước) trước khi có thể tạo App Password.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold">
                1
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">Đăng nhập vào tài khoản Google</h3>
                <p className="text-gray-600 mb-3">
                  Truy cập vào trang quản lý App Passwords của Google:
                </p>
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
                >
                  <IconExternalLink className="w-4 h-4" />
                  https://myaccount.google.com/apppasswords
                </a>
                <p className="text-sm text-gray-500 mt-2">
                  Bạn phải đăng nhập vào tài khoản Google trước khi truy cập trang này.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold">
                2
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">Bật 2-Step Verification (Xác minh 2 bước)</h3>
                <p className="text-gray-600 mb-3">
                  Nếu bạn chưa bật 2-Step Verification, Google sẽ yêu cầu bạn bật tính năng này trước.
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>Quan trọng:</strong> Nếu bạn không thấy trang App Passwords, có nghĩa là bạn chưa bật 2-Step Verification. 
                    Hãy bật tính năng này trước trong phần Bảo mật của tài khoản Google.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold">
                3
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">Tạo App Password mới</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-600 ml-4">
                  <li>Chọn ứng dụng: Chọn "Mail" hoặc "Other (Custom name)"</li>
                  <li>Nhập tên: Nhập tên dễ nhớ như "Payhook" hoặc "Email Monitor"</li>
                  <li>Nhấn "Generate": Google sẽ tạo một mật khẩu 16 ký tự</li>
                </ol>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-semibold">
                <IconCheck className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">Sao chép App Password</h3>
                <p className="text-gray-600 mb-3">
                  Google sẽ hiển thị mật khẩu dưới dạng 4 nhóm, mỗi nhóm 4 ký tự (ví dụ: <code className="bg-gray-100 px-2 py-1 rounded">abcd efgh ijkl mnop</code>).
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Mẹo:</strong> Khi sao chép App Password từ Google, có thể có dấu cách giữa các nhóm. 
                    Payhook sẽ tự động xóa các dấu cách này khi bạn dán vào trường App Password.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-semibold">
                4
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">Sử dụng App Password trong Payhook</h3>
                <p className="text-gray-600 mb-3">
                  Quay lại Dashboard của Payhook và nhập App Password vào trường "App Password" khi tạo hoặc cập nhật cấu hình email.
                </p>
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                  <p className="text-sm font-mono text-gray-700">
                    Ví dụ: Nếu Google hiển thị <code className="bg-white px-1">abcd efgh ijkl mnop</code>
                    <br />
                    Bạn có thể dán nguyên như vậy, Payhook sẽ tự động xử lý thành: <code className="bg-white px-1">abcdefghijklmnop</code>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Alert className="bg-green-50 border-green-200">
            <IconCheck className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>Hoàn tất!</strong> Sau khi nhập App Password, Payhook sẽ có thể truy cập vào hộp thư Gmail của bạn 
              để quét và phát hiện các giao dịch ngân hàng.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}

