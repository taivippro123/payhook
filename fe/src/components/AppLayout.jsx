import { useState } from 'react'
import { Sidebar, SidebarBody } from '@/components/ui/sidebar'
import { AppSidebar } from './AppSidebar'

export function AppLayout({ children, title, subtitle, actions }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen}>
        <div className="flex h-screen w-full overflow-hidden">
          <SidebarBody className="border-r border-neutral-200 bg-white dark:bg-neutral-900 px-4 py-6 justify-between">
            <AppSidebar open={sidebarOpen} setOpen={setSidebarOpen} />
          </SidebarBody>
          <main className="flex-1 overflow-y-auto bg-gray-50">
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
              {(title || actions) && (
                <div className="flex flex-col gap-3 pb-6 md:flex-row md:items-center md:justify-between">
                  {title && (
                    <div>
                      <h1 className="text-xl font-bold text-neutral-900 sm:text-2xl">{title}</h1>
                      {subtitle && (
                        <p className="text-sm text-neutral-500">{subtitle}</p>
                      )}
                    </div>
                  )}
                  {actions && (
                    <div className="flex gap-2">
                      {actions}
                    </div>
                  )}
                </div>
              )}
              {children}
            </div>
          </main>
        </div>
      </Sidebar>
    </div>
  )
}

