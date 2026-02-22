'use client'

import { useState, useCallback, useEffect } from 'react'
import { Bell, Check, ExternalLink, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types (client-side mirror of server types) ───────────────────────────────

interface Notification {
  id: string
  tenantId: string | null
  type: string
  title: string
  description: string | null
  actionHref: string | null
  isRead: boolean
  createdAt: string
}

interface OpsNotificationsWidgetProps {
  initialNotifications: Notification[]
  initialUnreadCount: number
}

// ── Component ────────────────────────────────────────────────────────────────

export function OpsNotificationsWidget({
  initialNotifications,
  initialUnreadCount,
}: OpsNotificationsWidgetProps) {
  const [notifications, setNotifications] = useState(initialNotifications)
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [panelOpen, setPanelOpen] = useState(false)

  const handleMarkRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    )
    setUnreadCount((c) => Math.max(0, c - 1))

    // Fire-and-forget API call
    try {
      await fetch(`/api/ops/notifications/${id}/read`, { method: 'POST' })
    } catch {
      // Graceful
    }
  }, [])

  const handleMarkAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setUnreadCount(0)

    try {
      await fetch('/api/ops/notifications/read-all', { method: 'POST' })
    } catch {
      // Graceful
    }
  }, [])

  const typeIcon: Record<string, string> = {
    prompts_ready: '📝',
    clinic_created: '🏥',
    invite_created: '✉️',
    missing_agent_ids: '⚠️',
    general: '🔔',
  }

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        onClick={() => setPanelOpen((o) => !o)}
        className={cn(
          'relative inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
          panelOpen
            ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
            : 'text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-border)]/40',
        )}
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {panelOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setPanelOpen(false)}
          />
          <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-xl">
            {/* Panel header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--brand-border)]">
              <span className="text-xs font-semibold text-[var(--brand-text)]">
                Notifications
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[10px] text-[var(--brand-primary)] hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Items */}
            <div className="max-h-80 overflow-y-auto divide-y divide-[var(--brand-border)]">
              {notifications.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-[var(--brand-muted)]">No notifications</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      'flex items-start gap-2.5 px-3 py-2.5 transition-colors',
                      !n.isRead && 'bg-[var(--brand-primary)]/5',
                    )}
                  >
                    <span className="text-sm mt-0.5 shrink-0">
                      {typeIcon[n.type] ?? '🔔'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-[11px] leading-tight',
                        n.isRead ? 'text-[var(--brand-muted)]' : 'text-[var(--brand-text)] font-medium',
                      )}>
                        {n.title}
                      </p>
                      {n.description && (
                        <p className="text-[10px] text-[var(--brand-muted)] mt-0.5 line-clamp-2">
                          {n.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] text-[var(--brand-muted)]">
                          {formatTimeAgo(n.createdAt)}
                        </span>
                        {n.actionHref && (
                          <a
                            href={n.actionHref}
                            className="inline-flex items-center gap-0.5 text-[9px] text-[var(--brand-primary)] hover:underline"
                          >
                            View <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                    {!n.isRead && (
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="shrink-0 rounded p-0.5 text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
                        title="Mark as read"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
