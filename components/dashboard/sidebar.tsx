'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Phone, Settings, Menu, X, Users, Clock, MessageSquare, HelpCircle, FlaskConical, CalendarCheck, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ServifyLogo } from '@/components/branding/servify-logo'
import { buildDashboardHref } from '@/lib/dashboard/link'
import { useAccent } from '@/lib/dashboard/accent'
import { useLanguage } from '@/lib/dashboard/use-language'
import { WorkspaceSwitcher } from './workspace-switcher'
import type { Client } from '@/types/database'
import type { TranslationDict } from '@/lib/dashboard/i18n'
import type { DashboardMode } from '@/lib/ops/get-client-type'
import { getDashboardMode } from '@/lib/ops/get-client-type'
import { getTenantFeatures } from '@/lib/dashboard/tenant-features'
import { useDashboardData } from './dashboard-data-provider'

/** Append cache-buster to logo URL so browsers don't serve stale images after upload. */
function cacheBustLogo(url: string | null, updatedAt?: string): string | null {
  if (!url) return null
  const v = updatedAt ? new Date(updatedAt).getTime() : Date.now()
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}v=${v}`
}

interface SidebarProps {
  tenant: Client
  followUpCount?: number
  /** When provided, sidebar renders buttons instead of Links and uses this for active detection */
  activeTabHref?: string
  /** Called when a nav item is clicked in tab mode */
  onTabChange?: (href: string) => void
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
  /** If true, renders the followUpCount as an urgent badge on this item */
  followUpBadge?: boolean
  /** Restrict item to specific dashboard mode(s). Undefined = show for all. */
  onlyFor?: DashboardMode | DashboardMode[]
  /** Hide this item for specific tenant slugs */
  hideForSlugs?: string[]
  /** Hide this item when the named feature flag is false on the tenant */
  requiresFeature?: 'showAppointments' | 'showBookedRevenue'
  /** If true, this item uses onTabChange (useState) instead of router navigation */
  isTabRoute?: boolean
  subItems?: Array<{ label: string; filter: string }>
}

const NAV_ITEMS: NavItemDef[] = [
  {
    labelFn: (t) => t.nav.dashboard,
    href: '/dashboard',
    icon: LayoutDashboard,
    exact: true,
    isTabRoute: true,
  },
  {
    labelFn: (t) => t.nav.callLogs,
    href: '/dashboard/call-logs',
    icon: Phone,
    exact: true,
    isTabRoute: true,
    subItems: [
      { label: 'All', filter: '' },
      { label: 'Inbound', filter: 'inbound' },
      { label: 'Outbound', filter: 'outbound' },
    ],
  },
  {
    labelFn: (t) => t.nav.leads,
    href: '/dashboard/leads',
    icon: Users,
    exact: false,
    isTabRoute: true,
  },
  // HIDDEN: follow-up tab temporarily disabled
  // {
  //   labelFn: (t) => t.nav.followUp,
  //   href: '/dashboard/follow-up',
  //   icon: Clock,
  //   exact: true,
  //   followUpBadge: true,
  //   isTabRoute: true,
  // },
  {
    labelFn: (t) => t.nav.appointments,
    href: '/dashboard/appointments',
    icon: CalendarCheck,
    exact: true,
    isTabRoute: true,
    requiresFeature: 'showAppointments',
  },
  {
    labelFn: (t) => t.nav.conversations,
    href: '/dashboard/conversations',
    icon: MessageSquare,
    exact: true,
    hideForSlugs: ['live-younger'],
  },
  {
    labelFn: (t) => t.nav.support,
    href: '/dashboard/support',
    icon: HelpCircle,
    exact: true,
    isTabRoute: true,
  },
  {
    labelFn: (t) => t.nav.agentOptimization,
    href: '/dashboard/agent-optimization',
    icon: FlaskConical,
    exact: false,
    onlyFor: 'outbound_db',
  },
  {
    labelFn: (t) => t.nav.settings,
    href: '/dashboard/settings',
    icon: Settings,
    exact: false,
    separator: true,
  },
]

// ── SidebarNav — extracted so it can be used in both desktop and mobile ─────
// Defined OUTSIDE Sidebar to keep a stable component reference across renders.

interface SidebarNavProps {
  tenant: Client
  pathname: string
  t: TranslationDict
  onNavClick: () => void
  followUpCount?: number
  collapsed?: boolean
  activeTabHref?: string
  onTabChange?: (href: string) => void
}

function SidebarNav({ tenant, pathname, t, onNavClick, followUpCount = 0, collapsed = false, activeTabHref, onTabChange }: SidebarNavProps) {
  const logoLetter = tenant.name.charAt(0).toUpperCase()
  const tabMode = !!onTabChange
  const [callLogsSubVisible, setCallLogsSubVisible] = useState(true)
  const dataCtx = useDashboardData()
  // Use live task count if context is available, fall back to server-rendered prop
  const liveFollowUpCount = useMemo(() => {
    if (!dataCtx?.followUpTasks) return followUpCount
    return dataCtx.followUpTasks.filter((t) => t.status === 'open' || t.status === 'in_progress').length
  }, [dataCtx?.followUpTasks, followUpCount])
  // Tab-route items (rendered via useState inside /dashboard) should only show as
  // active when the URL is actually /dashboard. On non-tab pages like /settings,
  // activeTabHref is stale — ignore it so only the real nav item highlights.
  const isOnTabShell = pathname === '/dashboard'

  function handleLogoClick(e: React.MouseEvent) {
    if (tabMode) {
      e.preventDefault()
      onTabChange!('/dashboard')
    }
    onNavClick()
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Logo + brand — clicks navigate to /dashboard */}
      <Link
        href={buildDashboardHref('/dashboard', tenant.slug)}
        prefetch={!tabMode}
        onClick={handleLogoClick}
        className={cn(
          'flex items-center border-b border-white/[0.08] transition-all duration-200 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--user-accent)]',
          collapsed ? 'justify-center px-0 py-5' : 'gap-3 px-5 py-5',
        )}
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-semibold text-sm overflow-hidden"
          style={{
            background: tenant.logo_url ? '#141415' : 'var(--brand-primary)',
            color: tenant.logo_url ? undefined : '#ffffff',
            boxShadow: tenant.logo_url ? undefined : '0 0 0 2px color-mix(in srgb, var(--brand-primary) 20%, transparent)',
          }}
        >
          {tenant.logo_url ? (
            <Image
              src={cacheBustLogo(tenant.logo_url, tenant.updated_at) ?? tenant.logo_url}
              alt={tenant.name}
              width={40}
              height={40}
              className="rounded-xl object-cover"
            />
          ) : (
            logoLetter
          )}
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-semibold text-[13px] text-white truncate leading-tight">
              {tenant.name}
            </p>
            <p className="text-[11px] text-zinc-500 leading-tight mt-0.5">
              {t.nav.aiReceptionist}
            </p>
          </div>
        )}
      </Link>

      {/* Nav */}
      <nav className={cn('flex-1 space-y-0.5 py-4', collapsed ? 'px-2' : 'px-3')} aria-label="Main navigation">
        {NAV_ITEMS.filter((item) => {
          if (item.hideForSlugs?.includes(tenant.slug)) return false
          if (item.requiresFeature) {
            const features = getTenantFeatures(tenant)
            if (!features[item.requiresFeature]) return false
          }
          if (!item.onlyFor) return true
          const mode = getDashboardMode(tenant)
          return Array.isArray(item.onlyFor)
            ? item.onlyFor.includes(mode)
            : item.onlyFor === mode
        }).map((item) => {
          const Icon = item.icon
          const label = item.labelFn(t)
          const useTabSwitch = tabMode && !!item.isTabRoute
          const isActive = useTabSwitch
            ? (isOnTabShell && (activeTabHref === item.href || activeTabHref?.startsWith(item.href + '?')))
            : isNavItemActive(item.href, pathname, item.exact)

          const navItemClass = cn(
            'group relative flex items-center rounded-xl text-[13px] font-medium',
            'transition-colors duration-150 motion-reduce:transition-none',
            collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
            !isActive && 'text-zinc-400 hover:bg-[#141415] hover:text-white',
            isActive && 'bg-[#1a1a1c] text-white font-semibold',
          )

          const navItemInner = (
            <>
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full"
                  style={{ background: 'var(--user-accent)' }}
                  aria-hidden="true"
                />
              )}
              <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              {!collapsed && label}
              {!collapsed && item.followUpBadge && liveFollowUpCount > 0 && (
                <span className="ml-auto flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white leading-none">
                  {liveFollowUpCount > 99 ? '99+' : liveFollowUpCount}
                </span>
              )}
              {collapsed && item.followUpBadge && liveFollowUpCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white leading-none">
                  {liveFollowUpCount > 9 ? '9+' : liveFollowUpCount}
                </span>
              )}
              {!collapsed && item.subItems && (
                <ChevronDown className={cn('ml-auto h-3 w-3 shrink-0 text-zinc-500 transition-transform duration-150', isActive && callLogsSubVisible && 'rotate-180')} />
              )}
            </>
          )

          return (
            <div key={item.href}>
              {item.separator && (
                <div className="mx-2 my-3 border-t border-white/[0.08]" />
              )}

              {useTabSwitch ? (
                <button
                  onClick={() => {
                    if (item.subItems) {
                      if (isActive) {
                        setCallLogsSubVisible(v => !v)
                      } else {
                        setCallLogsSubVisible(true)
                        onTabChange!(item.href)
                      }
                    } else {
                      onTabChange!(item.href)
                    }
                    onNavClick()
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  title={collapsed ? label : undefined}
                  className={cn(navItemClass, 'w-full text-left')}
                >
                  {navItemInner}
                </button>
              ) : (
                <Link
                  href={buildDashboardHref(item.href, tenant.slug)}
                  prefetch={true}
                  onClick={onNavClick}
                  aria-current={isActive ? 'page' : undefined}
                  title={collapsed ? label : undefined}
                  className={navItemClass}
                >
                  {navItemInner}
                </Link>
              )}

              {/* Sub-items */}
              {item.subItems && !collapsed && isActive && callLogsSubVisible && useTabSwitch && (
                <div className="ml-3 mt-0.5 space-y-px pl-3 border-l border-white/[0.08]">
                  {item.subItems.map((sub) => {
                    const subHref = sub.filter ? `${item.href}?filter=${sub.filter}` : item.href
                    const subIsActive = isOnTabShell && activeTabHref === subHref
                    return (
                      <button
                        key={sub.filter || 'all'}
                        type="button"
                        onClick={() => { onTabChange!(subHref); onNavClick() }}
                        className={cn(
                          'w-full text-left rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors duration-100',
                          subIsActive
                            ? 'text-white bg-white/[0.07]'
                            : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]',
                        )}
                      >
                        {sub.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer — account menu + powered by */}
      <div className={cn('border-t border-white/[0.08] py-3 space-y-2', collapsed ? 'px-2' : 'px-3')}>
        {!collapsed && <WorkspaceSwitcher tenant={tenant} />}
        {!collapsed && (
          <div className="flex items-center gap-2 rounded-lg px-2.5 py-1 opacity-30 hover:opacity-60 transition-opacity duration-200">
            <ServifyLogo size="sm" aria-hidden="true" />
            <span className="text-[9px] text-zinc-500">{t.common.poweredByServify}</span>
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center opacity-30 hover:opacity-60 transition-opacity duration-200 py-1">
            <ServifyLogo size="sm" aria-hidden="true" />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sidebar shell ───────────────────────────────────────────────────────────

const COLLAPSE_KEY = 'sidebar-collapsed'

// Routes to prefetch eagerly on sidebar mount — covers all main navigation pages
const PREFETCH_ROUTES = [
  '/dashboard',
  '/dashboard/call-logs',
  '/dashboard/appointments',
  '/dashboard/leads',
  '/dashboard/follow-up',
  '/dashboard/conversations',
  '/dashboard/support',
  '/dashboard/integrations',
  '/dashboard/settings',
]

export function Sidebar({ tenant, followUpCount = 0, activeTabHref, onTabChange }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useLanguage()

  useAccent()

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === 'true')
    } catch {
      // ignore (SSR / privacy mode)
    }
  }, [])

  // Eagerly prefetch main routes only when NOT in tab mode (tab mode has no router navigation)
  useEffect(() => {
    if (onTabChange) return
    for (const route of PREFETCH_ROUTES) {
      router.prefetch(buildDashboardHref(route, tenant.slug))
    }
  }, [router, tenant.slug, onTabChange])

  function toggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem(COLLAPSE_KEY, String(next)) } catch { /* ignore */ }
      return next
    })
  }

  const navProps: SidebarNavProps = {
    tenant,
    pathname,
    t,
    onNavClick: () => setMobileOpen(false),
    followUpCount,
    collapsed,
    activeTabHref,
    onTabChange,
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex shrink-0 flex-col border-r border-white/[0.06] bg-[#0a0a0b]',
          'relative transition-[width] duration-200 ease-in-out',
          collapsed ? 'w-[64px]' : 'w-[248px]',
        )}
        aria-label="Sidebar"
      >
        <SidebarNav {...navProps} />

        {/* Collapse toggle — right edge */}
        <button
          onClick={toggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'absolute -right-3 top-[72px] z-10',
            'flex h-6 w-6 items-center justify-center rounded-full',
            'border border-white/20 bg-[#141415]',
            'text-zinc-400 shadow-sm',
            'hover:text-white hover:border-white/40',
            'transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]',
          )}
        >
          {collapsed
            ? <ChevronRight className="h-3 w-3" />
            : <ChevronLeft className="h-3 w-3" />
          }
        </button>
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
            className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="lg:hidden fixed left-0 top-0 z-50 h-full w-[248px] flex flex-col border-r border-white/[0.06] bg-[#0a0a0b] shadow-xl sidebar-slide-in"
            aria-label="Mobile sidebar"
          >
            <SidebarNav {...navProps} collapsed={false} />
          </aside>
        </>
      )}
    </>
  )
}
