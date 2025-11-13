import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { emailConfigAPI, transactionsAPI, WS_BASE_URL } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { AppLayout } from '@/components/AppLayout'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [emailConfigs, setEmailConfigs] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(false)
  const [showAddConfig, setShowAddConfig] = useState(false)
  const [formMode, setFormMode] = useState('create') // 'create' | 'edit'
  const [editingConfigId, setEditingConfigId] = useState(null)
  const [newConfig, setNewConfig] = useState({
    email: '',
    appPassword: '',
    scanInterval: Number(import.meta.env.VITE_SCAN_INTERVAL_MS) || 1000,
    webhookUrl: '',
  })
  const wsRef = useRef(null)
  const MAX_RECENT_TRANSACTIONS = 5
  const [allTransactions, setAllTransactions] = useState([])
  const [transactionsPage, setTransactionsPage] = useState(1)
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [hasMoreTransactions, setHasMoreTransactions] = useState(true)
  const transactionsContainerRef = useRef(null)
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false)
  const [configsLoaded, setConfigsLoaded] = useState(false) // Track xem đã load configs lần đầu chưa

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
              return updated.slice(0, MAX_RECENT_TRANSACTIONS)
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
      await Promise.all([loadConfigs(), loadTransactions()])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadConfigs = async () => {
    try {
      const response = await emailConfigAPI.getAll()
      setEmailConfigs(response.configs || [])
      setConfigsLoaded(true) // Đánh dấu đã load xong configs
    } catch (error) {
      console.error('Error loading configs:', error)
      setConfigsLoaded(true) // Vẫn đánh dấu đã load (dù có lỗi) để tránh dialog hiện khi đang load
    }
  }

  const loadTransactions = async () => {
    try {
      // Load 5 transactions mới nhất cho "Giao dịch mới nhất"
      const recentResponse = await transactionsAPI.getAll({ limit: MAX_RECENT_TRANSACTIONS })
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

  const resetForm = () => {
    setNewConfig({
      email: '',
      appPassword: '',
      scanInterval: Number(import.meta.env.VITE_SCAN_INTERVAL_MS) || 1000,
      webhookUrl: '',
    })
    setFormMode('create')
    setEditingConfigId(null)
    setShowAddConfig(false)
  }

  const handleSubmitConfig = async (e) => {
    e.preventDefault()
    const payload = {
      email: newConfig.email.trim(),
      scanInterval: Number(newConfig.scanInterval),
      webhookUrl: newConfig.webhookUrl?.trim() || null,
    }

    if (Number.isNaN(payload.scanInterval) || payload.scanInterval <= 0) {
      alert('Scan interval phải lớn hơn 0')
      return
    }

    try {
      if (formMode === 'create') {
        if (!newConfig.appPassword.trim()) {
          alert('Vui lòng nhập App Password')
          return
        }
        await emailConfigAPI.create({
          ...payload,
          appPassword: newConfig.appPassword,
        })
      } else if (editingConfigId) {
        const updatePayload = { ...payload }
        if (newConfig.appPassword.trim()) {
          updatePayload.appPassword = newConfig.appPassword
        }
        await emailConfigAPI.update(editingConfigId, updatePayload)
      }

      resetForm()
      await loadConfigs()
    } catch (error) {
      alert(error.response?.data?.error || 'Lỗi khi lưu cấu hình')
    }
  }

  const handleEditConfig = (config) => {
    setFormMode('edit')
    setEditingConfigId(config._id || config.id)
    setNewConfig({
      email: config.email || '',
      appPassword: '',
      scanInterval: config.scanInterval || Number(import.meta.env.VITE_SCAN_INTERVAL_MS) || 1000,
      webhookUrl: config.webhookUrl || '',
    })
    setShowAddConfig(true)
  }

  const handleToggleConfig = async (config) => {
    try {
      const configId = config._id || config.id
      await emailConfigAPI.update(configId, { isActive: !config.isActive })
      await loadConfigs()
    } catch (error) {
      alert(error.response?.data?.error || 'Lỗi khi cập nhật')
    }
  }

  const handleDeleteConfig = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa cấu hình này?')) return
    try {
      await emailConfigAPI.delete(id)
      if (editingConfigId === id) {
        resetForm()
      }
      await loadConfigs()
    } catch (error) {
      alert(error.response?.data?.error || 'Lỗi khi xóa')
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

  const handleCloseWelcomeDialog = () => {
    setShowWelcomeDialog(false)
    // Không lưu localStorage, dialog sẽ hiện lại lần sau nếu vẫn chưa có email config
  }

  const handleGoToGuide = () => {
    handleCloseWelcomeDialog()
    navigate('/guide')
  }

  return (
    <>
      <Dialog open={showWelcomeDialog} onOpenChange={setShowWelcomeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chào mừng đến với Payhook! 🎉</DialogTitle>
            <DialogDescription>
              <div className="space-y-3 mt-4 text-base">
                <p>
                  <strong>Payhook</strong> là hệ thống quét email dựa vào <strong>App Password</strong> để nhận thông báo giao dịch từ ngân hàng <strong>CAKE</strong>.
                </p>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-yellow-800 dark:text-yellow-200">
                    <strong>⚠️ Lưu ý quan trọng:</strong> Có sự delay giữa server Gmail và server Payhook, nên có thể mất từ <strong>10-20 giây</strong> để nhận thông tin giao dịch sau khi email được gửi.
                  </p>
                </div>
                <p>
                  Vui lòng đọc <strong>hướng dẫn</strong> trước khi sử dụng để đảm bảo cấu hình đúng cách.
                </p>
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
                  <CardTitle className="text-lg sm:text-xl">Cấu hình Email</CardTitle>
                  <CardDescription className="text-xs sm:text-sm mt-1">
                    Quản lý email để nhận thông báo giao dịch
                  </CardDescription>
                </div>
                <Button 
                  size="sm"
                  className="w-full sm:w-auto shrink-0"
                  onClick={() => {
                    if (showAddConfig) {
                      resetForm()
                    } else {
                      setFormMode('create')
                      setEditingConfigId(null)
                      setShowAddConfig(true)
                    }
                  }}
                >
                  {showAddConfig ? 'Đóng' : '+ Thêm mới'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {showAddConfig && (
                <Card className="bg-gray-50/50 border-2 border-dashed border-gray-300">
                  <CardContent className="pt-6">
                    <form onSubmit={handleSubmitConfig} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold">
                          {formMode === 'create' ? 'Thêm cấu hình mới' : 'Cập nhật cấu hình'}
                        </h4>
                        {formMode === 'edit' && (
                          <span className="text-xs text-gray-500">
                            Để trống App Password nếu không muốn thay đổi
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Email đã đăng ký với ngân hàng Cake by VPBank</Label>
                        <Input
                          type="email"
                          placeholder="your-email@gmail.com"
                          value={newConfig.email}
                          onChange={(e) => setNewConfig({ ...newConfig, email: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>App Password</Label>
                        <Input
                          type="password"
                          placeholder="Nhập Gmail App Password"
                          value={newConfig.appPassword}
                          onChange={(e) => {
                            // Tự động xóa tất cả dấu cách (Google thường hiển thị App Password với dấu cách)
                            const cleanedValue = e.target.value.replace(/\s/g, '')
                            setNewConfig({ ...newConfig, appPassword: cleanedValue })
                          }}
                          required={formMode === 'create'}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Scan Interval (ms)</Label>
                        <Input
                          type="number"
                          value={newConfig.scanInterval}
                          onChange={(e) => setNewConfig({ ...newConfig, scanInterval: parseInt(e.target.value) })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Webhook URL (tùy chọn)</Label>
                        <Input
                          type="url"
                          placeholder="https://your-domain.com/webhook/payhook"
                          value={newConfig.webhookUrl}
                          onChange={(e) => setNewConfig({ ...newConfig, webhookUrl: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button type="submit" className="w-full sm:flex-1">
                          {formMode === 'create' ? 'Thêm cấu hình' : 'Cập nhật cấu hình'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={resetForm}
                        >
                          Hủy
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {emailConfigs.length === 0 ? (
                <p className="text-center text-gray-500 py-4">Chưa có cấu hình nào</p>
              ) : (
                <div className="space-y-3">
                  {emailConfigs.map((config) => (
                    <Card key={config._id || config.id} className="bg-white border border-gray-200 hover:shadow-md transition-shadow">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="font-medium text-sm sm:text-base break-words">{config.email}</span>
                              <Badge 
                                variant={config.isActive ? 'success' : 'secondary'}
                                className="text-xs px-1.5 py-0.5 shrink-0"
                              >
                                {config.isActive ? 'Đang hoạt động' : 'Tạm dừng'}
                              </Badge>
                            </div>
                            <p className="text-xs sm:text-sm text-gray-600">
                              Quét mỗi {Math.round(config.scanInterval / 1000)}s
                            </p>
                            <p className="text-xs text-gray-500 break-all mt-1">
                              Webhook: {config.webhookUrl ? (
                                <a
                                  href={config.webhookUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  {config.webhookUrl}
                                </a>
                              ) : (
                                <span className="italic text-gray-400">Chưa cấu hình</span>
                              )}
                            </p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs sm:text-sm"
                              onClick={() => handleEditConfig(config)}
                            >
                              Sửa
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs sm:text-sm"
                              onClick={() => handleToggleConfig(config)}
                            >
                              {config.isActive ? 'Tạm dừng' : 'Kích hoạt'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs sm:text-sm"
                              onClick={() => handleDeleteConfig(config._id || config.id)}
                            >
                              Xóa
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
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
                        <TableRow key={tx._id}>
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
                        <TableRow key={tx._id} className="hover:bg-gray-50/50">
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

