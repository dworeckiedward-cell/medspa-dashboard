'use client'

import type { Client } from '@/types/database'
import type { BookedNotification } from './notification-bell'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { BrandedLoader } from './loading-overlay'
import { CommandPalette } from './command-palette'
import { ToastProvider } from './toast-provider'
import { PresentationModeProvider, usePresentationMode } from '@/lib/dashboard/presentation-mode'
import { SupportViewBanner } from '@/components/ops/support-view-banner'
import { cn } from '@/lib/utils'

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
    <PresentationModeProvider>
      <ToastProvider>
        <BrandedLoader
          tenantName={tenant.name}
          logoUrl={tenant.logo_url}
          brandColor={tenant.brand_color ?? '#2563EB'}
        />
        <CommandPalette tenant={tenant} />
        <DashboardShell
          tenant={tenant}
          followUpCount={followUpCount}
          bookedNotificationCount={bookedNotificationCount}
          bookedNotifications={bookedNotifications}
        >
          {children}
        </DashboardShell>
      </ToastProvider>
    </PresentationModeProvider>
  )
}

// ── Inner shell — reads presentation mode from context ──────────────────────

function DashboardShell({
  tenant,
  children,
  followUpCount,
  bookedNotificationCount,
  bookedNotifications,
}: DashboardLayoutProps) {
  const { isPresenting } = usePresentationMode()

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--brand-bg)] transition-colors duration-200">
      {/* Support view banner — shown when operator is viewing in support mode */}
      <SupportViewBanner tenantName={tenant.name} />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — collapses in presentation mode */}
        {!isPresenting && <Sidebar tenant={tenant} />}

        <div className="flex flex-1 flex-col overflow-hidden">
          <Header
            tenant={tenant}
            followUpCount={followUpCount}
            bookedNotificationCount={bookedNotificationCount}
            bookedNotifications={bookedNotifications}
          />

          <main className={cn(
            'flex-1 overflow-y-auto scroll-smooth scrollbar-thin',
          )}>
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
