import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { usersAPI, transactionsAPI, WS_BASE_URL } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { AppLayout } from '@/components/AppLayout'
import WebhookLogPanel from '@/components/WebhookLogPanel'

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  const wsRef = useRef(null)
  const MAX_TRANSACTIONS = 100

  useEffect(() => {
    if (user?.role === 'admin') {
      loadData()
    }
  }, [user])

  useEffect(() => {
    if (user?.role === 'admin') {
      loadTransactions()
    }
  }, [selectedUserId])

  useEffect(() => {
    if (user?.role !== 'admin') return

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
          if (payload.event === 'transaction:new' && payload.data) {
            setTransactions((prev) => {
              const incomingId = payload.data._id?.$oid || payload.data._id
              if (!incomingId) return prev
              const exists = prev.some((tx) => {
                const existingId = tx?._id?.$oid || tx?._id
                return existingId === incomingId
              })
              if (exists) {
                return prev
              }
              const updated = [payload.data, ...prev]
              return updated.slice(0, MAX_TRANSACTIONS)
            })
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

  const loadData = async () => {
    setLoading(true)
    try {
      await Promise.all([loadUsers(), loadTransactions()])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      const response = await usersAPI.getAll({ limit: 100 })
      setUsers(response.users || [])
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }

  const loadTransactions = async () => {
    try {
      const params = { limit: 100 }
      if (selectedUserId) {
        params.userId = selectedUserId
      }
      const response = await transactionsAPI.getAll(params)
      setTransactions(response.transactions || [])
    } catch (error) {
      console.error('Error loading transactions:', error)
    }
  }

  const handleUpdateRole = async (userId, newRole) => {
    try {
      await usersAPI.updateRole(userId, newRole)
      await loadUsers()
    } catch (error) {
      alert(error.response?.data?.error || 'Lỗi khi cập nhật role')
    }
  }

  const handleDeleteUser = async (userId) => {
    if (!confirm('Bạn có chắc muốn xóa user này?')) return
    try {
      await usersAPI.delete(userId)
      await loadUsers()
      if (selectedUserId === userId) {
        setSelectedUserId(null)
      }
    } catch (error) {
      alert(error.response?.data?.error || 'Lỗi khi xóa user')
    }
  }

  // Convert userId to string for comparison
  const userIdToString = (userId) => {
    if (!userId) return null
    if (typeof userId === 'string') return userId
    if (userId.toString) return userId.toString()
    return String(userId)
  }

  // Lấy username từ userId
  const getUsernameById = (userId) => {
    if (!userId) return 'Unknown'
    const txUserId = userIdToString(userId)
    const foundUser = users.find(u => {
      const uId = userIdToString(u._id || u.id)
      return uId === txUserId
    })
    return foundUser?.username || 'Unknown'
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

  const filteredUsers = users.filter(u =>
    u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredTransactions = transactions.filter(tx => {
    if (!selectedUserId) return true
    const txUserId = userIdToString(tx.userId)
    return txUserId === selectedUserId
  })

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-red-600">Bạn không có quyền truy cập trang này</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <AppLayout
      title="Admin Dashboard"
      subtitle="Quản lý người dùng và giao dịch trong hệ thống"
    >
              <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          {/* Users Management */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Quản lý Users</CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">
                Quản lý tất cả users trong hệ thống
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Tìm kiếm user..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />

              {loading ? (
                <p className="text-center text-gray-500 py-4">Đang tải...</p>
              ) : filteredUsers.length === 0 ? (
                <p className="text-center text-gray-500 py-4">Không có user nào</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredUsers.map((u) => (
                    <Card key={u._id || u.id} className="bg-white border border-gray-200">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="font-medium text-sm sm:text-base break-words">
                                {u.username}
                              </span>
                              <Badge
                                variant={u.role === 'admin' ? 'default' : 'secondary'}
                                className="text-xs px-1.5 py-0.5 shrink-0"
                              >
                                {u.role || 'user'}
                              </Badge>
                            </div>
                            <p className="text-xs sm:text-sm text-gray-600 break-words">{u.email}</p>
                          </div>
                          <div className="flex flex-wrap gap-2 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs sm:text-sm"
                              onClick={() => {
                                const uId = u._id?.toString() || u.id?.toString()
                                setSelectedUserId(selectedUserId === uId ? null : uId)
                              }}
                            >
                              {selectedUserId === (u._id?.toString() || u.id?.toString()) ? 'Bỏ lọc' : 'Xem GD'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs sm:text-sm"
                              onClick={() => handleUpdateRole(u._id?.toString() || u.id, u.role === 'admin' ? 'user' : 'admin')}
                            >
                              {u.role === 'admin' ? '→ User' : '→ Admin'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs sm:text-sm text-red-600 hover:text-red-700"
                              onClick={() => handleDeleteUser(u._id?.toString() || u.id)}
                              disabled={u._id?.toString() === user._id?.toString()}
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

          {/* Transactions Overview */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Tổng quan Giao dịch</CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">
                {selectedUserId ? `Giao dịch của user: ${getUsernameById(selectedUserId)}` : 'Tất cả giao dịch trong hệ thống'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-gray-500 py-4">Đang tải...</p>
              ) : filteredTransactions.length === 0 ? (
                <p className="text-center text-gray-500 py-4">Chưa có giao dịch nào</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">User</TableHead>
                        <TableHead className="text-xs sm:text-sm">Ngân hàng</TableHead>
                        <TableHead className="text-xs sm:text-sm">Số tiền</TableHead>
                        <TableHead className="text-xs sm:text-sm">Thời gian</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.slice(0, 10).map((tx) => (
                        <TableRow key={tx._id} className="hover:bg-gray-50/50">
                          <TableCell className="text-xs sm:text-sm">
                            {getUsernameById(tx.userId)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="default" className="text-xs">{tx.bank}</Badge>
                          </TableCell>
                          <TableCell className="font-semibold text-green-600 text-sm sm:text-base">
                            {formatCurrency(tx.amountVND)}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">
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

          <WebhookLogPanel
            className="lg:col-span-2"
            title="Webhook gần đây"
            description={
              selectedUserId
                ? `Log webhook dành cho user: ${getUsernameById(selectedUserId)}`
                : 'Tất cả webhook đã gửi trong hệ thống'
            }
            filters={{ userId: selectedUserId || undefined }}
            pageSize={15}
            showUserColumn
          />
        </div>

        {/* All Transactions Table */}
        {filteredTransactions.length > 0 && (
          <Card className="mt-4 sm:mt-6 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Chi tiết Giao dịch</CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">
                {selectedUserId ? `Giao dịch của user: ${getUsernameById(selectedUserId)}` : 'Tất cả giao dịch trong hệ thống'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-6 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">User</TableHead>
                        <TableHead className="text-xs sm:text-sm">Transaction ID</TableHead>
                        <TableHead className="text-xs sm:text-sm">Ngân hàng</TableHead>
                        <TableHead className="text-xs sm:text-sm">Số tiền</TableHead>
                        <TableHead className="text-xs sm:text-sm min-w-[200px]">Nội dung</TableHead>
                        <TableHead className="text-xs sm:text-sm">Thời gian</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.map((tx) => (
                        <TableRow key={tx._id} className="hover:bg-gray-50/50">
                          <TableCell className="text-xs sm:text-sm font-medium">
                            {getUsernameById(tx.userId)}
                          </TableCell>
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
                </div>
              </div>
            </CardContent>
          </Card>
        )}
    </AppLayout>
  )
}

