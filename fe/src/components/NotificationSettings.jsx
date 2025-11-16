import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { pushNotificationsAPI } from '@/lib/api'

export default function NotificationSettings() {
  const [enabled, setEnabled] = useState(false)
  const [startTime, setStartTime] = useState('07:00')
  const [endTime, setEndTime] = useState('21:00')
  const [hasSubscription, setHasSubscription] = useState(false)
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    // Kiểm tra browser support
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true)
      loadSettings()
    } else {
      setIsSupported(false)
      setError('Trình duyệt của bạn không hỗ trợ push notifications')
    }
  }, [])

  const loadSettings = async () => {
    try {
      const settings = await pushNotificationsAPI.getSettings()
      setEnabled(settings.enabled || false)
      setStartTime(settings.startTime || '07:00')
      setEndTime(settings.endTime || '21:00')
      setHasSubscription(settings.hasSubscription || false)
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  const subscribeToPush = async () => {
    if (!isSupported) {
      setError('Trình duyệt không hỗ trợ push notifications')
      return
    }

    setIsSubscribing(true)
    setError(null)
    setSuccess(null)

    try {
      // Đăng ký service worker
      const registration = await navigator.serviceWorker.register('/sw.js')
      console.log('Service Worker registered:', registration)

      // Yêu cầu permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        throw new Error('Bạn cần cho phép thông báo để sử dụng tính năng này')
      }

      // Lấy VAPID public key từ server
      const keyData = await pushNotificationsAPI.getPublicKey()
      const vapidPublicKey = keyData.publicKey

      if (!vapidPublicKey) {
        throw new Error('Server chưa cấu hình VAPID keys. Vui lòng liên hệ admin.')
      }

      // Convert VAPID key từ base64 sang Uint8Array
      const urlBase64ToUint8Array = (base64String) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4)
        const base64 = (base64String + padding)
          .replace(/\-/g, '+')
          .replace(/_/g, '/')
        const rawData = window.atob(base64)
        const outputArray = new Uint8Array(rawData.length)
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i)
        }
        return outputArray
      }

      // Lấy subscription
      let subscription = await registration.pushManager.getSubscription()
      
      if (!subscription) {
        // Tạo subscription mới
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        })
      }

      // Gửi subscription lên server
      const subscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')))),
          auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')))),
        },
      }

      await pushNotificationsAPI.subscribe(subscriptionData, {
        enabled: true,
        startTime,
        endTime,
      })

      setHasSubscription(true)
      setEnabled(true)
      setSuccess('Đã đăng ký nhận thông báo thành công!')
    } catch (error) {
      console.error('Error subscribing to push:', error)
      setError(error.message || 'Có lỗi xảy ra khi đăng ký thông báo')
    } finally {
      setIsSubscribing(false)
    }
  }

  const unsubscribeFromPush = async () => {
    setIsSubscribing(true)
    setError(null)
    setSuccess(null)

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      
      if (subscription) {
        await subscription.unsubscribe()
        await pushNotificationsAPI.unsubscribe(subscription.endpoint)
      }

      setHasSubscription(false)
      setEnabled(false)
      setSuccess('Đã hủy đăng ký thông báo')
    } catch (error) {
      console.error('Error unsubscribing from push:', error)
      setError(error.message || 'Có lỗi xảy ra khi hủy đăng ký')
    } finally {
      setIsSubscribing(false)
    }
  }

  const saveSettings = async () => {
    if (!hasSubscription) {
      setError('Vui lòng đăng ký thông báo trước')
      return
    }

    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      await pushNotificationsAPI.updateSettings({
        enabled,
        startTime,
        endTime,
      })
      setSuccess('Đã lưu cài đặt thành công!')
    } catch (error) {
      console.error('Error saving settings:', error)
      setError(error.message || 'Có lỗi xảy ra khi lưu cài đặt')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Thông báo Âm thanh</CardTitle>
          <CardDescription>
            Trình duyệt của bạn không hỗ trợ push notifications
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thông báo Âm thanh</CardTitle>
        <CardDescription>
          Nhận thông báo và âm thanh khi có giao dịch mới, ngay cả khi đã đóng trình duyệt
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
            {success}
          </div>
        )}

        {!hasSubscription ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Để nhận thông báo, bạn cần đăng ký. Sau khi đăng ký, bạn sẽ nhận được thông báo và âm thanh khi có giao dịch mới, ngay cả khi đã đóng trình duyệt hoặc khóa màn hình.
            </p>
            <Button
              onClick={subscribeToPush}
              disabled={isSubscribing}
              className="w-full"
            >
              {isSubscribing ? 'Đang đăng ký...' : 'Đăng ký Nhận Thông báo'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="enabled" className="text-sm font-medium">
                Bật thông báo
              </Label>
              <input
                id="enabled"
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Khoảng thời gian nhận thông báo</Label>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="startTime" className="text-xs text-gray-600 mb-1 block">
                    Từ
                  </Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="endTime" className="text-xs text-gray-600 mb-1 block">
                    Đến
                  </Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Ví dụ: Cửa hàng mở từ 7h-21h, chỉ nhận thông báo trong khoảng thời gian này
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={saveSettings}
                disabled={isSaving}
                className="flex-1"
              >
                {isSaving ? 'Đang lưu...' : 'Lưu Cài đặt'}
              </Button>
              <Button
                onClick={unsubscribeFromPush}
                disabled={isSubscribing}
                variant="outline"
                className="flex-1"
              >
                {isSubscribing ? 'Đang hủy...' : 'Hủy Đăng ký'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
