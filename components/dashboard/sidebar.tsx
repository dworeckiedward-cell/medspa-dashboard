'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Phone, Settings, Menu, X, Sparkles } from 'lucide-react'
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
}

const NAV_ITEMS: NavItemDef[] = [
  {
    labelFn: (t) => t.nav.dashboard,
    href: '/dashboard',
    icon: LayoutDashboard,
    exact: true, // must NOT match /dashboard/call-logs or /dashboard/settings
  },
  {
    labelFn: (t) => t.nav.callLogs,
    href: '/dashboard/call-logs',
    icon: Phone,
    exact: true,
  },
  {
    labelFn: (t) => t.nav.settings,
    href: '/dashboard/settings',
    icon: Settings,
    exact: false, // allow future sub-routes under /dashboard/settings/*
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
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white font-bold text-sm"
          style={{ background: 'var(--brand-primary)' }}
        >
          {tenant.logo_url ? (
            <Image
              src={tenant.logo_url}
              alt={tenant.name}
              width={36}
              height={36}
              className="rounded-lg object-cover"
            />
          ) : (
            logoLetter
          )}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm text-[var(--brand-text)] truncate leading-tight">
            {tenant.name}
          </p>
          <p className="text-xs text-[var(--brand-muted)] leading-tight mt-0.5">
            {t.nav.aiReceptionist}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-4" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const label = item.labelFn(t)
          const isActive = isNavItemActive(item.href, pathname, item.exact)

          return (
            <Link
              key={item.href}
              href={buildDashboardHref(item.href, tenant.slug)}
              onClick={onNavClick}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                'transition-colors duration-150 motion-reduce:transition-none',
                // Non-active hover/default — uses brand-primary (tenant color)
                !isActive && 'text-[var(--brand-muted)] hover:bg-[var(--brand-primary)]/10 hover:text-[var(--brand-text)]',
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
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--brand-border)] px-5 py-4">
        <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity duration-200">
          <Sparkles className="h-3.5 w-3.5 text-[var(--brand-accent)]" aria-hidden="true" />
          <span className="text-xs text-[var(--brand-muted)]">{t.common.poweredByServify}</span>
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
        className="hidden lg:flex w-60 shrink-0 flex-col border-r border-[var(--brand-border)] bg-[var(--brand-surface)] transition-colors duration-200"
        aria-label="Sidebar"
      >
        <SidebarNav {...navProps} />
      </aside>

      {/* Mobile: hamburger button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 rounded-md p-2 text-[var(--brand-muted)] hover:text-[var(--brand-text)] bg-[var(--brand-surface)] border border-[var(--brand-border)] shadow-sm"
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
            className="lg:hidden fixed left-0 top-0 z-50 h-full w-60 flex flex-col border-r border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-xl"
            aria-label="Mobile sidebar"
          >
            <SidebarNav {...navProps} />
          </aside>
        </>
      )}
    </>
  )
}
