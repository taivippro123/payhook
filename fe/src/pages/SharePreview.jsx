import { useState, useEffect } from 'react'
import { AppLayout } from '@/components/AppLayout'
import { PageSEO } from '@/components/SEO'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { IconCopy, IconEye, IconEyeOff } from '@tabler/icons-react'
import { usersAPI, shareAPI, API_BASE_URL } from '@/lib/api'

export default function SharePreview() {
  const [apiKey, setApiKey] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [loadingKey, setLoadingKey] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [error, setError] = useState('')

  const buildShareUrl = (key) => {
    if (!key) return ''
    return `${API_BASE_URL}/api/share/transactions?apiKey=${encodeURIComponent(key)}`
  }

  const fetchPreview = async (key) => {
    if (!key) return
    try {
      setLoadingPreview(true)
      setError('')
      const data = await shareAPI.getTransactions({ apiKey: key, limit: 5 })
      setPreviewData(data)
    } catch (err) {
      console.error('Error loading shared transactions:', err)
      setError(err.response?.data?.error || 'Không thể tải giao dịch. Vui lòng thử lại.')
      setPreviewData(null)
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleGetApiKey = async () => {
    try {
      setLoadingKey(true)
      setError('')
      const data = await usersAPI.getOrCreateApiKey()
      const key = data.apiKey
      setApiKey(key)
      setShareUrl(data.shareUrl || buildShareUrl(key))
      fetchPreview(key)
    } catch (err) {
      console.error('Error getting API key:', err)
      setError(err.response?.data?.error || 'Không thể lấy API key. Vui lòng thử lại.')
    } finally {
      setLoadingKey(false)
    }
  }


  const handleCopy = async (value) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      alert('Đã copy vào clipboard')
    } catch (err) {
      console.error('Copy failed:', err)
      alert('Không thể copy, vui lòng copy thủ công.')
    }
  }

  useEffect(() => {
    // Load API key hiện tại khi component mount
    const loadApiKey = async () => {
      try {
        setLoadingInitial(true)
        const data = await usersAPI.getApiKey()
        if (data.apiKey) {
          setApiKey(data.apiKey)
          setShareUrl(data.shareUrl || buildShareUrl(data.apiKey))
          fetchPreview(data.apiKey)
        }
      } catch (err) {
        console.error('Error loading API key:', err)
      } finally {
        setLoadingInitial(false)
      }
    }
    loadApiKey()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <PageSEO title="Share API" pathname="/share" robots="noindex,nofollow" />
      <AppLayout
        title="Chia sẻ giao dịch qua API key"
        subtitle="Tạo API key riêng để nhúng JSON 5 giao dịch gần nhất vào ứng dụng khác."
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.1fr)]">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>API key & URL chia sẻ</CardTitle>
              <CardDescription>
                Sử dụng API key để lấy 5 giao dịch gần nhất dạng JSON từ endpoint public.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              {loadingInitial ? (
                <p className="text-sm text-gray-500">Đang tải thông tin API key...</p>
              ) : !apiKey ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Bạn chưa có API key. Nhấn nút bên dưới để tạo API key mới.
                  </p>
                  <Button onClick={handleGetApiKey} disabled={loadingKey}>
                    {loadingKey ? 'Đang tạo API key...' : 'Lấy API key'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>API key</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey}
                        readOnly
                        className="font-mono text-xs pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShowApiKey(!showApiKey)}
                        title={showApiKey ? 'Ẩn API key' : 'Hiện API key'}
                      >
                        {showApiKey ? (
                          <IconEyeOff className="h-4 w-4" />
                        ) : (
                          <IconEye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleCopy(apiKey)}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Endpoint JSON (GET)</Label>
                <div className="flex gap-2">
                  <Input
                    value={shareUrl || (apiKey ? buildShareUrl(apiKey) : '')}
                    readOnly
                    placeholder="Endpoint sẽ hiển thị sau khi có API key"
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleCopy(shareUrl || buildShareUrl(apiKey))}
                    disabled={!apiKey}
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Ví dụ: nhúng vào dashboard khác, webhook, hay hiển thị trên màn hình TV.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Preview JSON giao dịch</CardTitle>
              <CardDescription>
                Xem thử 5 giao dịch gần nhất trả về từ endpoint chia sẻ.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!apiKey ? (
                <p className="text-sm text-gray-500">
                  Nhấn <span className="font-semibold">Lấy API key</span> để xem preview JSON giao dịch.
                </p>
              ) : loadingPreview ? (
                <p className="text-sm text-gray-500">Đang tải giao dịch...</p>
              ) : !previewData ? (
                <p className="text-sm text-gray-500">
                  Chưa có dữ liệu giao dịch hoặc không thể tải. Hãy đảm bảo Gmail đã nhận được giao dịch CAKE.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Response JSON</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => handleCopy(JSON.stringify(previewData, null, 2))}
                      title="Copy JSON"
                    >
                      <IconCopy className="h-4 w-4" />
                    </Button>
                  </div>
                  <pre className="max-h-[420px] overflow-auto rounded-md bg-gray-900 p-3 text-xs text-gray-100">
                    {JSON.stringify(previewData, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    </>
  )
}

