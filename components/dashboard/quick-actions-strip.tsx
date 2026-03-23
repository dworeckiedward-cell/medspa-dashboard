'use client'

/**
 * QuickActionsStrip — operator shortcut bar for common dashboard actions.
 *
 * 4 actions max, each linking to a real working route.
 */

import Link from 'next/link'
import { PhoneCall, Bell, Zap } from 'lucide-react'
import { buildDashboardHref } from '@/lib/dashboard/link'

interface QuickActionsStripProps {
  tenantSlug?: string | null
  /** Follow-ups needing human attention */
  followUpCount?: number
}

interface QuickAction {
  label: string
  icon: React.ElementType
  href: string
  badge?: number
  color: string
}

export function QuickActionsStrip({ tenantSlug, followUpCount = 0 }: QuickActionsStripProps) {
  const actions: QuickAction[] = [
    // HIDDEN: follow-up temporarily disabled
    // {
    //   label: 'Follow-ups',
    //   icon: Bell,
    //   href: '/dashboard/follow-up',
    //   badge: followUpCount > 0 ? followUpCount : undefined,
    //   color: followUpCount > 0 ? '#E11D48' : 'var(--brand-muted)',
    // },
    {
      label: 'Call Logs',
      icon: PhoneCall,
      href: '/dashboard#calls',
      color: 'var(--brand-primary)',
    },
  ]

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
      <div className="flex items-center gap-1.5 text-[var(--brand-muted)]">
        <Zap className="h-3.5 w-3.5" />
        <span className="text-[11px] font-medium whitespace-nowrap">Quick actions</span>
      </div>

      <div className="h-4 w-px bg-[var(--brand-border)] mx-1" />

      {actions.map((action) => {
        const Icon = action.icon
        return (
          <Link
            key={action.label}
            href={buildDashboardHref(action.href, tenantSlug)}
            className="relative flex items-center gap-1.5 rounded-xl border border-[var(--brand-border)]/60 bg-[var(--brand-surface)] px-3 py-2 text-[11px] font-medium text-[var(--brand-text)] hover:border-[var(--brand-border)] hover:bg-[var(--brand-bg)] transition-all duration-150 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/30 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--brand-bg)]"
          >
            <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: action.color }} />
            {action.label}
            {action.badge != null && action.badge > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white leading-none">
                {action.badge > 99 ? '99+' : action.badge}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
