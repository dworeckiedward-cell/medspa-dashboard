'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { format, parseISO, isToday, isYesterday } from 'date-fns'
import { X, Phone, CalendarCheck, DollarSign, Users, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildTenantApiUrl } from '@/lib/dashboard/tenant-api'

type NotifType = 'new_lead' | 'new_booking' | 'payment' | 'ai_handled'

interface LiveNotification {
  id: string
  type: NotifType
  title: string
  subtitle?: string
  created_at: string
  href: string
}

interface NotificationsModalProps {
  open: boolean
  onClose: () => void
  tenantSlug?: string | null
}

const HOUR_OPTIONS = [
  { label: '24h', hours: 24 },
  { label: '48h', hours: 48 },
  { label: '3d', hours: 72 },
  { label: '7d', hours: 168 },
]

const TYPE_OPTIONS: { label: string; value: NotifType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Leads', value: 'new_lead' },
  { label: 'Bookings', value: 'new_booking' },
  { label: 'Payments', value: 'payment' },
  { label: 'AI Calls', value: 'ai_handled' },
]

const SORT_OPTIONS = [
  { label: 'Newest first', value: 'newest' },
  { label: 'Oldest first', value: 'oldest' },
  { label: 'By type', value: 'type' },
]

function notifIcon(type: NotifType) {
  const base = 'h-4 w-4 shrink-0'
  switch (type) {
    case 'new_lead': return <Users className={cn(base, 'text-amber-500')} />
    case 'new_booking': return <CalendarCheck className={cn(base, 'text-emerald-500')} />
    case 'payment': return <DollarSign className={cn(base, 'text-emerald-600')} />
    case 'ai_handled': return <Phone className={cn(base, 'text-[var(--brand-primary)]')} />
  }
}

function notifBg(type: NotifType) {
  switch (type) {
    case 'new_lead': return 'bg-amber-50 dark:bg-amber-950/20'
    case 'new_booking': return 'bg-emerald-50 dark:bg-emerald-950/20'
    case 'payment': return 'bg-emerald-50 dark:bg-emerald-950/20'
    case 'ai_handled': return 'bg-[var(--brand-primary)]/5'
  }
}

function groupLabel(iso: string): string {
  try {
    const d = parseISO(iso)
    if (isToday(d)) return 'Today'
    if (isYesterday(d)) return 'Yesterday'
    return format(d, 'MMMM d')
  } catch {
    return 'Earlier'
  }
}

function relTime(iso: string): string {
  try {
    return format(parseISO(iso), 'h:mm a')
  } catch {
    return ''
  }
}

export function NotificationsModal({ open, onClose, tenantSlug }: NotificationsModalProps) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [hours, setHours] = useState(24)
  const [selectedTypes, setSelectedTypes] = useState<Set<NotifType | 'all'>>(new Set<NotifType | 'all'>(['all']))
  const [sort, setSort] = useState<'newest' | 'oldest' | 'type'>('newest')
  const [sortOpen, setSortOpen] = useState(false)
  const [items, setItems] = useState<LiveNotification[]>([])
  const [loading, setLoading] = useState(false)

  // Portal mount
  useEffect(() => { setMounted(true) }, [])

  // Animate in/out
  useEffect(() => {
    if (open) {
      setVisible(true)
    } else {
      const t = setTimeout(() => setVisible(false), 200)
      return () => clearTimeout(t)
    }
  }, [open])

  const fetchData = useCallback(async () => {
    if (!tenantSlug || !open) return
    setLoading(true)
    try {
      const url = buildTenantApiUrl(`/api/notifications?hours=${hours}`, tenantSlug)
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json() as { items: LiveNotification[] }
        setItems(data.items)
      }
    } finally {
      setLoading(false)
    }
  }, [tenantSlug, hours, open])

  useEffect(() => { fetchData() }, [fetchData])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  function toggleType(v: NotifType | 'all') {
    if (v === 'all') {
      setSelectedTypes(new Set<NotifType | 'all'>(['all']))
      return
    }
    setSelectedTypes((prev) => {
      const next = new Set<NotifType | 'all'>(prev)
      next.delete('all')
      if (next.has(v)) {
        next.delete(v)
        if (next.size === 0) return new Set<NotifType | 'all'>(['all'])
      } else {
        next.add(v)
      }
      return next
    })
  }

  const filtered = useMemo(() => {
    let list = selectedTypes.has('all')
      ? items
      : items.filter((n) => selectedTypes.has(n.type))
    if (sort === 'oldest') list = [...list].reverse()
    else if (sort === 'type') {
      const order: NotifType[] = ['new_lead', 'new_booking', 'payment', 'ai_handled']
      list = [...list].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))
    }
    return list
  }, [items, selectedTypes, sort])

  const grouped = useMemo(() => {
    const groups: { label: string; items: LiveNotification[] }[] = []
    let current: string | null = null
    for (const item of filtered) {
      const label = groupLabel(item.created_at)
      if (label !== current) {
        groups.push({ label, items: [item] })
        current = label
      } else {
        groups[groups.length - 1].items.push(item)
      }
    }
    return groups
  }, [filtered])

  function handleItemClick(href: string) {
    onClose()
    router.push(href)
  }

  if (!mounted || !visible) return null

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Sort'

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ isolation: 'isolate' }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        style={{
          opacity: open ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}
        onClick={onClose}
      />

      {/* Card */}
      <div
        className="relative w-full max-w-2xl max-h-[82vh] flex flex-col rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-2xl shadow-black/25"
        style={{
          opacity: open ? 1 : 0,
          transform: open ? 'scale(1)' : 'scale(0.95)',
          transition: 'opacity 200ms ease, transform 200ms ease',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--brand-border)]/60 shrink-0">
          <h2 className="text-base font-semibold text-[var(--brand-text)]">All Notifications</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-bg)] transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-[var(--brand-border)]/60 space-y-2.5 shrink-0">
          {/* Time range */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-[var(--brand-muted)] font-medium mr-1">Range</span>
            {HOUR_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => setHours(opt.hours)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                  hours === opt.hours
                    ? 'bg-[var(--brand-primary)] text-white'
                    : 'bg-[var(--brand-bg)] text-[var(--brand-muted)] hover:text-[var(--brand-text)] border border-[var(--brand-border)]',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Type filter + sort */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {TYPE_OPTIONS.map((opt) => {
                const active = selectedTypes.has(opt.value)
                return (
                  <button
                    key={opt.value}
                    onClick={() => toggleType(opt.value)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border',
                      active
                        ? 'bg-[var(--brand-text)] text-[var(--brand-surface)] border-[var(--brand-text)]'
                        : 'bg-[var(--brand-bg)] text-[var(--brand-muted)] hover:text-[var(--brand-text)] border-[var(--brand-border)]',
                    )}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>

            {/* Sort */}
            <div className="relative shrink-0">
              <button
                onClick={() => setSortOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)] border border-[var(--brand-border)] bg-[var(--brand-bg)] transition-colors"
              >
                {sortLabel}
                <ChevronDown className="h-3 w-3" />
              </button>
              {sortOpen && (
                <div className="absolute right-0 top-8 z-10 w-36 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-lg overflow-hidden">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setSort(opt.value as typeof sort); setSortOpen(false) }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-xs transition-colors',
                        sort === opt.value
                          ? 'text-[var(--brand-primary)] font-medium bg-[var(--brand-primary)]/5'
                          : 'text-[var(--brand-text)] hover:bg-[var(--brand-bg)]',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 rounded-full border-2 border-[var(--brand-border)] border-t-[var(--brand-primary)] animate-spin" />
            </div>
          ) : grouped.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="h-10 w-10 rounded-xl bg-[var(--brand-bg)] border border-[var(--brand-border)] flex items-center justify-center">
                <Phone className="h-5 w-5 text-[var(--brand-muted)] opacity-40" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--brand-text)]">No notifications</p>
                <p className="text-xs text-[var(--brand-muted)] opacity-60 mt-1">
                  Nothing matching your filters in the selected period
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[var(--brand-border)]/40">
              {grouped.map((group) => (
                <div key={group.label}>
                  <div className="px-6 py-2 bg-[var(--brand-bg)]/60 sticky top-0">
                    <p className="text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider">
                      {group.label}
                    </p>
                  </div>
                  {group.items.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => handleItemClick(n.href)}
                      className="w-full flex items-start gap-3 px-6 py-3.5 hover:bg-[var(--brand-bg)]/60 transition-colors text-left"
                    >
                      <div className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', notifBg(n.type))}>
                        {notifIcon(n.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--brand-text)] leading-snug truncate">
                          {n.title}
                        </p>
                        {n.subtitle && (
                          <p className="text-xs text-[var(--brand-muted)] mt-0.5 truncate">{n.subtitle}</p>
                        )}
                      </div>
                      <span className="text-[11px] text-[var(--brand-muted)] opacity-60 shrink-0 mt-0.5 tabular-nums">
                        {relTime(n.created_at)}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[var(--brand-border)]/60 shrink-0 flex items-center justify-between">
          <p className="text-xs text-[var(--brand-muted)]">
            {filtered.length} notification{filtered.length !== 1 ? 's' : ''}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-[var(--brand-border)] text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
