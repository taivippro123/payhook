import { useEffect, useState } from 'react'
import { AppLayout } from '@/components/AppLayout'
import { PageSEO } from '@/components/SEO'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { billingAPI, appendNgrokSkipBrowserWarning } from '@/lib/api'
import { Check, CheckCircle2, Copy, CreditCard, LoaderCircle } from 'lucide-react'

const planOrder = ['free', 'pro', 'unlimited']

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('vi-VN') : '-'
}

export default function Billing() {
  const [plans, setPlans] = useState([])
  const [status, setStatus] = useState(null)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState('')
  const [error, setError] = useState('')
  const [paymentSuccess, setPaymentSuccess] = useState(false)

  const loadBilling = async () => {
    try {
      setError('')
      const [plansResponse, statusResponse] = await Promise.all([
        billingAPI.getPlans(),
        billingAPI.getStatus(),
      ])
      setPlans((plansResponse.plans || []).sort((a, b) => planOrder.indexOf(a.id) - planOrder.indexOf(b.id)))
      setStatus(statusResponse)
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể tải thông tin gói dịch vụ.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBilling()
  }, [])

  useEffect(() => {
    if (!selectedOrder || selectedOrder.status !== 'pending') return undefined

    let active = true
    const pollPayment = async () => {
      try {
        const response = await billingAPI.getStatus()
        if (!active) return
        setStatus(response)
        const updatedOrder = response.orders?.find((order) => order.orderCode === selectedOrder.orderCode)
        if (updatedOrder?.status === 'paid') {
          setSelectedOrder(updatedOrder)
          setPaymentSuccess(true)
        }
      } catch (err) {
        console.error('Payment status polling failed:', err)
      }
    }

    const interval = window.setInterval(pollPayment, 3000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [selectedOrder?.orderCode, selectedOrder?.status])

  useEffect(() => {
    if (!paymentSuccess) return undefined
    const timeout = window.setTimeout(() => {
      setSelectedOrder(null)
      setPaymentSuccess(false)
    }, 5000)
    return () => window.clearTimeout(timeout)
  }, [paymentSuccess])

  const handleBuy = async (planId) => {
    try {
      setBuying(planId)
      setError('')
      setPaymentSuccess(false)
      const response = await billingAPI.createOrder(planId)
      setSelectedOrder(response.order)
      await loadBilling()
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể tạo đơn thanh toán.')
    } finally {
      setBuying('')
    }
  }

  const copyOrderCode = async () => {
    if (!selectedOrder?.orderCode) return
    await navigator.clipboard.writeText(selectedOrder.orderCode)
  }

  if (loading) {
    return (
      <AppLayout title="Gói dịch vụ" subtitle="Theo dõi hạn mức và nâng cấp Payhook">
        <div className="flex items-center gap-2 text-sm text-gray-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Đang tải...</div>
      </AppLayout>
    )
  }

  const used = status?.used || 0
  const limit = status?.plan?.transactionLimit
  const progress = limit ? Math.min((used / limit) * 100, 100) : 0

  return (
    <>
      <PageSEO title="Gói dịch vụ | Payhook" pathname="/billing" robots="noindex,nofollow" />
      <AppLayout title="Gói dịch vụ" subtitle="Theo dõi hạn mức và nâng cấp Payhook">
        <div className="space-y-6">
          {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Gói hiện tại: {status?.plan?.name}</CardTitle>
                  <CardDescription>Chu kỳ {formatDate(status?.periodStart)} - {formatDate(status?.periodEnd)}</CardDescription>
                </div>
                <Badge variant={status?.isExhausted ? 'destructive' : 'secondary'}>
                  {status?.isExhausted ? 'Đã hết lượt' : 'Đang hoạt động'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between text-sm">
                <span className="text-gray-600">Đã sử dụng</span>
                <strong>{used.toLocaleString('vi-VN')} / {limit === null ? 'Không giới hạn' : limit.toLocaleString('vi-VN')}</strong>
              </div>
              {limit !== null && <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} /></div>}
              <p className="mt-2 text-xs text-gray-500">Còn lại: {status?.remaining === null ? 'Không giới hạn' : status?.remaining?.toLocaleString('vi-VN')}</p>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = plan.id === status?.plan?.id
              return (
                <Card key={plan.id} className={isCurrent ? 'border-blue-500 shadow-md' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle>{plan.name}</CardTitle>
                      {isCurrent && <Badge>Đang dùng</Badge>}
                    </div>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-2xl font-bold">{plan.price ? formatCurrency(plan.price) : 'Miễn phí'}<span className="text-sm font-normal text-gray-500"> / tháng</span></div>
                    <div className="flex items-center gap-2 text-sm text-gray-700"><Check className="h-4 w-4 text-emerald-600" />{plan.transactionLimit === null ? 'Không giới hạn giao dịch' : `${plan.transactionLimit.toLocaleString('vi-VN')} giao dịch/tháng`}</div>
                    <div className="flex items-center gap-2 text-sm text-gray-700"><Check className="h-4 w-4 text-emerald-600" />Webhook và API</div>
                    {plan.id !== 'free' && <Button className="w-full" onClick={() => handleBuy(plan.id)} disabled={Boolean(buying) || isCurrent}><CreditCard className="mr-2 h-4 w-4" />{buying === plan.id ? 'Đang tạo đơn...' : isCurrent ? 'Đang sử dụng' : 'Mua gói'}</Button>}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {selectedOrder && !paymentSuccess && (
            <Card className="border-amber-200 bg-amber-50/40">
              <CardHeader>
                <CardTitle className="text-lg">Thanh toán đơn {selectedOrder.orderCode}</CardTitle>
                <CardDescription>Quét QR, chuyển đúng số tiền và ghi đúng nội dung. Hệ thống sẽ tự động xác nhận khi nhận được tiền.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5 md:flex-row md:items-center">
                <img className="h-56 w-56 rounded-md border bg-white object-contain" src={appendNgrokSkipBrowserWarning(selectedOrder.qrUrl)} alt="QR thanh toán gói Payhook" />
                <div className="space-y-3 text-sm">
                  <p><span className="text-gray-500">Số tiền:</span> <strong>{formatCurrency(selectedOrder.amount)}</strong></p>
                  <div className="flex items-center gap-2"><span className="text-gray-500">Nội dung:</span><strong>{selectedOrder.orderCode}</strong><Button size="icon" variant="ghost" onClick={copyOrderCode} title="Sao chép nội dung"><Copy className="h-4 w-4" /></Button></div>
                  <p className="text-xs text-gray-500">Trạng thái: {selectedOrder.status === 'pending' ? 'Chờ xác nhận thanh toán' : selectedOrder.status}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <Dialog
            open={paymentSuccess}
            onOpenChange={() => {}}
            contentClassName="max-w-md rounded-2xl border border-emerald-100 shadow-2xl"
          >
            <DialogContent className="px-6 py-8 text-center sm:px-10 sm:py-9">
              <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500 sm:h-16 sm:w-16" strokeWidth={1.8} />
              <DialogTitle className="mt-5 text-2xl tracking-normal">Thanh toán thành công</DialogTitle>
              <DialogDescription className="mx-auto mt-3 max-w-xs leading-6">Gói {selectedOrder?.planId === 'unlimited' ? 'Unlimited' : 'Pro'} đã được kích hoạt. Thông báo sẽ tự đóng sau 5 giây.</DialogDescription>
            </DialogContent>
          </Dialog>
        </div>
      </AppLayout>
    </>
  )
}