import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { emailConfigAPI, transactionsAPI } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [emailConfigs, setEmailConfigs] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(false)
  const [showAddConfig, setShowAddConfig] = useState(false)
  const [newConfig, setNewConfig] = useState({
    email: '',
    appPassword: '',
    scanInterval: 30000,
  })

  useEffect(() => {
    loadData()
    // Refresh transactions every 10 seconds
    const interval = setInterval(loadTransactions, 10000)
    return () => clearInterval(interval)
  }, [])

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
    } catch (error) {
      console.error('Error loading configs:', error)
    }
  }

  const loadTransactions = async () => {
    try {
      const response = await transactionsAPI.getAll({ limit: 20 })
      setTransactions(response.transactions || [])
    } catch (error) {
      console.error('Error loading transactions:', error)
    }
  }

  const handleAddConfig = async (e) => {
    e.preventDefault()
    try {
      await emailConfigAPI.create(newConfig)
      setNewConfig({ email: '', appPassword: '', scanInterval: 30000 })
      setShowAddConfig(false)
      await loadConfigs()
    } catch (error) {
      alert(error.response?.data?.error || 'Lỗi khi thêm cấu hình')
    }
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-primary">Payhook Monitor</h1>
            <div className="flex items-center gap-3 sm:gap-4">
              <span className="text-xs sm:text-sm text-gray-600">Xin chào, {user?.username}</span>
              <Button variant="outline" size="sm" className="text-xs sm:text-sm" onClick={logout}>
                Đăng xuất
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
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
                  onClick={() => setShowAddConfig(!showAddConfig)}
                >
                  {showAddConfig ? 'Hủy' : '+ Thêm mới'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {showAddConfig && (
                <Card className="bg-gray-50/50 border-2 border-dashed border-gray-300">
                  <CardContent className="pt-6">
                    <form onSubmit={handleAddConfig} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Email</Label>
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
                          onChange={(e) => setNewConfig({ ...newConfig, appPassword: e.target.value })}
                          required
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
                      <Button type="submit" className="w-full">Thêm cấu hình</Button>
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
                              Quét mỗi {config.scanInterval / 1000}s
                            </p>
                          </div>
                          <div className="flex gap-2 shrink-0">
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
        {transactions.length > 0 && (
          <Card className="mt-4 sm:mt-6 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Chi tiết giao dịch</CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">
                Xem thông tin chi tiết của các giao dịch
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-6 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">Mã GD</TableHead>
                        <TableHead className="text-xs sm:text-sm">Ngân hàng</TableHead>
                        <TableHead className="text-xs sm:text-sm">Số tiền</TableHead>
                        <TableHead className="text-xs sm:text-sm min-w-[200px]">Nội dung</TableHead>
                        <TableHead className="text-xs sm:text-sm">Thời gian</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => (
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
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

