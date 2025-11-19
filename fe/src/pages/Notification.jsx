import { useState, useEffect } from 'react'
import { AppLayout } from '@/components/AppLayout'
import { PageSEO } from '@/components/SEO'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { pushNotificationsAPI } from '@/lib/api'

export default function Notification() {
  const [enabled, setEnabled] = useState(false)
  const [startTime, setStartTime] = useState('07:00')
  const [endTime, setEndTime] = useState('21:00')
  const [hasSubscription, setHasSubscription] = useState(false)
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [isSupported, setIsSupported] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editEnabled, setEditEnabled] = useState(false)
  const [editStartTime, setEditStartTime] = useState('07:00')
  const [editEndTime, setEditEndTime] = useState('21:00')

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
      // Set initial edit values
      setEditEnabled(settings.enabled || false)
      setEditStartTime(settings.startTime || '07:00')
      setEditEndTime(settings.endTime || '21:00')
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
      const permission = await window.Notification.requestPermission()
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
        startTime: editStartTime,
        endTime: editEndTime,
      })

      setHasSubscription(true)
      setEnabled(true)
      setEditEnabled(true)
      setSuccess('Đã đăng ký nhận thông báo thành công!')
    } catch (error) {
      console.error('Error subscribing to push:', error)
      setError(error.message || 'Có lỗi xảy ra khi đăng ký thông báo')
    } finally {
      setIsSubscribing(false)
    }
  }

  const unsubscribeFromPush = async () => {
    if (!hasSubscription) {
      setError('Bạn chưa đăng ký thông báo')
      return
    }

    setIsSubscribing(true)
    setError(null)
    setSuccess(null)

    try {
      // Chỉ tắt thông báo, không hủy subscription
      await pushNotificationsAPI.updateSettings({
        enabled: false,
        startTime: startTime, // Giữ nguyên thời gian
        endTime: endTime, // Giữ nguyên thời gian
      })

      setEnabled(false)
      setEditEnabled(false)
      setSuccess('Đã tắt thông báo')
    } catch (error) {
      console.error('Error disabling notifications:', error)
      setError(error.message || 'Có lỗi xảy ra khi tắt thông báo')
    } finally {
      setIsSubscribing(false)
    }
  }

  const handleEdit = () => {
    setEditEnabled(enabled)
    setEditStartTime(startTime)
    setEditEndTime(endTime)
    setIsEditing(true)
    setError(null)
    setSuccess(null)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditEnabled(enabled)
    setEditStartTime(startTime)
    setEditEndTime(endTime)
    setError(null)
    setSuccess(null)
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
        enabled: editEnabled,
        startTime: editStartTime,
        endTime: editEndTime,
      })
      setEnabled(editEnabled)
      setStartTime(editStartTime)
      setEndTime(editEndTime)
      setIsEditing(false)
      setSuccess('Đã lưu cài đặt thành công!')
    } catch (error) {
      console.error('Error saving settings:', error)
      setError(error.message || 'Có lỗi xảy ra khi lưu cài đặt')
    } finally {
      setIsSaving(false)
    }
  }

  // Toggle component
  const Toggle = ({ checked, onChange, disabled }) => {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          ${checked ? 'bg-blue-600' : 'bg-gray-200'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
            ${checked ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
    )
  }

  if (!isSupported) {
    return (
      <>
        <PageSEO title="Thông báo" pathname="/notification" robots="noindex,nofollow" />
        <AppLayout
          title="Thông báo Âm thanh"
          subtitle="Cài đặt thông báo và âm thanh"
        >
          <Card>
            <CardHeader>
              <CardTitle>Thông báo Âm thanh</CardTitle>
              <CardDescription>
                Trình duyệt của bạn không hỗ trợ push notifications
              </CardDescription>
            </CardHeader>
          </Card>
        </AppLayout>
      </>
    )
  }

  return (
    <>
      <PageSEO title="Thông báo" pathname="/notification" robots="noindex,nofollow" />
      <AppLayout
        title="Thông báo Âm thanh"
        subtitle="Cài đặt thông báo và âm thanh khi có giao dịch mới. Tính năng này không hoạt động trên điện thoại và một số trình duyệt."
      >
        <Card>
          <CardHeader>
            <CardTitle>Thông báo Âm thanh</CardTitle>
           
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
                  Để nhận thông báo, bạn cần đăng ký. Sau khi đăng ký, bạn sẽ nhận được thông báo và âm thanh khi có giao dịch mới. Tính năng này không hoạt động trên điện thoại và một số trình duyệt.
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
                {!isEditing ? (
                  <>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="enabled" className="text-sm font-medium">
                        Bật thông báo
                      </Label>
                      <Toggle
                        checked={enabled}
                        onChange={() => {}}
                        disabled={true}
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
                            readOnly
                            className="w-full bg-gray-50"
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
                            readOnly
                            className="w-full bg-gray-50"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">
                        Ví dụ: Cửa hàng mở từ 7h-21h, chỉ nhận thông báo trong khoảng thời gian này
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={handleEdit}
                        variant="outline"
                        className="flex-1"
                      >
                        Chỉnh sửa
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
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="editEnabled" className="text-sm font-medium">
                        Bật thông báo
                      </Label>
                      <Toggle
                        checked={editEnabled}
                        onChange={setEditEnabled}
                        disabled={false}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Khoảng thời gian nhận thông báo</Label>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <Label htmlFor="editStartTime" className="text-xs text-gray-600 mb-1 block">
                            Từ
                          </Label>
                          <Input
                            id="editStartTime"
                            type="time"
                            value={editStartTime}
                            onChange={(e) => setEditStartTime(e.target.value)}
                            className="w-full"
                          />
                        </div>
                        <div className="flex-1">
                          <Label htmlFor="editEndTime" className="text-xs text-gray-600 mb-1 block">
                            Đến
                          </Label>
                          <Input
                            id="editEndTime"
                            type="time"
                            value={editEndTime}
                            onChange={(e) => setEditEndTime(e.target.value)}
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
                        {isSaving ? 'Đang lưu...' : 'Lưu'}
                      </Button>
                      <Button
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                        variant="outline"
                        className="flex-1"
                      >
                        Hủy
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </AppLayout>
    </>
  )
}

