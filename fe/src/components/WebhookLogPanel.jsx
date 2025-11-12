import { Fragment, useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { webhookLogsAPI } from '@/lib/api'

const statusLabels = {
  pending: 'Đang xử lý',
  retrying: 'Đang thử lại',
  success: 'Thành công',
  failed: 'Thất bại',
}

const statusVariants = {
  pending: 'secondary',
  retrying: 'secondary',
  success: 'success',
  failed: 'destructive',
}

function formatDate(value) {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString('vi-VN')
  } catch (error) {
    return String(value)
  }
}

function formatDuration(ms) {
  if (typeof ms !== 'number') return '-'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function stringifyPayload(payload) {
  if (!payload) return 'Không có dữ liệu'
  if (typeof payload === 'string') return payload
  try {
    return JSON.stringify(payload, null, 2)
  } catch (error) {
    return String(payload)
  }
}

function buildFilters(filterObj = {}) {
  const cleaned = {}
  Object.entries(filterObj).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      cleaned[key] = value
    }
  })
  return cleaned
}

export default function WebhookLogPanel({
  title = 'Webhook Log',
  description = 'Theo dõi lịch sử gửi webhook',
  filters = {},
  pageSize = 10,
  showUserColumn = false,
  className = '',
  showStatusFilter = true,
  showSearch = true,
}) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, page: 1, limit: pageSize })
  const [statusFilter, setStatusFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [expandedLogId, setExpandedLogId] = useState(null)

  const filtersKey = useMemo(() => JSON.stringify(buildFilters(filters)), [filters])
  const columnCount = showUserColumn ? 8 : 7
  const refreshRef = useRef(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        page,
        limit: pageSize,
        ...buildFilters(filters),
      }
      if (statusFilter) params.status = statusFilter
      if (appliedSearch) params.search = appliedSearch

      const response = await webhookLogsAPI.list(params)
      if (response.success) {
        setLogs(response.logs || [])
        setPagination(response.pagination || { total: 0, totalPages: 1, page: 1, limit: pageSize })
      } else {
        setLogs([])
      }
    } catch (error) {
      console.error('Error fetching webhook logs:', error)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, filters, statusFilter, appliedSearch])

  useEffect(() => {
    setPage(1)
  }, [filtersKey])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Expose refresh function để Dashboard có thể gọi khi nhận WebSocket event
  useEffect(() => {
    refreshRef.current = fetchLogs
    window.webhookLogPanelRefresh = fetchLogs
    
    return () => {
      if (window.webhookLogPanelRefresh === fetchLogs) {
        delete window.webhookLogPanelRefresh
      }
    }
  }, [fetchLogs])

  const handleRefresh = () => {
    fetchLogs()
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setPage(1)
    setAppliedSearch(searchTerm.trim())
  }

  const toggleExpanded = (logId) => {
    setExpandedLogId((current) => (current === logId ? null : logId))
  }

  return (
    <Card className={`shadow-sm ${className}`}>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-start">
          <div>
            <CardTitle className="text-lg sm:text-xl">{title}</CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">
              {description}
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            {showStatusFilter && (
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPage(1)
                }}
                className="w-full sm:w-48 border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="success">Thành công</option>
                <option value="failed">Thất bại</option>
                <option value="retrying">Đang retry</option>
                <option value="pending">Đang xử lý</option>
              </select>
            )}
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              Làm mới
            </Button>
          </div>
        </div>
        {showSearch && (
          <form onSubmit={handleSearchSubmit} className="mt-3 flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Tìm theo transaction ID, URL, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Button type="submit" size="sm" className="sm:w-auto">
              Tìm kiếm
            </Button>
          </form>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto border border-gray-200 rounded-md">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="whitespace-nowrap">Thời gian</TableHead>
                {showUserColumn && <TableHead>Người dùng</TableHead>}
                <TableHead>Webhook URL</TableHead>
                <TableHead>Transaction ID</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Lần thử</TableHead>
                <TableHead>Status Code</TableHead>
                <TableHead className="text-right">Chi tiết</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columnCount} className="text-center py-8 text-sm text-gray-500">
                    {loading ? 'Đang tải dữ liệu...' : 'Chưa có log webhook nào'}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => {
                  const lastAttempt = Array.isArray(log.attempts) && log.attempts.length > 0
                    ? log.attempts[log.attempts.length - 1]
                    : null
                  const badgeVariant = statusVariants[log.status] || 'secondary'
                  return (
                    <Fragment key={log._id}>
                      <TableRow className="hover:bg-gray-50">
                        <TableCell className="whitespace-nowrap text-sm">{formatDate(log.createdAt)}</TableCell>
                        {showUserColumn && (
                          <TableCell className="text-sm">
                            {log.userEmail || log.userId || '—'}
                          </TableCell>
                        )}
                        <TableCell className="max-w-[220px] text-sm break-words">
                          {log.webhookUrl}
                        </TableCell>
                        <TableCell className="text-sm break-all">
                          {log.transactionId || log.transactionDocId || '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          <Badge variant={badgeVariant}>{statusLabels[log.status] || log.status}</Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {log.totalAttempts || (log.attempts?.length ?? 0)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.finalStatusCode ?? lastAttempt?.statusCode ?? '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleExpanded(log._id)}
                          >
                            {expandedLogId === log._id ? 'Ẩn' : 'Xem'}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expandedLogId === log._id && (
                        <TableRow>
                          <TableCell colSpan={columnCount} className="bg-gray-50">
                            <div className="p-4 space-y-4 border border-gray-200 rounded-md bg-white">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                    Webhook
                                  </p>
                                  <p className="text-sm text-gray-800 break-words">{log.webhookUrl}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                    Trạng thái cuối
                                  </p>
                                  <p className="text-sm text-gray-800">
                                    {statusLabels[log.status] || log.status} ({log.finalStatusCode ?? lastAttempt?.statusCode ?? '—'})
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                    Transaction
                                  </p>
                                  <p className="text-sm text-gray-800 break-all">
                                    {log.transactionId || log.transactionDocId || '—'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                    Lỗi gần nhất
                                  </p>
                                  <p className="text-sm text-red-500 break-words">
                                    {log.lastError || 'Không có'}
                                  </p>
                                </div>
                              </div>

                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                  Payload gửi đi
                                </p>
                                <pre className="bg-gray-900 text-gray-100 text-xs rounded-md p-3 overflow-auto max-h-64">
                                  {stringifyPayload(log.payload)}
                                </pre>
                              </div>

                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                  Lịch sử attempts
                                </p>
                                {log.attempts?.length ? (
                                  <div className="overflow-x-auto border border-gray-200 rounded-md">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Attempt</TableHead>
                                          <TableHead>Thời gian</TableHead>
                                          <TableHead>Kết thúc</TableHead>
                                          <TableHead>Status Code</TableHead>
                                          <TableHead>Kết quả</TableHead>
                                          <TableHead>Thời lượng</TableHead>
                                          <TableHead>Thông tin</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {log.attempts.map((attempt) => (
                                          <TableRow key={`${log._id}-${attempt.attemptNumber}`}>
                                            <TableCell>{attempt.attemptNumber}</TableCell>
                                            <TableCell>{formatDate(attempt.requestedAt)}</TableCell>
                                            <TableCell>{formatDate(attempt.completedAt)}</TableCell>
                                            <TableCell>{attempt.statusCode ?? '—'}</TableCell>
                                            <TableCell>
                                              <Badge variant={attempt.success ? 'success' : 'destructive'}>
                                                {attempt.success ? 'Thành công' : 'Thất bại'}
                                              </Badge>
                                            </TableCell>
                                            <TableCell>{formatDuration(attempt.durationMs)}</TableCell>
                                            <TableCell className="text-sm text-gray-700 break-words">
                                              {attempt.errorMessage || stringifyPayload(attempt.responseBody)}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500">Chưa có attempt nào.</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500">
            Trang {pagination.page} / {pagination.totalPages} · Tổng {pagination.total} bản ghi
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={page <= 1 || loading}
            >
              Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => (prev < pagination.totalPages ? prev + 1 : prev))}
              disabled={page >= pagination.totalPages || loading}
            >
              Sau
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}


