'use client'

import { useEffect, useState } from 'react'
import type { Client, CallLog } from '@/types/database'
import type { BookedNotification, BudgetAlertLevel } from './notification-bell'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { BrandedLoader } from './loading-overlay'
import { CommandPalette } from './command-palette'
import { ToastProvider } from './toast-provider'
import { PresentationModeProvider, usePresentationMode } from '@/lib/dashboard/presentation-mode'
import { FrontDeskModeProvider } from '@/lib/dashboard/front-desk-mode'
import { SupportViewBanner } from '@/components/ops/support-view-banner'
import { DashboardModeContext } from '@/lib/dashboard/mode-context'
import { getModeConfig } from '@/lib/dashboard/mode-registry'
import { getDashboardMode } from '@/lib/ops/get-client-type'
import { useAutoRefresh } from '@/lib/dashboard/use-auto-refresh'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { DashboardDataProvider, useDashboardData } from './dashboard-data-provider'
import { TabStateContext } from './tab-state-context'
import { cn } from '@/lib/utils'

// Routes prefetched on mount as belt-and-suspenders
const PREFETCH_ROUTES = [
  '/dashboard',
  '/dashboard/call-logs',
  '/dashboard/leads',
  '/dashboard/appointments',
  // '/dashboard/follow-up', // HIDDEN: temporarily disabled
  '/dashboard/conversations',
  '/dashboard/settings',
  '/dashboard/support',
]

interface DashboardLayoutProps {
  tenant: Client
  children: React.ReactNode
  /** Fallback values — used by server-rendered pages that compute these server-side.
   *  Client pages leave them unset; DashboardShell reads live from DashboardDataProvider. */
  followUpCount?: number
  bookedNotificationCount?: number
  bookedNotifications?: BookedNotification[]
  callLogs?: CallLog[]
  budgetAlert?: BudgetAlertLevel
}

interface DashboardShellProps {
  tenant: Client
  children: React.ReactNode
  fallbackFollowUpCount: number
  fallbackBookedCount: number
  fallbackBookedNotifications: BookedNotification[]
  fallbackCallLogs?: CallLog[]
  fallbackBudgetAlert?: BudgetAlertLevel
  lastRefreshedAt: Date
  isRefreshing: boolean
}

export function DashboardLayout({
  tenant,
  children,
  followUpCount = 0,
  bookedNotificationCount = 0,
  bookedNotifications = [],
  callLogs,
  budgetAlert,
}: DashboardLayoutProps) {
  const mode = getDashboardMode(tenant)
  const config = getModeConfig(mode)
  const { lastRefreshedAt, isRefreshing } = useAutoRefresh(120_000)

  return (
    <DashboardModeContext.Provider value={{ mode, config }}>
      <PresentationModeProvider>
        <FrontDeskModeProvider tenantSlug={tenant.slug}>
          <ToastProvider>
            {/* DashboardDataProvider checks module cache first — instant if another tab was visited */}
            <DashboardDataProvider
              tenantId={tenant.id}
              tenantSlug={tenant.slug}
              monthlyBudgetCents={tenant.monthly_ai_budget_cents ?? 10000}
            >
              <BrandedLoader
                tenantName={tenant.name}
                logoUrl={tenant.logo_url}
                brandColor={tenant.brand_color ?? '#2563EB'}
                updatedAt={tenant.updated_at}
              />
              <CommandPalette tenant={tenant} />
              <DashboardShell
                tenant={tenant}
                fallbackFollowUpCount={followUpCount}
                fallbackBookedCount={bookedNotificationCount}
                fallbackBookedNotifications={bookedNotifications}
                fallbackCallLogs={callLogs}
                fallbackBudgetAlert={budgetAlert}
                lastRefreshedAt={lastRefreshedAt}
                isRefreshing={isRefreshing}
              >
                {children}
              </DashboardShell>
            </DashboardDataProvider>
          </ToastProvider>
        </FrontDeskModeProvider>
      </PresentationModeProvider>
    </DashboardModeContext.Provider>
  )
}

// ── Inner shell ───────────────────────────────────────────────────────────────
// Prefers live provider data; falls back to server-computed props so that
// server-rendered pages (overview, settings…) still show correct counts.

function DashboardShell({
  tenant,
  children,
  fallbackFollowUpCount,
  fallbackBookedCount,
  fallbackBookedNotifications,
  fallbackCallLogs,
  fallbackBudgetAlert,
  lastRefreshedAt: autoRefreshedAt,
  isRefreshing: autoIsRefreshing,
}: DashboardShellProps) {
  const { isPresenting } = usePresentationMode()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const ctx = useDashboardData()

  // Tab state — tracks which tab is active (for instant useState switching)
  // Initialize from ?tab= URL param so navigating back from /dashboard/support
  // lands on the correct tab instead of resetting to Overview.
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') ?? '/dashboard')

  // When clicking a tab-route item from a non-tab page (e.g. /dashboard/support),
  // navigate back to /dashboard so DashboardTabsShell renders the right content.
  function handleTabChange(href: string) {
    setActiveTab(href)
    if (pathname !== '/dashboard') {
      router.push(`/dashboard?tab=${encodeURIComponent(href)}`)
    }
  }

  // Live provider values when available, server props otherwise
  const followUpCount = ctx?.followUpCount ?? fallbackFollowUpCount
  const bookedNotificationCount = ctx?.bookedNotificationCount ?? fallbackBookedCount
  const bookedNotifications = ctx?.bookedNotifications ?? fallbackBookedNotifications
  const callLogs = ctx?.calls ?? fallbackCallLogs
  const budgetAlert = ctx?.budgetAlert ?? fallbackBudgetAlert
  const lastRefreshedAt = ctx?.lastRefreshedAt ?? autoRefreshedAt
  const isRefreshing = (ctx?.isRefreshing ?? false) || autoIsRefreshing

  useEffect(() => {
    const routes = PREFETCH_ROUTES.filter((r) => r !== pathname)
    routes.forEach((route, i) => {
      setTimeout(() => router.prefetch(route), i * 50)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <TabStateContext.Provider value={{ activeTab, setActiveTab: handleTabChange }}>
      <div className="flex flex-col h-[100dvh] overflow-hidden bg-[var(--brand-bg)] transition-colors duration-200">
        <SupportViewBanner tenantName={tenant.name} />

        <div className="flex flex-1 overflow-hidden">
          {!isPresenting && (
            <Sidebar
              tenant={tenant}
              followUpCount={followUpCount}
              activeTabHref={activeTab}
              onTabChange={handleTabChange}
            />
          )}

          <div className="flex flex-1 min-w-0 flex-col overflow-hidden transition-all duration-200 ease-in-out">
            <Header
              tenant={tenant}
              followUpCount={followUpCount}
              bookedNotificationCount={bookedNotificationCount}
              bookedNotifications={bookedNotifications}
              callLogs={callLogs}
              lastRefreshedAt={lastRefreshedAt}
              isRefreshing={isRefreshing}
              budgetAlert={budgetAlert}
            />

            <main className="flex-1 overflow-y-auto scroll-smooth scrollbar-thin">
              <div key={activeTab} className={cn('animate-fade-in min-h-full')}>
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </TabStateContext.Provider>
  )
}
