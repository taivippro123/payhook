import { useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { AppLayout } from '@/components/AppLayout'
import WebhookLogPanel from '@/components/WebhookLogPanel'
import { WS_BASE_URL } from '@/lib/api'

export default function WebhookLogs() {
  const { user } = useAuth()
  const wsRef = useRef(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    let isMounted = true
    let reconnectTimer = null
    const wsUrl = `${WS_BASE_URL}/ws?token=${encodeURIComponent(token)}`

    const connect = () => {
      if (!isMounted) return
      const socket = new WebSocket(wsUrl)
      wsRef.current = socket

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          if (payload.event === 'webhook:new' || payload.event === 'webhook:update') {
            // Trigger refresh cho WebhookLogPanel
            if (window.webhookLogPanelRefresh) {
              window.webhookLogPanelRefresh()
            }
          }
        } catch (error) {
          console.error('WS message parse error:', error)
        }
      }

      socket.onclose = () => {
        if (isMounted) {
          reconnectTimer = setTimeout(connect, 3000)
        }
      }

      socket.onerror = () => {
        socket.close()
      }
    }

    connect()

    return () => {
      isMounted = false
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [user])

  return (
    <AppLayout
      title="Webhook Logs"
      subtitle="Theo dõi lịch sử gửi webhook và trạng thái gửi"
    >
      <WebhookLogPanel
        title="Webhook Logs"
        description="Theo dõi trạng thái gửi webhook đã bắn tới hệ thống của bạn"
        pageSize={20}
        showUserColumn={user?.role === 'admin'}
        filters={user?.role !== 'admin' ? { userId: user?._id?.toString() } : {}}
      />
    </AppLayout>
  )
}

