/**
 * Ops layout — forces dark theme for all /ops pages.
 *
 * Strategy:
 *  1. `class="dark"` on the wrapper activates all `dark:` Tailwind variants.
 *  2. CSS variable overrides replace tenant-specific brand colors with the
 *     fixed Servify OS dark design system.
 *
 * Design system:
 *  Background:    #0a0a0f (near-black)
 *  Card surface:  #12121a
 *  Border:        #1e1e2e
 *  Text primary:  #f0f0f5
 *  Text muted:    #71717a
 *  Accent:        #6366f1 (indigo)
 *  Positive:      #0d9488 (teal)
 *  Danger:        #ef4444
 */

import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { OpsUnauthorized } from '@/components/shared/ops-unauthorized'
import { getAllClientOverviews } from '@/lib/ops/query'
import { getOpsNotifications, countUnreadNotifications } from '@/lib/ops/notifications'
import { OpsHeaderActions } from '@/components/ops/ops-header-actions'
import { OpsTabNav } from '@/components/ops/ops-tab-nav'
import { OpsCurrencyProvider, OpsCurrencyToggle } from '@/components/ops/ops-currency-toggle'
import { ServifyLogo } from '@/components/branding/servify-logo'

export const dynamic = 'force-dynamic'

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const access = await resolveOperatorAccess()

  if (!access.authorized) {
    return (
      <div
        className="dark"
        style={{
          ['--brand-bg' as string]: '#0a0a0f',
          ['--brand-surface' as string]: '#12121a',
          ['--brand-border' as string]: '#1e1e2e',
          ['--brand-text' as string]: '#f0f0f5',
          ['--brand-muted' as string]: '#71717a',
          ['--brand-primary' as string]: '#6366f1',
          ['--brand-accent' as string]: '#0d9488',
          background: '#0a0a0f',
          minHeight: '100dvh',
          color: '#f0f0f5',
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
    <div
      className="dark"
      style={{
        ['--brand-bg' as string]: '#0a0a0f',
        ['--brand-surface' as string]: '#12121a',
        ['--brand-border' as string]: '#1e1e2e',
        ['--brand-text' as string]: '#f0f0f5',
        ['--brand-muted' as string]: '#71717a',
        ['--brand-primary' as string]: '#6366f1',
        ['--brand-accent' as string]: '#0d9488',
        background: '#0a0a0f',
        minHeight: '100dvh',
        color: '#f0f0f5',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-[#1e1e2e] bg-[#0a0a0f]/90 backdrop-blur-xl">
        <div className="h-14 flex items-center px-4 sm:px-6">
          <div className="w-full flex items-center justify-between gap-4 px-0 sm:px-2 lg:px-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#6366f1]/10 border border-[#6366f1]/30 shrink-0">
                <ServifyLogo size="md" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-bold text-[#f0f0f5] tracking-tight">Servify OS</span>
                <span className="text-[#71717a] text-[13px]">&middot;</span>
                <span className="text-[12px] text-[#71717a]">
                  {activeClients} active client{activeClients !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="hidden sm:inline text-[11px] text-[#71717a]">
                {access.email ?? 'Operator'}
              </span>
              <div className="hidden sm:block h-4 w-px bg-[#1e1e2e]" />
              <OpsCurrencyToggle />
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#6366f1]/15 text-[#818cf8] font-medium border border-[#6366f1]/20">
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

        {/* ── Tab Navigation ───────────────────────────────────────────────── */}
        <OpsTabNav />
      </header>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <OpsCurrencyProvider>
        <main className="px-4 sm:px-6 lg:px-8 py-5 sm:py-7">
          {children}
        </main>
      </OpsCurrencyProvider>
    </div>
  )
}
