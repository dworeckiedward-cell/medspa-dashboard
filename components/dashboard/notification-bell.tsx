'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { formatCurrency } from '@/lib/utils'
import { buildDashboardHref } from '@/lib/dashboard/link'

export interface BookedNotification {
  id: string
  title: string
  created_at: string
  caller_name?: string | null
  potential_revenue?: number | null
}

interface NotificationBellProps {
  count: number
  notifications: BookedNotification[]
  tenantSlug?: string | null
}

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true })
  } catch {
    return ''
  }
}

export function NotificationBell({ count, notifications, tenantSlug }: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const callLogsHref = buildDashboardHref('/dashboard#calls', tenantSlug)

  return (
    <div ref={ref} className="relative">
      <button
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-border)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-bg)]"
        onClick={() => setOpen((o) => !o)}
        aria-label={count > 0 ? `${count} booked appointments` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand-primary)] px-0.5 text-white text-[9px] font-bold leading-none">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-lg shadow-black/8 overflow-hidden"
          role="dialog"
          aria-label="Booked appointments"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--brand-border)]">
            <p className="text-xs font-semibold text-[var(--brand-text)] uppercase tracking-wider">
              Booked Appointments
            </p>
            {count > 0 && (
              <span className="text-[10px] text-[var(--brand-muted)]">{count} total</span>
            )}
          </div>

          {/* List */}
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-[var(--brand-muted)]">No booked appointments yet</p>
              <p className="text-xs text-[var(--brand-muted)] opacity-60 mt-1">
                Confirmed bookings will appear here
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--brand-border)]">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className="px-4 py-3 hover:bg-[var(--brand-border)]/40 transition-colors duration-100 cursor-pointer"
                  onClick={() => setOpen(false)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[var(--brand-text)] leading-snug truncate">
                        {n.title}
                      </p>
                      {n.caller_name && (
                        <p className="text-[11px] text-[var(--brand-muted)] mt-0.5">{n.caller_name}</p>
                      )}
                      <p className="text-[10px] text-[var(--brand-muted)] opacity-60 mt-0.5">
                        {relativeTime(n.created_at)}
                      </p>
                    </div>
                    {n.potential_revenue != null && n.potential_revenue > 0 && (
                      <span className="shrink-0 rounded border border-emerald-300 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {formatCurrency(n.potential_revenue)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Footer CTA */}
          <div className="border-t border-[var(--brand-border)] px-4 py-2.5">
            <Link
              href={callLogsHref}
              className="text-xs text-[var(--brand-primary)] hover:underline transition-colors duration-150 focus-visible:outline-none focus-visible:underline"
              onClick={() => setOpen(false)}
            >
              View all call logs →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
