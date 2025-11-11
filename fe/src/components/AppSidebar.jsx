import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { SidebarLink, useSidebar } from '@/components/ui/sidebar'
import {
  IconLayoutDashboard,
  IconQrcode,
  IconLogout,
  IconGauge,
} from '@tabler/icons-react'
import { motion } from 'motion/react'

export function AppSidebar({ open, setOpen }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { open: sidebarOpen } = useSidebar()

  const sidebarLinks = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      icon: <IconLayoutDashboard size={18} className="text-neutral-500 dark:text-neutral-200" />,
      action: () => navigate('/dashboard'),
    },
    ...(user?.role === 'admin'
      ? [{
          key: 'admin',
          label: 'Admin',
          icon: <IconGauge size={18} className="text-neutral-500 dark:text-neutral-200" />,
          action: () => navigate('/admin'),
        }]
      : []),
    {
      key: 'qr',
      label: 'Tạo QR',
      icon: <IconQrcode size={18} className="text-neutral-500 dark:text-neutral-200" />,
      action: () => navigate('/qr'),
    },
  ]

  const bottomLinks = [
    {
      key: 'logout',
      label: 'Đăng xuất',
      icon: <IconLogout size={18} className="text-neutral-500 dark:text-neutral-200" />,
      action: () => logout(),
    },
  ]

  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="mb-6 flex items-center gap-2 px-2">
          
          <motion.div
            animate={{
              display: sidebarOpen ? "block" : "none",
              opacity: sidebarOpen ? 1 : 0,
            }}
            className="overflow-hidden"
          >
            <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 whitespace-nowrap">
              Payhook
            </p>
          </motion.div>
        </div>
        <div className="space-y-1">
          {sidebarLinks.map((item) => (
            <SidebarLink
              key={item.key}
              link={{
                href: '#',
                label: item.label,
                icon: item.icon,
              }}
              onClick={(e) => {
                e.preventDefault()
                item.action()
                setOpen(false)
              }}
            />
          ))}
        </div>
      </div>
      <div className="space-y-1 border-t border-neutral-200 pt-4 dark:border-neutral-700">
        <motion.div
          animate={{
            display: sidebarOpen ? "block" : "none",
            opacity: sidebarOpen ? 1 : 0,
          }}
          className="px-2 text-xs text-neutral-500 dark:text-neutral-400 overflow-hidden"
        >
          Tài khoản: <span className="font-medium">{user?.username}</span>
        </motion.div>
        {bottomLinks.map((item) => (
          <SidebarLink
            key={item.key}
            link={{
              href: '#',
              label: item.label,
              icon: item.icon,
            }}
            onClick={(e) => {
              e.preventDefault()
              item.action()
              setOpen(false)
            }}
          />
        ))}
      </div>
    </div>
  )
}

