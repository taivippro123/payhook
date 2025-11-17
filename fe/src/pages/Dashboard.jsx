import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useRateLimit } from '@/contexts/RateLimitContext'
import { emailConfigAPI, transactionsAPI, WS_BASE_URL, gmailAPI } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { AppLayout } from '@/components/AppLayout'
import { PageSEO } from '@/components/SEO'
import NotificationSettings from '@/components/NotificationSettings'
import { cn } from '@/lib/utils'
import { IconCopy, IconEye, IconEyeOff, IconCheck } from '@tabler/icons-react'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const { isRateLimited, rateLimitType } = useRateLimit()
  const navigate = useNavigate()
  const [emailConfigs, setEmailConfigs] = useState([])
  
  // Check if API or webhook is rate limited
  const isApiRateLimited = isRateLimited && (rateLimitType === 'api' || rateLimitType === 'webhook')
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(false)
  const [webhookDrafts, setWebhookDrafts] = useState({})
  const [editingWebhookId, setEditingWebhookId] = useState(null)
  const [updatingConfigId, setUpdatingConfigId] = useState(null)
  const [isConnectingGmail, setIsConnectingGmail] = useState(false)
  const wsRef = useRef(null)
  const [allTransactions, setAllTransactions] = useState([])
  const [transactionsPage, setTransactionsPage] = useState(1)
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [hasMoreTransactions, setHasMoreTransactions] = useState(true)
  const transactionsContainerRef = useRef(null)
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false)
  const [configsLoaded, setConfigsLoaded] = useState(false) // Track xem đã load configs lần đầu chưa
  const [recentLimit, setRecentLimit] = useState(10)
  const recentLimitRef = useRef(10)
  const [highlightedRecentIds, setHighlightedRecentIds] = useState({})
  const [highlightedAllIds, setHighlightedAllIds] = useState({})
  const recentHighlightTimersRef = useRef(new Map())
  const allHighlightTimersRef = useRef(new Map())
  const [showWebhookSecrets, setShowWebhookSecrets] = useState({})
  const [copiedSecretId, setCopiedSecretId] = useState(null)
  const [sendingTestEmailId, setSendingTestEmailId] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  // Hiển thị welcome dialog nếu user chưa có email config nào
  // Dialog sẽ luôn hiện mỗi lần vào Dashboard cho đến khi user add email config lần đầu
  useEffect(() => {
    if (!user || !configsLoaded) return

    // Chỉ hiển thị nếu:
    // 1. Đã load xong configs (configsLoaded = true)
    // 2. Không có email config nào
    if (emailConfigs.length === 0) {
      setShowWelcomeDialog(true)
    } else {
      setShowWelcomeDialog(false)
    }
  }, [configsLoaded, emailConfigs.length, user])

  useEffect(() => {
    recentLimitRef.current = recentLimit
  }, [recentLimit])

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

          if (payload.event === 'transaction:new' && payload.data) {
            const newTransaction = payload.data
            const incomingId = newTransaction._id?.$oid || newTransaction._id

            if (!incomingId) {
              console.warn('⚠️ Transaction missing _id:', newTransaction)
              return
            }

            console.log('✅ New transaction received via WS:', incomingId)

            // Cập nhật recent transactions
            setTransactions((prev) => {
              const exists = prev.some((tx) => {
                const existingId = tx?._id?.$oid || tx?._id
                return existingId === incomingId
              })
              if (exists) {
                console.log('⏭️ Transaction already in recent list')
                return prev
              }
              const updated = [newTransaction, ...prev]
              const limit = recentLimitRef.current || 5
              triggerRecentHighlight(incomingId)
              return updated.slice(0, limit)
            })

            // Cập nhật all transactions
            setAllTransactions((prev) => {
              const exists = prev.some((tx) => {
                const existingId = tx?._id?.$oid || tx?._id
                return existingId === incomingId
              })
              if (exists) {
                console.log('⏭️ Transaction already in all transactions list')
                return prev
              }
              triggerAllHighlight(incomingId)
              return [newTransaction, ...prev]
            })
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

  const loadData = async () => {
    setLoading(true)
    try {
      const { computedLimit } = await loadConfigs()
      await loadTransactions(computedLimit)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSendTestEmail = async (configId) => {
    if (isApiRateLimited) return
    try {
      setSendingTestEmailId(configId)
      const response = await emailConfigAPI.sendTestEmail(configId)
      const amount = response?.sample?.parsedTransaction?.amountVND
      const friendlyAmount = amount ? formatCurrency(amount) : 'giao dịch mẫu'
      alert(`Đã gửi email test CAKE tới ${response.email}. Khi Gmail nhận thư, Payhook sẽ hiển thị ${friendlyAmount} trong danh sách giao dịch.`)
    } catch (error) {
      console.error('Error sending test email:', error)
      const message = error.response?.data?.error || 'Không thể gửi email test. Vui lòng kiểm tra cấu hình SMTP TEST_EMAIL_* ở backend.'
      alert(message)
    } finally {
      setSendingTestEmailId(null)
    }
  }

  const loadConfigs = async () => {
    try {
      const response = await emailConfigAPI.getAll()
      const configs = response.configs || []
      setEmailConfigs(configs)
      const drafts = {}
      configs.forEach((config) => {
        const id = config._id || config.id
        if (id) {
          drafts[id] = config.webhookUrl || ''
        }
      })
      setWebhookDrafts(drafts)
      setConfigsLoaded(true) // Đánh dấu đã load xong configs
      const computedLimit = Math.max(10, (configs.length || 0) * 10)
      setRecentLimit(computedLimit)
      recentLimitRef.current = computedLimit
      return { configs, computedLimit }
    } catch (error) {
      console.error('Error loading configs:', error)
      setConfigsLoaded(true) // Vẫn đánh dấu đã load (dù có lỗi) để tránh dialog hiện khi đang load
      const fallbackLimit = recentLimitRef.current || 10
      setRecentLimit(fallbackLimit)
      recentLimitRef.current = fallbackLimit
      return { configs: [], computedLimit: fallbackLimit }
    }
  }

  const loadTransactions = async (limitOverride) => {
    const limit = limitOverride ?? recentLimitRef.current ?? 10
    try {
      // Load các giao dịch mới nhất cho "Giao dịch mới nhất"
      const recentResponse = await transactionsAPI.getAll({ limit })
      setTransactions(recentResponse.transactions || [])

      // Load trang đầu cho "Chi tiết giao dịch"
      const allResponse = await transactionsAPI.getAll({ limit: 20, page: 1 })
      setAllTransactions(allResponse.transactions || [])
      setHasMoreTransactions((allResponse.transactions || []).length >= 20)
      setTransactionsPage(1)
    } catch (error) {
      console.error('Error loading transactions:', error)
    }
  }

  const loadMoreTransactions = useCallback(async () => {
    if (transactionsLoading || !hasMoreTransactions) return

    setTransactionsLoading(true)
    try {
      const nextPage = transactionsPage + 1
      const response = await transactionsAPI.getAll({ limit: 20, page: nextPage })
      const newTransactions = response.transactions || []

      if (newTransactions.length > 0) {
        setAllTransactions(prev => [...prev, ...newTransactions])
        setTransactionsPage(nextPage)
        setHasMoreTransactions(newTransactions.length >= 20)
      } else {
        setHasMoreTransactions(false)
      }
    } catch (error) {
      console.error('Error loading more transactions:', error)
    } finally {
      setTransactionsLoading(false)
    }
  }, [transactionsPage, transactionsLoading, hasMoreTransactions])

  useEffect(() => {
    const container = transactionsContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      // Load more khi scroll đến 80% cuối
      if (scrollHeight - scrollTop <= clientHeight * 1.2) {
        loadMoreTransactions()
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [loadMoreTransactions])

  const handleConnectGmail = async () => {
    setIsConnectingGmail(true)
    try {
      const response = await gmailAPI.getAuthUrl()
      if (response?.authUrl) {
        window.location.href = response.authUrl
      } else {
        alert('Không lấy được liên kết kết nối Gmail. Vui lòng thử lại.')
      }
    } catch (error) {
      console.error('Error generating Gmail auth URL:', error)
      alert(error.response?.data?.error || 'Không thể tạo liên kết Google OAuth. Kiểm tra cấu hình backend.')
    } finally {
      setIsConnectingGmail(false)
    }
  }

  const handleWebhookChange = (configId, value) => {
    setWebhookDrafts((prev) => ({
      ...prev,
      [configId]: value,
    }))
  }

  const handleEditWebhook = (configId, currentValue) => {
    setEditingWebhookId(configId)
    setWebhookDrafts((prev) => ({
      ...prev,
      [configId]: currentValue || '',
    }))
  }

  const handleCancelWebhookEdit = (configId) => {
    setWebhookDrafts((prev) => {
      const next = { ...prev }
      next[configId] = emailConfigs.find((cfg) => (cfg._id || cfg.id) === configId)?.webhookUrl || ''
      return next
    })
    setEditingWebhookId(null)
  }

  const handleSaveWebhook = async (configId) => {
    if (isApiRateLimited) return
    try {
      setUpdatingConfigId(configId)
      const webhookUrl = webhookDrafts[configId]?.trim() || null
      await emailConfigAPI.update(configId, { webhookUrl })
      const { computedLimit } = await loadConfigs()
      await loadTransactions(computedLimit)
      setEditingWebhookId(null)
    } catch (error) {
      console.error('Error saving webhook:', error)
      const errorMessage = error.response?.data?.error || 'Lỗi khi cập nhật webhook'
      
      // Hiển thị thông báo lỗi chi tiết hơn
      let displayMessage = errorMessage
      
      if (errorMessage.includes('rate limit') || errorMessage.includes('Rate limit')) {
        displayMessage = '⚠️ Vượt quá giới hạn 1000 webhooks/giờ. Vui lòng thử lại sau hoặc tối ưu logic xử lý webhook.'
      } else if (errorMessage.includes('HTTPS') || errorMessage.includes('https')) {
        displayMessage = 'Webhook URL phải sử dụng HTTPS (trừ localhost trong development). Vui lòng kiểm tra lại URL.'
      } else if (errorMessage.includes('localhost') || errorMessage.includes('127.0.0.1')) {
        displayMessage = 'Webhook URL không được sử dụng localhost hoặc private IPs trong production. Vui lòng sử dụng domain name với HTTPS.'
      } else if (errorMessage.includes('IP address') || errorMessage.includes('IP addresses')) {
        displayMessage = 'Webhook URL không được sử dụng IP address. Vui lòng sử dụng domain name (ví dụ: https://your-domain.com/webhook).'
      } else if (errorMessage.includes('Invalid URL') || errorMessage.includes('URL format')) {
        displayMessage = 'Webhook URL không đúng định dạng. Vui lòng kiểm tra lại URL (ví dụ: https://your-domain.com/webhook/payhook).'
      } else if (errorMessage.includes('port')) {
        displayMessage = 'Webhook URL chỉ được sử dụng ports 80 (HTTP) hoặc 443 (HTTPS). Vui lòng kiểm tra lại URL.'
      }
      
      alert(displayMessage)
    } finally {
      setUpdatingConfigId(null)
    }
  }

  const handleToggleConfig = async (config) => {
    if (isApiRateLimited) return
    try {
      const configId = config._id || config.id
      setUpdatingConfigId(configId)
      await emailConfigAPI.update(configId, { isActive: !config.isActive })
      const { computedLimit } = await loadConfigs()
      await loadTransactions(computedLimit)
    } catch (error) {
      console.error('Error toggling config:', error)
      alert(error.response?.data?.error || 'Lỗi khi cập nhật trạng thái')
    } finally {
      setUpdatingConfigId(null)
    }
  }

  const handleDeleteConfig = async (id) => {
    if (isApiRateLimited) return
    if (!confirm('Bạn có chắc muốn xóa cấu hình này?')) return
    try {
      await emailConfigAPI.delete(id)
      const { computedLimit } = await loadConfigs()
      await loadTransactions(computedLimit)
    } catch (error) {
      console.error('Error deleting config:', error)
      alert(error.response?.data?.error || 'Lỗi khi xóa cấu hình')
    }
  }

  const formatCurrency = (amount) => {
    if (!amount) return '-'
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount)
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('vi-VN')
  }

  const getTransactionKey = (tx) => tx?._id?.$oid || tx?._id || tx?.id

  const triggerHighlight = (id, type) => {
    if (!id) return
    const setState = type === 'recent' ? setHighlightedRecentIds : setHighlightedAllIds
    const timersRef = type === 'recent' ? recentHighlightTimersRef : allHighlightTimersRef

    setState((prev) => ({ ...prev, [id]: true }))

    if (timersRef.current.has(id)) {
      clearTimeout(timersRef.current.get(id))
    }

    const timer = setTimeout(() => {
      setState((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      timersRef.current.delete(id)
    }, 2000)

    timersRef.current.set(id, timer)
  }

  const triggerRecentHighlight = (id) => triggerHighlight(id, 'recent')
  const triggerAllHighlight = (id) => triggerHighlight(id, 'all')

  useEffect(() => {
    return () => {
      recentHighlightTimersRef.current.forEach((timer) => clearTimeout(timer))
      allHighlightTimersRef.current.forEach((timer) => clearTimeout(timer))
    }
  }, [])

  const getWatchStatus = (isoString) => {
    if (!isoString) {
      return {
        text: 'Chưa đăng ký push',
        expired: true,
      }
    }
    const expiry = new Date(isoString)
    if (Number.isNaN(expiry.getTime())) {
      return {
        text: 'Không xác định',
        expired: true,
      }
    }
    const diffMs = expiry.getTime() - Date.now()
    if (diffMs <= 0) {
      return {
        text: 'Đã hết hạn',
        expired: true,
      }
    }
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const days = Math.floor(diffMinutes / (60 * 24))
    const hours = Math.floor((diffMinutes % (60 * 24)) / 60)
    const minutes = diffMinutes % 60
    let text = 'Hết hạn trong '
    if (days > 0) {
      text += `${days} ngày `
    }
    if (hours > 0 || days > 0) {
      text += `${hours} giờ `
    }
    text += `${minutes} phút`
    return {
      text,
      expired: false,
    }
  }

  const handleCloseWelcomeDialog = () => {
    setShowWelcomeDialog(false)
    // Không lưu localStorage, dialog sẽ hiện lại lần sau nếu vẫn chưa có email config
  }

  const handleGoToGuide = () => {
    handleCloseWelcomeDialog()
    navigate('/guide')
  }

  const toggleShowSecret = (configId) => {
    setShowWebhookSecrets((prev) => ({
      ...prev,
      [configId]: !prev[configId],
    }))
  }

  const copyWebhookSecret = async (secret, configId) => {
    try {
      await navigator.clipboard.writeText(secret)
      setCopiedSecretId(configId)
      setTimeout(() => setCopiedSecretId(null), 2000)
    } catch (error) {
      console.error('Failed to copy secret:', error)
      alert('Không thể copy secret. Vui lòng copy thủ công.')
    }
  }

  return (
    <>
      <PageSEO title="Payhook" pathname="/dashboard" robots="noindex,nofollow" />
      <Dialog open={showWelcomeDialog} onOpenChange={setShowWelcomeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chào mừng đến với Payhook! 🎉</DialogTitle>
            <DialogDescription>
              <div className="space-y-3 mt-4 text-base">
                <p>
                  <strong>Payhook</strong> sử dụng <strong>Gmail Push Notifications</strong> để nhận giao dịch tức thời thông qua email được gửi từ ngân hàng Cake by VPBank. Bạn chỉ cần kết nối gmail đã dùng để đăng nhập Cake qua Google OAuth.
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-blue-800 dark:text-blue-200">
                    <strong>⚠️ Lưu ý:</strong> Đọc kỹ hướng dẫn trước khi sử dụng.
                  </p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseWelcomeDialog}>
              Đóng
            </Button>
            <Button onClick={handleGoToGuide}>
              Đọc hướng dẫn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AppLayout
        title="Payhook Monitor"
        subtitle="Theo dõi giao dịch ngân hàng theo thời gian thực"
      >
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          {/* Email Configs Section */}
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                <div className="flex-1">
                  <CardTitle className="text-lg sm:text-xl">Kết nối Gmail</CardTitle>
                  <CardDescription className="text-xs sm:text-sm mt-1">
                    Sử dụng Google OAuth và Gmail Push Notifications để nhận giao dịch tức thời.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  className="w-full sm:w-auto shrink-0"
                  onClick={handleConnectGmail}
                  disabled={isConnectingGmail || isApiRateLimited}
                >
                  {isConnectingGmail ? 'Đang mở Google...' : isApiRateLimited ? 'Too many request, vui lòng thử lại sau' : 'Kết nối Gmail'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">

              {emailConfigs.length === 0 ? (
                <p className="text-center text-gray-500 py-4">
                  Chưa có Gmail nào được kết nối. Nhấn <strong>Kết nối Gmail</strong> để ủy quyền cho Payhook theo dõi hộp thư CAKE của bạn.
                </p>
              ) : (
                <div className="space-y-3">
                  {emailConfigs.map((config) => {
                    const configId = config._id || config.id
                    const watchStatus = getWatchStatus(config.watchExpiration)
                    const lastSyncedText = config.lastSyncedAt ? formatDate(config.lastSyncedAt) : 'Chưa nhận dữ liệu'
                    const watchExpiresAt = config.watchExpiration ? formatDate(config.watchExpiration) : 'Chưa đăng ký'
                    const isEditingWebhook = editingWebhookId === configId
                    return (
                      <Card key={configId} className="bg-white border border-gray-200 hover:shadow-md transition-shadow">
                        <CardContent className="pt-4 pb-4 space-y-4">
                          <div className="flex flex-col gap-3">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-sm sm:text-base break-words">{config.email}</span>
                                <Badge
                                  variant={config.isActive ? 'success' : 'secondary'}
                                  className="text-xs px-1.5 py-0.5 shrink-0"
                                >
                                  {config.isActive ? 'Đang nhận push' : 'Tạm dừng'}
                                </Badge>
                                <Badge
                                  variant={watchStatus.expired ? 'destructive' : 'secondary'}
                                  className="text-xs px-1.5 py-0.5 shrink-0"
                                >
                                  {watchStatus.text}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap gap-2 shrink-0">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs sm:text-sm"
                                  onClick={() => handleToggleConfig(config)}
                                  disabled={updatingConfigId === configId || isApiRateLimited}
                                >
                                  {config.isActive ? 'Tạm dừng' : 'Kích hoạt'}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs sm:text-sm"
                                  onClick={() => handleSendTestEmail(configId)}
                                  disabled={sendingTestEmailId === configId || isApiRateLimited}
                                >
                                  {sendingTestEmailId === configId ? 'Đang gửi...' : 'Gửi email test CAKE'}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs sm:text-sm"
                                  onClick={() => handleDeleteConfig(configId)}
                                  disabled={isApiRateLimited}
                                >
                                  Xóa
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-1 text-xs text-gray-600">
                              <p>
                                Lần đồng bộ gần nhất: <span className="font-medium">{lastSyncedText}</span>
                              </p>
                              <p>
                                Hết hạn push lúc: <span className={watchStatus.expired ? 'text-red-600 font-medium' : 'font-medium'}>{watchExpiresAt}</span>
                                {watchStatus.expired && ' • Payhook đang tự gia hạn, nếu gặp sự cố hãy kết nối lại Gmail.'}
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`webhook-${configId}`}>Webhook URL</Label>
                              {isEditingWebhook ? (
                                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                                  <Input
                                    id={`webhook-${configId}`}
                                    type="url"
                                    placeholder="https://your-domain.com/webhook/payhook"
                                    value={webhookDrafts[configId] ?? ''}
                                    onChange={(e) => handleWebhookChange(configId, e.target.value)}
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => handleSaveWebhook(configId)}
                                      disabled={updatingConfigId === configId || isApiRateLimited}
                                    >
                                      {updatingConfigId === configId ? 'Đang lưu...' : isApiRateLimited ? 'Too many request' : 'Lưu'}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleCancelWebhookEdit(configId)}
                                      disabled={updatingConfigId === configId}
                                    >
                                      Hủy
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                  <span className="text-sm text-gray-700 break-all">
                                    {config.webhookUrl || <span className="italic text-gray-400">Chưa cấu hình</span>}
                                  </span>
                                  <div className="flex gap-2 shrink-0">
                                    <Button
                                      size="sm"
                                      onClick={() => handleEditWebhook(configId, config.webhookUrl || '')}
                                      disabled={isApiRateLimited}
                                    >
                                      {config.webhookUrl ? 'Chỉnh sửa' : 'Thêm webhook'}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Webhook Secret */}
                            {config.webhookUrl && config.webhookSecret && (
                              <div className="space-y-2">
                                <Label>Webhook Secret</Label>
                                <Alert className="bg-blue-50 border-blue-200">
                                  <AlertDescription className="text-blue-800 text-xs">
                                    <strong>Lưu ý:</strong> Secret này dùng để verify webhook signature. Hãy lưu vào biến môi trường hoặc secure storage.
                                  </AlertDescription>
                                </Alert>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 relative">
                                    <Input
                                      type={showWebhookSecrets[configId] ? 'text' : 'password'}
                                      value={config.webhookSecret}
                                      readOnly
                                      className="font-mono text-xs pr-20"
                                    />
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() => toggleShowSecret(configId)}
                                      >
                                        {showWebhookSecrets[configId] ? (
                                          <IconEyeOff className="h-4 w-4" />
                                        ) : (
                                          <IconEye className="h-4 w-4" />
                                        )}
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() => copyWebhookSecret(config.webhookSecret, configId)}
                                      >
                                        {copiedSecretId === configId ? (
                                          <IconCheck className="h-4 w-4 text-green-600" />
                                        ) : (
                                          <IconCopy className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transactions Section */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Giao dịch mới nhất</CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">
                Danh sách các giao dịch đã phát hiện
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-gray-500 py-4">Đang tải...</p>
              ) : transactions.length === 0 ? (
                <p className="text-center text-gray-500 py-4">Chưa có giao dịch nào</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ngân hàng</TableHead>
                        <TableHead>Số tiền</TableHead>
                        <TableHead>Thời gian</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => (
                        <TableRow
                          key={getTransactionKey(tx)}
                          className={cn(
                            'hover:bg-gray-50/50 transition-colors',
                            highlightedRecentIds[getTransactionKey(tx)] && 'realtime-highlight-row'
                          )}
                        >
                          <TableCell>
                            <Badge variant="default">{tx.bank}</Badge>
                          </TableCell>
                          <TableCell className="font-semibold text-green-600">
                            {formatCurrency(tx.amountVND)}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {formatDate(tx.detectedAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <NotificationSettings className="lg:col-span-2" />

        </div>

        {/* All Transactions Table */}
        {allTransactions.length > 0 && (
          <Card className="mt-4 sm:mt-6 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Chi tiết giao dịch</CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">
                Xem thông tin chi tiết của các giao dịch
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                ref={transactionsContainerRef}
                className="overflow-x-auto overflow-y-auto -mx-6 sm:mx-0 max-h-[600px]"
                style={{ scrollBehavior: 'smooth' }}
              >
                <div className="inline-block min-w-full align-middle">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">Transaction ID</TableHead>
                        <TableHead className="text-xs sm:text-sm">Ngân hàng</TableHead>
                        <TableHead className="text-xs sm:text-sm">Số tiền</TableHead>
                        <TableHead className="text-xs sm:text-sm min-w-[200px]">Nội dung</TableHead>
                        <TableHead className="text-xs sm:text-sm">Thời gian</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allTransactions.map((tx) => (
                        <TableRow
                          key={getTransactionKey(tx)}
                          className={cn(
                            'hover:bg-gray-50/50 transition-colors',
                            highlightedAllIds[getTransactionKey(tx)] && 'realtime-highlight-row'
                          )}
                        >
                          <TableCell className="font-mono text-xs sm:text-sm">
                            {tx.transactionId || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="default" className="text-xs">{tx.bank}</Badge>
                          </TableCell>
                          <TableCell className="font-semibold text-green-600 text-sm sm:text-base">
                            {formatCurrency(tx.amountVND)}
                          </TableCell>
                          <TableCell className="min-w-[200px] max-w-md sm:max-w-lg">
                            <div className="text-xs sm:text-sm break-words whitespace-normal pr-2">
                              {tx.description || '-'}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                            {formatDate(tx.detectedAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {transactionsLoading && (
                    <div className="text-center py-4 text-gray-500">
                      Đang tải thêm...
                    </div>
                  )}
                  {!hasMoreTransactions && allTransactions.length > 0 && (
                    <div className="text-center py-4 text-gray-500">
                      Đã hiển thị tất cả giao dịch
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </AppLayout>
    </>
  )
}


