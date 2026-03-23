'use client'

import { useMemo } from 'react'
import { Phone, Users, Bell, CalendarCheck } from 'lucide-react'
import { isToday, parseISO, isBefore, addHours } from 'date-fns'
import { useDashboardData } from './dashboard-data-provider'
import { useTabState } from './tab-state-context'
import { cn } from '@/lib/utils'

export function TodayHighlights() {
  const ctx = useDashboardData()
  const tabState = useTabState()

  const stats = useMemo(() => {
    const calls = ctx?.calls ?? []
    const leads = ctx?.leads ?? []
    const tasks = ctx?.followUpTasks ?? []
    const now = new Date()

    const callsToday = calls.filter((c) => {
      try { return isToday(parseISO(c.created_at)) } catch { return false }
    }).length

    const leadsToday = leads.filter((l) => {
      try { return isToday(parseISO(l.createdAt)) } catch { return false }
    }).length

    const urgentTasks = tasks.filter((t) => {
      if (t.status === 'done') return false
      try {
        const due = parseISO(t.dueAt)
        return isBefore(due, addHours(now, 4))
      } catch { return false }
    }).length

    const callbackLeads = leads.filter((l) => l.status === 'callback').length

    const bookedToday = calls.filter((c) => {
      if (!c.is_booked) return false
      try { return isToday(parseISO(c.booked_at ?? c.created_at)) } catch { return false }
    }).length

    return { callsToday, leadsToday, urgentTasks: urgentTasks + callbackLeads, bookedToday }
  }, [ctx])

  const chips = [
    {
      icon: Phone,
      count: stats.callsToday,
      label: stats.callsToday === 1 ? 'call today' : 'calls today',
      href: '/dashboard/call-logs',
      urgent: false,
    },
    {
      icon: Users,
      count: stats.leadsToday,
      label: stats.leadsToday === 1 ? 'new lead' : 'new leads',
      href: '/dashboard/leads',
      urgent: false,
    },
    // HIDDEN: follow-up temporarily disabled
    // {
    //   icon: Bell,
    //   count: stats.urgentTasks,
    //   label: stats.urgentTasks === 1 ? 'follow-up needed' : 'follow-ups needed',
    //   href: '/dashboard/follow-up',
    //   urgent: stats.urgentTasks > 0,
    // },
    {
      icon: CalendarCheck,
      count: stats.bookedToday,
      label: stats.bookedToday === 1 ? 'appointment booked' : 'appointments booked',
      href: '/dashboard/call-logs',
      urgent: false,
    },
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map(({ icon: Icon, count, label, href, urgent }) => (
        <button
          key={href}
          type="button"
          onClick={() => tabState?.setActiveTab(href)}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition-colors duration-150',
            urgent && count > 0
              ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400'
              : 'border-[var(--brand-border)] bg-[var(--brand-surface)] text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:border-[var(--brand-primary)]/40',
          )}
        >
          <Icon className={cn('h-3.5 w-3.5 shrink-0', urgent && count > 0 ? 'text-rose-500' : 'text-[var(--brand-muted)]')} />
          <span className={cn('tabular-nums', urgent && count > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-[var(--brand-text)]')}>
            {count}
          </span>
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
