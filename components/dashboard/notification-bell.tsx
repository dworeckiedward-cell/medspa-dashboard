'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, AlertTriangle, Phone, CalendarCheck, DollarSign, Users } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { buildTenantApiUrl } from '@/lib/dashboard/tenant-api'
import { buildDashboardHref } from '@/lib/dashboard/link'
import { cn } from '@/lib/utils'
import { NotificationsModal } from './notifications-modal'

export interface BookedNotification {
  id: string
  title: string
  created_at: string
  caller_name?: string | null
  potential_revenue?: number | null
}

export type BudgetAlertLevel = 'warning' | 'critical' | null

type NotifType = 'new_lead' | 'new_booking' | 'payment' | 'ai_handled'

interface LiveNotification {
  id: string
  type: NotifType
  title: string
  subtitle?: string
  created_at: string
  href: string
}

interface NotificationBellProps {
  count: number
  notifications: BookedNotification[]
  tenantSlug?: string | null
  budgetAlert?: BudgetAlertLevel
}

const LAST_READ_KEY = 'notif-last-read'
const POLL_MS = 2 * 60 * 1000 // 2 min

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true })
  } catch {
    return ''
  }
}

function notifIcon(type: NotifType) {
  const cls = 'h-3.5 w-3.5 shrink-0'
  switch (type) {
    case 'new_lead': return <Users className={cn(cls, 'text-amber-500')} />
    case 'new_booking': return <CalendarCheck className={cn(cls, 'text-emerald-500')} />
    case 'payment': return <DollarSign className={cn(cls, 'text-emerald-600')} />
    case 'ai_handled': return <Phone className={cn(cls, 'text-[var(--brand-primary)]')} />
  }
}

export function NotificationBell({ count: initialCount, notifications: _initial, tenantSlug, budgetAlert }: NotificationBellProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [items, setItems] = useState<LiveNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(initialCount)
  const [lastRead, setLastRead] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const fetchedRef = useRef(false)

  // Load last_read_at from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LAST_READ_KEY)
      setLastRead(stored)
    } catch { /* ignore */ }
  }, [])

  const fetchNotifications = useCallback(async () => {
    if (!tenantSlug) return
    try {
      const res = await fetch(buildTenantApiUrl('/api/notifications', tenantSlug))
      if (!res.ok) return
      const data = await res.json() as { items: LiveNotification[] }
      setItems(data.items)
      // Count unread = newer than last_read_at
      const lr = (() => { try { return localStorage.getItem(LAST_READ_KEY) } catch { return null } })()
      const unread = lr
        ? data.items.filter((n) => n.created_at > lr).length
        : data.items.length
      setUnreadCount(unread)
    } catch { /* network error — keep previous state */ }
  }, [tenantSlug])

  // Fetch once on mount
  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    fetchNotifications()
  }, [fetchNotifications])

  // Poll every 2 min
  useEffect(() => {
    const id = setInterval(fetchNotifications, POLL_MS)
    return () => clearInterval(id)
  }, [fetchNotifications])

  // Outside click / Escape to close
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

  function handleOpen() {
    const opening = !open
    setOpen(opening)
    if (opening) {
      // Mark all as read
      const now = new Date().toISOString()
      try { localStorage.setItem(LAST_READ_KEY, now) } catch { /* ignore */ }
      setLastRead(now)
      setUnreadCount(0)
    }
  }

  function handleItemClick(href: string) {
    setOpen(false)
    router.push(href)
  }

  const hasAlert = budgetAlert != null
  const totalBadge = unreadCount + (hasAlert ? 1 : 0)

  return (
    <div ref={ref} className="relative">
      <button
        className={cn(
          'relative flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-bg)]',
          budgetAlert === 'critical'
            ? 'text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30'
            : budgetAlert === 'warning'
              ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
              : 'text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-border)]',
        )}
        onClick={handleOpen}
        aria-label={totalBadge > 0 ? `${totalBadge} notifications` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="h-4 w-4" />
        {totalBadge > 0 && (
          <span className={cn(
            'absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-white text-[9px] font-bold leading-none',
            budgetAlert === 'critical' ? 'bg-rose-500' : budgetAlert === 'warning' ? 'bg-amber-500' : 'bg-[var(--brand-primary)]',
          )}>
            {totalBadge > 9 ? '9+' : totalBadge}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 z-50 w-80 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-lg shadow-black/8 overflow-hidden"
          role="dialog"
          aria-label="Notifications"
        >
          {/* Budget alert banner */}
          {budgetAlert && (
            <div className={cn(
              'flex items-start gap-2 px-4 py-3 border-b',
              budgetAlert === 'critical'
                ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/40'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40',
            )}>
              <AlertTriangle className={cn(
                'h-4 w-4 shrink-0 mt-0.5',
                budgetAlert === 'critical' ? 'text-rose-500' : 'text-amber-500',
              )} />
              <div className="min-w-0">
                <p className={cn(
                  'text-xs font-semibold',
                  budgetAlert === 'critical' ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400',
                )}>
                  {budgetAlert === 'critical'
                    ? 'AI budget exceeded — calls paused'
                    : 'AI budget almost full (90%+)'}
                </p>
                <Link
                  href={buildDashboardHref('/dashboard/settings', tenantSlug)}
                  className={cn(
                    'text-[10px] hover:underline',
                    budgetAlert === 'critical' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400',
                  )}
                  onClick={() => setOpen(false)}
                >
                  Top up in Settings →
                </Link>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--brand-border)]">
            <p className="text-xs font-semibold text-[var(--brand-text)] uppercase tracking-wider">
              Last 24 hours
            </p>
            {items.length > 0 && (
              <span className="text-[10px] text-[var(--brand-muted)]">{items.length} events</span>
            )}
          </div>

          {/* Notification list */}
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-[var(--brand-muted)]">All quiet</p>
              <p className="text-xs text-[var(--brand-muted)] opacity-60 mt-1">
                No new activity in the last 24 hours
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--brand-border)] max-h-80 overflow-y-auto">
              {items.map((n) => {
                const isUnread = lastRead ? n.created_at > lastRead : false
                return (
                  <li
                    key={n.id}
                    className={cn(
                      'px-4 py-3 hover:bg-[var(--brand-bg)]/60 transition-colors duration-100 cursor-pointer',
                      isUnread && 'bg-[var(--brand-primary)]/[0.03]',
                    )}
                    onClick={() => handleItemClick(n.href)}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5">{notifIcon(n.type)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-[var(--brand-text)] leading-snug truncate">
                          {n.title}
                        </p>
                        {n.subtitle && (
                          <p className="text-[11px] text-[var(--brand-muted)] mt-0.5 truncate">{n.subtitle}</p>
                        )}
                        <p className="text-[10px] text-[var(--brand-muted)] opacity-60 mt-0.5">
                          {relativeTime(n.created_at)}
                        </p>
                      </div>
                      {isUnread && (
                        <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--brand-primary)] shrink-0" />
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {/* Footer */}
          <div className="border-t border-[var(--brand-border)] px-4 py-2.5">
            <button
              onClick={() => { setOpen(false); setModalOpen(true) }}
              className="text-xs text-[var(--brand-primary)] hover:underline transition-colors duration-150"
            >
              See all notifications →
            </button>
          </div>
        </div>
      )}

      <NotificationsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        tenantSlug={tenantSlug}
      />
    </div>
  )
}
