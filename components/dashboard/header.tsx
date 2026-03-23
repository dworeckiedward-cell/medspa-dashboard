'use client'

import { useEffect, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { Search, RefreshCw } from 'lucide-react'
import type { Client, CallLog } from '@/types/database'
import type { BookedNotification, BudgetAlertLevel } from './notification-bell'
import { NotificationBell } from './notification-bell'
import { PresentationToggle } from './presentation-toggle'
import { usePresentationMode } from '@/lib/dashboard/presentation-mode'
import { cn } from '@/lib/utils'

interface HeaderProps {
  tenant: Client
  followUpCount: number
  bookedNotificationCount: number
  bookedNotifications: BookedNotification[]
  /** Most recent call logs — used to derive health dot color */
  callLogs?: CallLog[]
  /** Set by useAutoRefresh — when data was last fetched */
  lastRefreshedAt?: Date
  /** True while router.refresh() is in flight */
  isRefreshing?: boolean
  budgetAlert?: BudgetAlertLevel
}

function getGreeting(): string {
  const hour = parseInt(
    new Date().toLocaleString('en-CA', { timeZone: 'America/Edmonton', hour: 'numeric', hour12: false }),
    10,
  )
  if (hour < 12) return 'Good morning ☀️'
  if (hour < 17) return 'Good afternoon 🌤️'
  return 'Good evening 🌙'
}

// ── Cmd+K trigger ───────────────────────────────────────────────────────────

function CmdKTrigger() {
  const [platform, setPlatform] = useState<'mac' | 'other'>('mac')

  useEffect(() => {
    setPlatform(navigator.platform?.toLowerCase().includes('mac') ? 'mac' : 'other')
  }, [])

  function handleClick() {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: platform === 'mac',
        ctrlKey: platform !== 'mac',
        bubbles: true,
      }),
    )
  }

  const shortcut = platform === 'mac' ? '\u2318K' : 'Ctrl K'

  return (
    <button
      type="button"
      onClick={handleClick}
      className="hidden md:flex items-center gap-2 rounded-xl border border-[var(--brand-border)]/60 bg-[var(--brand-surface)] px-3.5 py-2 text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:border-[var(--brand-border)] hover:bg-[var(--brand-bg)] transition-all duration-150 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-bg)]"
      aria-label="Open command palette"
    >
      <Search className="h-3.5 w-3.5" />
      <span className="opacity-70">Search&hellip;</span>
      <kbd className="ml-1 rounded-md border border-[var(--brand-border)]/60 bg-[var(--brand-bg)] px-1.5 py-0.5 text-[10px] font-mono leading-none text-[var(--brand-muted)]">
        {shortcut}
      </kbd>
    </button>
  )
}

// ── Sync status cluster ─────────────────────────────────────────────────────

type SyncHealth = 'healthy' | 'stale' | 'unknown'

function getHealth(callLogs?: CallLog[]): SyncHealth {
  if (!callLogs || callLogs.length === 0) return 'unknown'
  const sorted = [...callLogs].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  const hoursSince = (Date.now() - Date.parse(sorted[0].created_at)) / 3_600_000
  return hoursSince < 24 ? 'healthy' : hoursSince < 72 ? 'stale' : 'unknown'
}

function SyncStatus({
  callLogs,
  lastRefreshedAt,
  isRefreshing,
}: {
  callLogs?: CallLog[]
  lastRefreshedAt?: Date
  isRefreshing?: boolean
}) {
  // Tick every 30s so the relative time stays fresh
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const health = getHealth(callLogs)
  const dotColor =
    health === 'healthy'
      ? 'bg-emerald-500'
      : health === 'stale'
        ? 'bg-amber-500'
        : 'bg-[var(--brand-muted)]'

  const label = lastRefreshedAt
    ? formatDistanceToNow(lastRefreshedAt, { addSuffix: true })
    : 'Just now'

  return (
    <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-[var(--brand-muted)]">
      <RefreshCw
        className={cn(
          'h-3 w-3 transition-all duration-150',
          isRefreshing ? 'animate-spin text-[var(--brand-primary)]' : 'text-[var(--brand-muted)]',
        )}
      />
      <div className={cn('h-1.5 w-1.5 rounded-full', dotColor)} />
      <span className="whitespace-nowrap">Updated {label}</span>
    </div>
  )
}

// ── Header ──────────────────────────────────────────────────────────────────

export function Header({
  tenant,
  followUpCount,
  bookedNotificationCount,
  bookedNotifications,
  callLogs,
  lastRefreshedAt,
  isRefreshing,
  budgetAlert,
}: HeaderProps) {
  const today = format(new Date(), 'EEEE, MMMM d')
  const { isPresenting } = usePresentationMode()

  const subtitle =
    followUpCount > 0
      ? `${followUpCount} call${followUpCount === 1 ? '' : 's'} need human follow-up`
      : 'All caught up'

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex items-center justify-between border-b border-[var(--brand-border)]/50 bg-[var(--brand-bg)]/80 px-3 sm:px-4 lg:px-6 backdrop-blur-xl transition-all duration-200',
        isPresenting ? 'h-11' : 'h-14',
      )}
    >
      {/* Left: greeting + status — ml-12 on mobile to clear the fixed hamburger button */}
      <div className="min-w-0 ml-12 lg:ml-0">
        {isPresenting ? (
          <p className="text-sm font-medium text-[var(--brand-text)] truncate">
            {tenant.name} — AI Receptionist Dashboard
          </p>
        ) : (
          <div className="inline-flex items-center rounded-full border border-[var(--brand-border)]/60 bg-[var(--brand-surface)] px-3 py-1">
            <p className="text-[12px] font-medium text-[var(--brand-text)] truncate">
              {getGreeting()} · {today}
            </p>
          </div>
        )}
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-2.5">
        {!isPresenting && (
          <>
            <SyncStatus callLogs={callLogs} lastRefreshedAt={lastRefreshedAt} isRefreshing={isRefreshing} />

            <div className="hidden sm:block h-4 w-px bg-[var(--brand-border)]/60" />

            <CmdKTrigger />

            <NotificationBell
              count={bookedNotificationCount}
              notifications={bookedNotifications}
              tenantSlug={tenant.slug}
              budgetAlert={budgetAlert}
            />
          </>
        )}

        {/* Presentation mode toggle — always visible */}
        <PresentationToggle />
      </div>
    </header>
  )
}
