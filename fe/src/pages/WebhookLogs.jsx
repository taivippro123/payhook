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
      console.log('🔌 Connecting to WebSocket:', wsUrl)
      const socket = new WebSocket(wsUrl)
      wsRef.current = socket

      socket.onopen = () => {
        console.log('✅ WebSocket connected')
      }

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          console.log('📨 WS message received:', payload.event, payload.data)
          
          if (payload.event === 'webhook:new' || payload.event === 'webhook:update') {
            console.log('🔄 Triggering webhook log refresh')
            // Trigger refresh cho WebhookLogPanel
            if (window.webhookLogPanelRefresh) {
              window.webhookLogPanelRefresh()
            } else {
              console.warn('⚠️ webhookLogPanelRefresh function not found')
            }
          } else if (payload.event === 'ws.connected') {
            console.log('🔌 WebSocket connected:', payload.data)
          }
        } catch (error) {
          console.error('❌ WS message parse error:', error)
        }
      }

      socket.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason)
        if (isMounted) {
          console.log('🔄 Reconnecting in 3 seconds...')
          reconnectTimer = setTimeout(connect, 3000)
        }
      }

      socket.onerror = (error) => {
        console.error('❌ WebSocket error:', error)
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

