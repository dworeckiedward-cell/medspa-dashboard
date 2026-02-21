import { format } from 'date-fns'
import type { Client } from '@/types/database'
import type { BookedNotification } from './notification-bell'
import { NotificationBell } from './notification-bell'
import { ThemeBadge } from './theme-toggle'

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

export function Header({
  tenant,
  followUpCount,
  bookedNotificationCount,
  bookedNotifications,
}: HeaderProps) {
  const today = format(new Date(), 'EEEE, MMMM d')
  const subtitle =
    followUpCount > 0
      ? `${followUpCount} call${followUpCount === 1 ? '' : 's'} need human follow-up`
      : 'All caught up'

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--brand-border)] bg-[var(--brand-bg)]/95 px-6 backdrop-blur transition-colors duration-200">
      <div>
        <p className="text-sm font-medium text-[var(--brand-text)]">
          {getGreeting()} — {today}
        </p>
        <p className="text-xs text-[var(--brand-muted)] mt-0.5">{subtitle}</p>
      </div>

      <div className="flex items-center gap-2">
        {/* Theme badge (client — renders after hydration) */}
        <ThemeBadge />

        {/* Bell with real booked-appointment notifications */}
        <NotificationBell
          count={bookedNotificationCount}
          notifications={bookedNotifications}
          tenantSlug={tenant.slug}
        />

        {/* Tenant badge */}
        <div className="flex items-center gap-2 rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-1">
          <div
            className="h-2 w-2 rounded-full"
            style={{ background: 'var(--brand-primary)' }}
          />
          <span className="text-xs font-medium text-[var(--brand-text)]">{tenant.name}</span>
        </div>
      </div>
    </header>
  )
}
