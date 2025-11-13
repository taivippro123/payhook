import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AppLayout } from '@/components/AppLayout'
import { PageSEO } from '@/components/SEO'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import GmailConnection from '@/components/guides/GmailConnection'
import QRCodeGuide from '@/components/guides/QRCodeGuide'
import WebhookGuide from '@/components/guides/WebhookGuide'

const GUIDE_TABS = [
  { id: 'gmail', label: 'Kết nối Gmail', component: GmailConnection },
  { id: 'qr-code', label: 'Tạo QR động', component: QRCodeGuide },
  { id: 'webhook', label: 'Tích hợp Webhooks', component: WebhookGuide },
]

export default function Guide() {
  const navigate = useNavigate()
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const initialTab = searchParams.get('tab') || 'gmail'
  const [activeTab, setActiveTab] = useState(initialTab)

  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    navigate(`/guide?tab=${tabId}`, { replace: true })
  }

  const ActiveComponent = GUIDE_TABS.find(tab => tab.id === activeTab)?.component || GmailConnection

  return (
    <>
      <PageSEO title="Payhook" pathname="/guide" robots="noindex,nofollow" />
      <AppLayout
        title="Hướng dẫn sử dụng"
        subtitle="Tài liệu hướng dẫn chi tiết về các tính năng của Payhook"
    >
      <div className="space-y-6">
        {/* Tabs Navigation */}
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
              {GUIDE_TABS.map((tab) => (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? 'default' : 'ghost'}
                  onClick={() => handleTabChange(tab.id)}
                  className="rounded-b-none"
                >
                  {tab.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Active Tab Content */}
        <div className="min-h-[600px]">
          <ActiveComponent />
        </div>
      </div>
    </AppLayout>
    </>
  )
}

