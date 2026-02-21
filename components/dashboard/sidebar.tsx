'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Phone, Settings, Menu, X, Sparkles, Users, Bell, Plug, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildDashboardHref } from '@/lib/dashboard/link'
import { useAccent } from '@/lib/dashboard/accent'
import { useLanguage } from '@/lib/dashboard/use-language'
import type { Client } from '@/types/database'
import type { TranslationDict } from '@/lib/dashboard/i18n'

interface SidebarProps {
  tenant: Client
}

// ── Active-route helper ─────────────────────────────────────────────────────
//
// Root cause of the old double-highlight bug:
//   "Call Logs" href was '/dashboard#calls' → hash stripped → '/dashboard'
//   → same hrefPath as Dashboard → BOTH items matched pathname '/dashboard'.
//
// Fix:
//  1. Call Logs now uses the real route '/dashboard/call-logs' (no hash anchor).
//  2. Per-item `exact` flag prevents startsWith-chaining between sibling routes.
//     - exact=true  → active only when pathname === href (strict equality)
//     - exact=false → active when pathname === href OR starts with href + '/'
//       (used for Settings to cover potential sub-routes like /dashboard/settings/*)
//
// Result: only one nav item can ever be active at a time.
//
export function isNavItemActive(href: string, pathname: string, exact: boolean): boolean {
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(href + '/')
}

// ── Nav item definitions ────────────────────────────────────────────────────
// Labels are resolved at render time from the translation dict so that
// language switching takes effect without a page reload.

interface NavItemDef {
  labelFn: (t: TranslationDict) => string
  href: string
  icon: React.ElementType
  exact: boolean
  /** Visual separator rendered above this item */
  separator?: boolean
}

const NAV_ITEMS: NavItemDef[] = [
  {
    labelFn: (t) => t.nav.dashboard,
    href: '/dashboard',
    icon: LayoutDashboard,
    exact: true, // must NOT match /dashboard/leads, /dashboard/call-logs, etc.
  },
  {
    labelFn: (t) => t.nav.leads,
    href: '/dashboard/leads',
    icon: Users,
    exact: false, // covers /dashboard/leads/[id] sub-routes
  },
  {
    labelFn: (t) => t.nav.callLogs,
    href: '/dashboard/call-logs',
    icon: Phone,
    exact: true,
  },
  {
    labelFn: (t) => t.nav.followUp,
    href: '/dashboard/follow-up',
    icon: Bell,
    exact: true,
  },
  {
    labelFn: (t) => t.nav.integrations,
    href: '/dashboard/integrations',
    icon: Plug,
    exact: true,
  },
  {
    labelFn: (t) => t.nav.reports,
    href: '/dashboard/reports',
    icon: BarChart3,
    exact: true,
  },
  {
    labelFn: (t) => t.nav.settings,
    href: '/dashboard/settings',
    icon: Settings,
    exact: false, // allow future sub-routes under /dashboard/settings/*
    separator: true,
  },
]

// ── SidebarNav — extracted so it can be used in both desktop and mobile ─────
// Defined OUTSIDE Sidebar to keep a stable component reference across renders.
// (Inner function components re-create a new type on every parent render,
// causing React to unmount/remount the subtree unnecessarily.)

interface SidebarNavProps {
  tenant: Client
  pathname: string
  t: TranslationDict
  onNavClick: () => void
}

function SidebarNav({ tenant, pathname, t, onNavClick }: SidebarNavProps) {
  const logoLetter = tenant.name.charAt(0).toUpperCase()

  return (
    <div className="flex h-full flex-col">
      {/* Logo + brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-[var(--brand-border)]">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white font-bold text-sm shadow-sm"
          style={{
            background: 'var(--brand-primary)',
            boxShadow: '0 0 0 3px color-mix(in srgb, var(--brand-primary) 18%, transparent)',
          }}
        >
          {tenant.logo_url ? (
            <Image
              src={tenant.logo_url}
              alt={tenant.name}
              width={40}
              height={40}
              className="rounded-xl object-cover"
            />
          ) : (
            logoLetter
          )}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-[13px] text-[var(--brand-text)] truncate leading-tight">
            {tenant.name}
          </p>
          <p className="text-[11px] text-[var(--brand-muted)] leading-tight mt-0.5">
            {t.nav.aiReceptionist}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const label = item.labelFn(t)
          const isActive = isNavItemActive(item.href, pathname, item.exact)

          return (
            <div key={item.href}>
              {/* Separator before grouped utility items (e.g. Settings) */}
              {item.separator && (
                <div className="mx-2 my-2 border-t border-[var(--brand-border)]" />
              )}

              <Link
                href={buildDashboardHref(item.href, tenant.slug)}
                onClick={onNavClick}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium',
                  'transition-all duration-150 motion-reduce:transition-none',
                  // Non-active hover/default
                  !isActive && [
                    'text-[var(--brand-muted)]',
                    'hover:bg-[var(--brand-primary)]/[0.06] hover:text-[var(--brand-text)]',
                    'hover:translate-x-px',
                  ],
                  // Active — styled via inline style below (user-accent CSS var)
                  isActive && 'font-semibold',
                )}
                // Active item uses user-accent CSS vars (set synchronously by
                // the blocking script in layout.tsx — no flash before React mounts)
                style={
                  isActive
                    ? {
                        background: 'var(--user-accent-soft)',
                        color: 'var(--user-accent)',
                      }
                    : undefined
                }
              >
                {/* Active indicator bar */}
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full"
                    style={{ background: 'var(--user-accent)' }}
                    aria-hidden="true"
                  />
                )}
                <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                {label}
              </Link>
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--brand-border)] px-4 py-3">
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 opacity-50 hover:opacity-90 transition-opacity duration-200">
          <Sparkles className="h-3.5 w-3.5 text-[var(--brand-accent)]" aria-hidden="true" />
          <span className="text-[11px] text-[var(--brand-muted)]">{t.common.poweredByServify}</span>
        </div>
      </div>
    </div>
  )
}

// ── Sidebar shell ───────────────────────────────────────────────────────────

export function Sidebar({ tenant }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const { t } = useLanguage()

  // useAccent is called here so the CSS vars are updated on accent change.
  // The SidebarNav itself reads var(--user-accent) directly from CSS — no prop
  // needed, ensuring no hydration mismatch (blocking script sets the same var).
  useAccent()

  const navProps: SidebarNavProps = {
    tenant,
    pathname,
    t,
    onNavClick: () => setMobileOpen(false),
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex w-[248px] shrink-0 flex-col border-r border-[var(--brand-border)] bg-[var(--brand-surface)] transition-colors duration-200"
        aria-label="Sidebar"
      >
        <SidebarNav {...navProps} />
      </aside>

      {/* Mobile: hamburger button */}
      <button
        className={cn(
          'lg:hidden fixed top-4 left-4 z-50 rounded-lg p-2',
          'text-[var(--brand-muted)] hover:text-[var(--brand-text)]',
          'bg-[var(--brand-surface)] border border-[var(--brand-border)]',
          'shadow-sm hover:shadow transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-bg)]',
        )}
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="lg:hidden fixed left-0 top-0 z-50 h-full w-[248px] flex flex-col border-r border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-2xl sidebar-slide-in"
            aria-label="Mobile sidebar"
          >
            <SidebarNav {...navProps} />
          </aside>
        </>
      )}
    </>
  )
}
