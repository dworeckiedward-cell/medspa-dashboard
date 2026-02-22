'use client'

import { CalendarClock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMoney, formatShortDate, formatRelativeDate } from '@/lib/ops-financials/format'
import { daysUntilDue } from '@/lib/ops-financials/compute'
import {
  RETAINER_STATUS_LABELS,
  RETAINER_STATUS_COLORS,
} from '@/lib/ops-financials/types'
import type { ClientFinancialProfile, RetainerStatus } from '@/lib/ops-financials/types'

interface OpsClientRetainerCardProps {
  profile: ClientFinancialProfile
  onEdit?: () => void
}

function StatusBadge({ status }: { status: RetainerStatus }) {
  const colors = RETAINER_STATUS_COLORS[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium', colors.bg, colors.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', colors.dot)} />
      {RETAINER_STATUS_LABELS[status]}
    </span>
  )
}

export function OpsClientRetainerCard({ profile, onEdit }: OpsClientRetainerCardProps) {
  const hasData = profile.retainerStatus !== 'not_set' || profile.retainerAmount !== null
  const dueDays = daysUntilDue(profile.nextDueAt)
  const isOverdue = dueDays !== null && dueDays < 0

  return (
    <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--brand-border)]">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10">
            <CalendarClock className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--brand-text)]">Retainer</h3>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={profile.retainerStatus} />
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="text-[10px] font-medium text-[var(--brand-primary)] hover:underline"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="px-5 py-3">
        {!hasData ? (
          <p className="text-xs text-[var(--brand-muted)] py-2">
            No retainer configured. Click Edit to set one up.
          </p>
        ) : (
          <div className="space-y-0">
            <div className="flex items-center justify-between py-2 border-b border-[var(--brand-border)]">
              <span className="text-xs text-[var(--brand-muted)]">Monthly Amount</span>
              <span className="text-sm font-medium tabular-nums text-[var(--brand-text)]">
                {formatMoney(profile.retainerAmount)}
              </span>
            </div>
            {profile.billingCycleDay && (
              <div className="flex items-center justify-between py-2 border-b border-[var(--brand-border)]">
                <span className="text-xs text-[var(--brand-muted)]">Billing Day</span>
                <span className="text-xs text-[var(--brand-text)]">
                  {profile.billingCycleDay}{ordinalSuffix(profile.billingCycleDay)} of month
                </span>
              </div>
            )}
            <div className="flex items-center justify-between py-2 border-b border-[var(--brand-border)]">
              <span className="text-xs text-[var(--brand-muted)]">Last Paid</span>
              <span className="text-xs text-[var(--brand-text)]">
                {formatShortDate(profile.lastPaidAt)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-[var(--brand-muted)]">Next Due</span>
              <div className="text-right">
                <span className={cn(
                  'text-xs font-medium',
                  isOverdue
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-[var(--brand-text)]',
                )}>
                  {formatShortDate(profile.nextDueAt)}
                </span>
                {profile.nextDueAt && (
                  <span className={cn(
                    'block text-[10px]',
                    isOverdue
                      ? 'text-red-500 dark:text-red-400'
                      : 'text-[var(--brand-muted)]',
                  )}>
                    {formatRelativeDate(profile.nextDueAt)}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ordinalSuffix(n: number): string {
  const j = n % 10
  const k = n % 100
  if (j === 1 && k !== 11) return 'st'
  if (j === 2 && k !== 12) return 'nd'
  if (j === 3 && k !== 13) return 'rd'
  return 'th'
}
