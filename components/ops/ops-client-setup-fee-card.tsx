'use client'

import { Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMoney, formatShortDate } from '@/lib/ops-financials/format'
import {
  SETUP_FEE_STATUS_LABELS,
  SETUP_FEE_STATUS_COLORS,
} from '@/lib/ops-financials/types'
import type { ClientFinancialProfile, SetupFeeStatus } from '@/lib/ops-financials/types'

interface OpsClientSetupFeeCardProps {
  profile: ClientFinancialProfile
  onEdit?: () => void
}

function StatusBadge({ status }: { status: SetupFeeStatus }) {
  const colors = SETUP_FEE_STATUS_COLORS[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium', colors.bg, colors.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', colors.dot)} />
      {SETUP_FEE_STATUS_LABELS[status]}
    </span>
  )
}

export function OpsClientSetupFeeCard({ profile, onEdit }: OpsClientSetupFeeCardProps) {
  const hasData = profile.setupFeeStatus !== 'not_set' || profile.setupFeeAmount !== null

  return (
    <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--brand-border)]">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10">
            <Receipt className="h-3.5 w-3.5 text-violet-500" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--brand-text)]">Setup Fee</h3>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={profile.setupFeeStatus} />
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
            No setup fee configured. Click Edit to set one up.
          </p>
        ) : (
          <div className="space-y-0">
            <div className="flex items-center justify-between py-2 border-b border-[var(--brand-border)]">
              <span className="text-xs text-[var(--brand-muted)]">Amount</span>
              <span className="text-sm font-medium tabular-nums text-[var(--brand-text)]">
                {formatMoney(profile.setupFeeAmount)}
              </span>
            </div>
            {profile.setupFeePaidAmount !== null && (
              <div className="flex items-center justify-between py-2 border-b border-[var(--brand-border)]">
                <span className="text-xs text-[var(--brand-muted)]">Paid</span>
                <span className="text-sm font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatMoney(profile.setupFeePaidAmount)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between py-2 border-b border-[var(--brand-border)]">
              <span className="text-xs text-[var(--brand-muted)]">Invoiced</span>
              <span className="text-xs text-[var(--brand-text)]">
                {formatShortDate(profile.setupFeeInvoicedAt)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-[var(--brand-muted)]">Paid Date</span>
              <span className="text-xs text-[var(--brand-text)]">
                {formatShortDate(profile.setupFeePaidAt)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
