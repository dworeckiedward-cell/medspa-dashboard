'use client'

import { Wallet, Clock, CheckCircle2, AlertCircle, Ban } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PayoutSummary, Partner } from '@/lib/partners/types'

interface PayoutReadinessCardProps {
  payout: PayoutSummary
  partner?: Partner
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function PayoutReadinessCard({ payout, partner }: PayoutReadinessCardProps) {
  const hasPayoutMethod = partner?.payoutMethodType != null
  const hasApprovedFunds = payout.totalApprovedUnpaidCents > 0
  const isPayoutReady = hasPayoutMethod && hasApprovedFunds

  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--brand-text)]">
          Payout Summary
        </h3>
        {isPayoutReady ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            Ready
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
            <Clock className="h-3 w-3" />
            Not ready
          </span>
        )}
      </div>

      {/* Amounts breakdown */}
      <div className="space-y-2.5">
        <PayoutLine
          icon={Clock}
          label="Pending review"
          amount={payout.totalPendingReviewCents}
          color="text-gray-500"
        />
        <PayoutLine
          icon={CheckCircle2}
          label="Approved (unpaid)"
          amount={payout.totalApprovedUnpaidCents}
          color="text-violet-600 dark:text-violet-400"
          highlight
        />
        <PayoutLine
          icon={Wallet}
          label="Total paid"
          amount={payout.totalPaidCents}
          color="text-emerald-600 dark:text-emerald-400"
        />
        {payout.totalHeldCents > 0 && (
          <PayoutLine
            icon={Ban}
            label="Held"
            amount={payout.totalHeldCents}
            color="text-amber-600 dark:text-amber-400"
          />
        )}
      </div>

      {/* Readiness checklist (for partner detail view) */}
      {partner && (
        <div className="border-t border-[var(--brand-border)] pt-3 space-y-2">
          <p className="text-[10px] font-medium text-[var(--brand-muted)] uppercase tracking-wider">
            Payout Checklist
          </p>
          <CheckItem
            ok={hasPayoutMethod}
            label={
              hasPayoutMethod
                ? `Payout method: ${partner.payoutMethodType}${partner.payoutDetailsMasked ? ` (${partner.payoutDetailsMasked})` : ''}`
                : 'No payout method on file'
            }
          />
          <CheckItem
            ok={hasApprovedFunds}
            label={
              hasApprovedFunds
                ? `${formatCents(payout.totalApprovedUnpaidCents)} approved and ready to pay`
                : 'No approved commissions to pay'
            }
          />
          <CheckItem
            ok={partner.status === 'active'}
            label={
              partner.status === 'active'
                ? 'Partner status: Active'
                : `Partner status: ${partner.status} (must be active for payout)`
            }
          />
        </div>
      )}
    </div>
  )
}

function PayoutLine({
  icon: Icon,
  label,
  amount,
  color,
  highlight,
}: {
  icon: React.ElementType
  label: string
  amount: number
  color: string
  highlight?: boolean
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3', highlight && 'py-1')}>
      <div className="flex items-center gap-2">
        <Icon className={cn('h-3.5 w-3.5', color)} />
        <span className="text-xs text-[var(--brand-muted)]">{label}</span>
      </div>
      <span
        className={cn(
          'text-sm tabular-nums font-medium',
          highlight ? 'text-[var(--brand-text)]' : 'text-[var(--brand-muted)]',
        )}
      >
        {formatCents(amount)}
      </span>
    </div>
  )
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-start gap-2">
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
      ) : (
        <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
      )}
      <span className="text-xs text-[var(--brand-muted)]">{label}</span>
    </div>
  )
}
