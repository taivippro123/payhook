import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { IconCode, IconExternalLink, IconPhoto } from '@tabler/icons-react'

export default function QRCodeGuide() {
  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Hướng dẫn tạo QR Code động</CardTitle>
          <CardDescription>
            Payhook cung cấp API để tạo QR Code chuyển khoản ngân hàng động, giúp khách hàng thanh toán nhanh chóng.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <IconPhoto className="h-4 w-4" />
            <AlertDescription>
              API này trả về hình ảnh QR Code dạng PNG, bạn có thể nhúng trực tiếp vào website hoặc ứng dụng của mình.
            </AlertDescription>
          </Alert>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <IconCode className="w-5 h-5" />
                Endpoint API
              </h3>
              <div className="bg-gray-900 text-gray-100 rounded-md p-4 font-mono text-sm overflow-x-auto">
                <div className="text-green-400">GET</div>
                <div className="text-blue-400 mt-2">
                  https://payhook-taivippro123.fly.dev/api/qr/img
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3">Tham số (Query Parameters)</h3>
              <div className="overflow-x-auto border border-gray-200 rounded-md">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Tham số</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Bắt buộc</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Mô tả</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Ví dụ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr>
                      <td className="px-4 py-3 text-sm font-mono text-gray-900">acc</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-red-100 text-red-800 text-xs">
                          Bắt buộc
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">Số tài khoản ngân hàng</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-500">0123456789</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm font-mono text-gray-900">bank</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-red-100 text-red-800 text-xs">
                          Bắt buộc
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">Mã ngân hàng (ví dụ: cake)</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-500">cake</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm font-mono text-gray-900">amount</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs">
                          Tùy chọn
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">Số tiền cần chuyển (VND)</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-500">50000</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm font-mono text-gray-900">des</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs">
                          Tùy chọn
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">Nội dung chuyển khoản (mã đơn hàng, mô tả). Phải chứa <code className="bg-gray-100 px-1 rounded text-xs">PAYHOOK_xxx</code> để kích hoạt webhook</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-500">PAYHOOK_123</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <Alert className="bg-yellow-50 border-yellow-200 mb-4">
                <IconPhoto className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  <strong>Quan trọng:</strong> Để kích hoạt webhook tự động, nội dung chuyển khoản (<code className="bg-yellow-100 px-1 rounded text-xs">des</code>) 
                  phải chứa mã đơn hàng theo định dạng <code className="bg-yellow-100 px-1 rounded text-xs">PAYHOOK_xxx</code> (ví dụ: <code className="bg-yellow-100 px-1 rounded text-xs">PAYHOOK_123</code>). 
                  Nếu không có mã này, Payhook sẽ chỉ lưu giao dịch mà không bắn webhook.
                </AlertDescription>
              </Alert>

              <h3 className="font-semibold text-lg mb-3">Ví dụ sử dụng</h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2 text-gray-700">Ví dụ 1: QR Code với đầy đủ thông tin (kích hoạt webhook)</h4>
                  <div className="bg-gray-900 text-gray-100 rounded-md p-4 font-mono text-sm overflow-x-auto">
                    <div className="text-blue-400">
                      https://payhook-taivippro123.fly.dev/api/qr/img?
                      <span className="text-yellow-400">acc</span>=0123456789&
                      <span className="text-yellow-400">bank</span>=cake&
                      <span className="text-yellow-400">amount</span>=50000&
                      <span className="text-yellow-400">des</span>=PAYHOOK_123
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    QR Code này sẽ chứa thông tin: số tài khoản, ngân hàng, số tiền và nội dung chuyển khoản. 
                    Khi khách chuyển khoản với nội dung <code className="bg-gray-100 px-1 rounded text-xs">PAYHOOK_123</code>, Payhook sẽ tự động bắn webhook cho đơn hàng 123.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium mb-2 text-gray-700">Ví dụ 2: QR Code chỉ có số tài khoản và ngân hàng</h4>
                  <div className="bg-gray-900 text-gray-100 rounded-md p-4 font-mono text-sm overflow-x-auto">
                    <div className="text-blue-400">
                      https://payhook-taivippro123.fly.dev/api/qr/img?
                      <span className="text-yellow-400">acc</span>=0123456789&
                      <span className="text-yellow-400">bank</span>=cake
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    QR Code này chỉ chứa thông tin số tài khoản và ngân hàng, khách hàng sẽ tự nhập số tiền.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3">Cách nhúng QR Code vào website</h3>
              <p className="text-gray-600 mb-3">
                Bạn có thể nhúng QR Code trực tiếp vào website bằng thẻ <code className="bg-gray-100 px-2 py-1 rounded text-sm">img</code>:
              </p>
              <div className="bg-gray-900 text-gray-100 rounded-md p-4 font-mono text-sm overflow-x-auto">
                <div className="text-gray-300">
                  {'<img src="https://payhook-taivippro123.fly.dev/api/qr/img?acc=0123456789&bank=cake&amount=50000&des=PAYHOOK_123" />'}
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3">Ví dụ code JavaScript/React</h3>
              <div className="bg-gray-900 text-gray-100 rounded-md p-4 font-mono text-sm overflow-x-auto">
                <pre className="text-gray-300">
{`// Tạo URL QR Code với mã đơn hàng PAYHOOK_xxx
const qrUrl = \`https://payhook-taivippro123.fly.dev/api/qr/img?acc=\${accountNumber}&bank=\${bank}&amount=\${amount}&des=PAYHOOK_\${orderId}\`;

// Sử dụng trong React component
<img src={qrUrl} alt="QR Code thanh toán" />`}
                </pre>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                <strong>Lưu ý:</strong> Mã đơn hàng phải có prefix <code className="bg-gray-100 px-1 rounded text-xs">PAYHOOK_</code> để Payhook nhận diện và bắn webhook tự động.
              </p>
            </div>

            <Alert className="bg-blue-50 border-blue-200">
              <IconExternalLink className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Lưu ý:</strong> API này là public endpoint, không cần xác thực. 
                Bạn có thể gọi trực tiếp từ frontend hoặc backend tùy theo nhu cầu.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

