import type { Client } from '@/types/database'
import type { BookedNotification } from './notification-bell'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { BrandedLoader } from './loading-overlay'
import { CommandPalette } from './command-palette'

interface DashboardLayoutProps {
  tenant: Client
  children: React.ReactNode
  followUpCount: number
  bookedNotificationCount: number
  bookedNotifications: BookedNotification[]
}

export function DashboardLayout({
  tenant,
  children,
  followUpCount,
  bookedNotificationCount,
  bookedNotifications,
}: DashboardLayoutProps) {
  return (
    <>
      {/* Branded splash — shown once per tab session, fades out before UI is interactive */}
      <BrandedLoader
        tenantName={tenant.name}
        logoUrl={tenant.logo_url}
        brandColor={tenant.brand_color ?? '#2563EB'}
      />

      {/* Cmd+K command palette — global, outside the layout grid */}
      <CommandPalette tenant={tenant} />

      <div className="flex h-screen overflow-hidden bg-[var(--brand-bg)] transition-colors duration-200">
        <Sidebar tenant={tenant} />

        <div className="flex flex-1 flex-col overflow-hidden">
          <Header
            tenant={tenant}
            followUpCount={followUpCount}
            bookedNotificationCount={bookedNotificationCount}
            bookedNotifications={bookedNotifications}
          />

          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </>
  )
}
