import { useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { AppLayout } from '@/components/AppLayout'
import { PageSEO } from '@/components/SEO'
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

      socket.onopen = () => {}

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          
          if (payload.event === 'webhook:new' || payload.event === 'webhook:update') {
            // Trigger refresh cho WebhookLogPanel
            if (window.webhookLogPanelRefresh) {
              window.webhookLogPanelRefresh()
            } else {
              console.warn('⚠️ webhookLogPanelRefresh function not found')
            }
          }
        } catch (error) {
          console.error('❌ WS message parse error:', error)
        }
      }

      socket.onclose = (event) => {
        if (isMounted) {
          // Log chi tiết lý do đóng để debug
          console.warn('🔌 WebSocket closed:', {
            code: event.code,
            reason: event.reason || 'No reason provided',
            wasClean: event.wasClean,
            url: wsUrl
          })
          reconnectTimer = setTimeout(connect, 3000)
        }
      }

      socket.onerror = (error) => {
        // WebSocket error event thường không có nhiều thông tin
        // Thông tin chi tiết sẽ có trong onclose event
        console.error('❌ WebSocket error:', {
          type: error.type,
          target: {
            url: error.target?.url,
            readyState: error.target?.readyState, // 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
            readyStateText: ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][error.target?.readyState] || 'UNKNOWN'
          }
        })
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
    <>
      <PageSEO title="Payhook" pathname="/webhooks" robots="noindex,nofollow" />
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
    </>
  )
}

