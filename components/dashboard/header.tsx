'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Search, LayoutGrid, LayoutList } from 'lucide-react'
import type { Client } from '@/types/database'
import type { BookedNotification } from './notification-bell'
import { NotificationBell } from './notification-bell'
import { ThemeBadge } from './theme-toggle'
import { PresentationToggle } from './presentation-toggle'
import { usePresentationMode } from '@/lib/dashboard/presentation-mode'
import { useFrontDeskMode } from '@/lib/dashboard/front-desk-mode'
import { cn } from '@/lib/utils'

interface HeaderProps {
  tenant: Client
  followUpCount: number
  bookedNotificationCount: number
  bookedNotifications: BookedNotification[]
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

// ── Cmd+K trigger ───────────────────────────────────────────────────────────
// Renders a search-input-shaped pill that fires Cmd+K (or Ctrl+K on Windows)
// to open the existing CommandPalette. Only decorative — no actual input.

function CmdKTrigger() {
  const [platform, setPlatform] = useState<'mac' | 'other'>('mac')

  useEffect(() => {
    setPlatform(navigator.platform?.toLowerCase().includes('mac') ? 'mac' : 'other')
  }, [])

  function handleClick() {
    // Dispatch the same key combo that CommandPalette listens for.
    // Must target `document` — CommandPalette listens on document, not window.
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
      role="button"
      className="hidden md:flex items-center gap-2 rounded-xl border border-[var(--brand-border)]/60 bg-[var(--brand-surface)] px-3.5 py-2 text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:border-[var(--brand-border)] hover:bg-[var(--brand-bg)] transition-all duration-150 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-bg)]"
      aria-label="Open command palette"
    >
      <Search className="h-3.5 w-3.5" />
      <span className="opacity-70">Search or jump to&hellip;</span>
      <kbd className="ml-1 rounded-md border border-[var(--brand-border)]/60 bg-[var(--brand-bg)] px-1.5 py-0.5 text-[10px] font-mono leading-none text-[var(--brand-muted)]">
        {shortcut}
      </kbd>
    </button>
  )
}

// ── Header ──────────────────────────────────────────────────────────────────

export function Header({
  tenant,
  followUpCount,
  bookedNotificationCount,
  bookedNotifications,
}: HeaderProps) {
  const today = format(new Date(), 'EEEE, MMMM d')
  const { isPresenting } = usePresentationMode()
  const { isFrontDesk, toggle: toggleFrontDesk } = useFrontDeskMode()
  const subtitle =
    followUpCount > 0
      ? `${followUpCount} call${followUpCount === 1 ? '' : 's'} need human follow-up`
      : 'All caught up'

  const tenantInitial = tenant.name.charAt(0).toUpperCase()

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex items-center justify-between border-b border-[var(--brand-border)]/50 bg-[var(--brand-bg)]/80 px-3 sm:px-4 lg:px-6 backdrop-blur-xl transition-all duration-200',
        isPresenting ? 'h-11' : 'h-14',
      )}
    >
      {/* Left: greeting + status (simplified in presentation mode) */}
      <div className="min-w-0">
        {isPresenting ? (
          <p className="text-sm font-medium text-[var(--brand-text)] truncate">
            {tenant.name} — AI Receptionist Dashboard
          </p>
        ) : (
          <>
            <p className="text-sm font-medium text-[var(--brand-text)] truncate">
              {getGreeting()} — {today}
            </p>
            <p className="text-[11px] text-[var(--brand-muted)] mt-0.5 truncate">{subtitle}</p>
          </>
        )}
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-2.5">
        {/* Hide search + theme + bell in presentation mode */}
        {!isPresenting && (
          <>
            <CmdKTrigger />
            <ThemeBadge />
            <NotificationBell
              count={bookedNotificationCount}
              notifications={bookedNotifications}
              tenantSlug={tenant.slug}
            />
          </>
        )}

        {/* Front-desk mode toggle — simplified view */}
        {!isPresenting && (
          <button
            type="button"
            onClick={toggleFrontDesk}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors',
              isFrontDesk
                ? 'border-[var(--user-accent)]/30 bg-[var(--user-accent-soft)] text-[var(--user-accent)]'
                : 'border-[var(--brand-border)]/60 text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:border-[var(--brand-border)]',
            )}
            aria-label={isFrontDesk ? 'Switch to full view' : 'Switch to simple view'}
            title={isFrontDesk ? 'Full view' : 'Simple view'}
          >
            {isFrontDesk ? (
              <LayoutGrid className="h-3.5 w-3.5" />
            ) : (
              <LayoutList className="h-3.5 w-3.5" />
            )}
            <span className="hidden lg:inline">
              {isFrontDesk ? 'Full' : 'Simple'}
            </span>
          </button>
        )}

        {/* Presentation mode toggle — always visible */}
        <PresentationToggle />

        {/* Tenant avatar badge — always visible (brand anchor) */}
        <div className="flex items-center gap-2 rounded-full border border-[var(--brand-border)]/60 bg-[var(--brand-surface)] pl-1 pr-3 py-0.5">
          <div
            className="flex h-6 w-6 items-center justify-center rounded-full text-white text-[10px] font-bold shrink-0"
            style={{ background: 'var(--brand-primary)' }}
          >
            {tenantInitial}
          </div>
          <span className="text-xs font-medium text-[var(--brand-text)] hidden sm:inline truncate max-w-[120px]">
            {tenant.name}
          </span>
        </div>
      </div>
    </header>
  )
}
