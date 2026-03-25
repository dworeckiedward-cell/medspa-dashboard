/**
 * Ops layout — shared header + tabs for all /ops pages.
 * Theme (light/dark) is controlled by client-side toggle.
 * Default: light mode.
 */

import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { OpsUnauthorized } from '@/components/shared/ops-unauthorized'
import { getAllClientOverviews } from '@/lib/ops/query'
import { getOpsNotifications, countUnreadNotifications } from '@/lib/ops/notifications'
import { OpsHeaderActions } from '@/components/ops/ops-header-actions'
import { OpsTabNav } from '@/components/ops/ops-tab-nav'
import { OpsCurrencyProvider, OpsCurrencyToggle } from '@/components/ops/ops-currency-toggle'
import { OpsThemeProvider, OpsThemeToggle } from '@/components/ops/ops-theme-toggle'
import { ServifyLogo } from '@/components/branding/servify-logo'

export const dynamic = 'force-dynamic'

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const access = await resolveOperatorAccess()

  if (!access.authorized) {
    return (
      <div
        style={{
          background: '#f8f9fb',
          minHeight: '100dvh',
          color: '#18181b',
        }}
      >
        <OpsUnauthorized email={access.email} reason={access.reason} />
      </div>
    )
  }

  const [overviews, notifications, unreadCount] = await Promise.all([
    getAllClientOverviews(),
    getOpsNotifications(15, true),
    countUnreadNotifications(),
  ])

  const activeClients = overviews.filter((o) => o.client.is_active).length

  return (
    <OpsThemeProvider>
      <OpsCurrencyProvider>
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-30 border-b border-[var(--brand-border)] bg-[var(--brand-bg)]/90 backdrop-blur-xl">
          <div className="h-14 flex items-center px-4 sm:px-6 lg:px-8">
            <div className="w-full flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/30 shrink-0">
                  <ServifyLogo size="md" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold text-[var(--brand-text)] tracking-tight">Servify OS</span>
                  <span className="text-[var(--brand-muted)] text-[13px]">&middot;</span>
                  <span className="text-[12px] text-[var(--brand-muted)]">
                    {activeClients} active client{activeClients !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="hidden sm:inline text-[11px] text-[var(--brand-muted)]">
                  {access.email ?? 'Operator'}
                </span>
                <div className="hidden sm:block h-4 w-px bg-[var(--brand-border)]" />
                <OpsCurrencyToggle />
                <OpsThemeToggle />
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[var(--brand-primary)]/15 text-[var(--brand-primary)] font-medium border border-[var(--brand-primary)]/20">
                  {access.grantedVia === 'dev_mode' ? 'Dev Mode' : 'Admin'}
                </span>
                <OpsHeaderActions
                  notifications={notifications}
                  unreadCount={unreadCount}
                  clinics={overviews.map((o) => ({
                    id: o.client.id,
                    name: o.client.name,
                    slug: o.client.slug,
                    brand_color: o.client.brand_color,
                  }))}
                />
              </div>
            </div>
          </div>

          {/* ── Tab Navigation ─────────────────────────────────────────────── */}
          <OpsTabNav />
        </header>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <main className="px-4 sm:px-6 lg:px-8 py-5 sm:py-7">
          {children}
        </main>
      </OpsCurrencyProvider>
    </OpsThemeProvider>
  )
}
