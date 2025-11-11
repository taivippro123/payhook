import { useState, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { qrAPI } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AppLayout } from '@/components/AppLayout'

export default function QRGenerator() {
  const { user } = useAuth()
  const [form, setForm] = useState({
    acc: '',
    amount: '',
    des: '',
  })
  const [error, setError] = useState('')
  const [previewVersion, setPreviewVersion] = useState(0)

  const qrUrl = useMemo(() => {
    if (!form.acc.trim()) return ''
    return qrAPI.imageUrl({
      acc: form.acc.trim(),
      amount: form.amount ? Number(form.amount) : undefined,
      des: form.des.trim(),
      bank: 'cake',
    }) + `&v=${previewVersion}`
  }, [form, previewVersion])

  const handleGenerate = () => {
    if (!form.acc.trim()) {
      setError('Vui lòng nhập số tài khoản')
      return
    }
    setError('')
    setPreviewVersion((v) => v + 1)
    window.open(qrAPI.imageUrl({
      acc: form.acc.trim(),
      amount: form.amount ? Number(form.amount) : undefined,
      des: form.des.trim(),
      bank: 'cake',
    }), '_blank', 'noopener')
  }

  return (
    <AppLayout
      title="Tạo QR Thanh toán (Cake)"
      subtitle="Mẫu QR chuẩn VietQR cho tài khoản Cake by VPBank"
    >
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Thông tin chuyển khoản</CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">
              Mẫu QR chuẩn VietQR cho tài khoản Cake by VPBank
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="qr-acc">Số tài khoản (bắt buộc)</Label>
                <Input
                  id="qr-acc"
                  placeholder="0123456789"
                  value={form.acc}
                  onChange={(e) => setForm({ ...form, acc: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Ngân hàng</Label>
                <Input value="Cake by VPBank" disabled className="bg-gray-100" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qr-amount">Số tiền (tuỳ chọn)</Label>
                <Input
                  id="qr-amount"
                  type="number"
                  placeholder="10000"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  min="0"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="qr-des">Nội dung (tuỳ chọn)</Label>
                <Input
                  id="qr-des"
                  placeholder="Noi dung chuyen khoan"
                  value={form.des}
                  onChange={(e) => setForm({ ...form, des: e.target.value })}
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleGenerate}>Mở ảnh QR</Button>
              {qrUrl && (
                <Button variant="outline" onClick={() => setPreviewVersion((v) => v + 1)}>
                  Làm mới preview
                </Button>
              )}
            </div>

            {qrUrl && (
              <div className="pt-4 border-t">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Preview</h2>
                <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                  <img
                    src={qrUrl}
                    alt="QR chuyển khoản Cake"
                    className="w-48 h-48 border rounded bg-white"
                    loading="lazy"
                  />
                  <div className="text-xs sm:text-sm text-gray-600">
                    <p><strong>Số tài khoản:</strong> {form.acc || '—'}</p>
                    <p><strong>Số tiền:</strong> {form.amount || '—'}</p>
                    <p><strong>Nội dung:</strong> {form.des || '—'}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}


