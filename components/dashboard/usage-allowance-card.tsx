'use client'

import { Activity, Gauge, CalendarClock, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUsageStatusConfig, deriveUsageStatus } from '@/lib/billing/usage'
import {
  formatUsagePercent,
  formatResetDate,
  getDaysUntilReset,
  USAGE_THRESHOLDS,
  BILLING_COPY,
} from '@/lib/billing/usage-format'
import type { BillingUsageSnapshot, UsageAllowance } from '@/lib/billing/types'

interface UsageAllowanceCardProps {
  snapshot: BillingUsageSnapshot
  /** Billing cycle end date (ISO) for reset countdown */
  periodEndAt?: string | null
}

export function UsageAllowanceCard({ snapshot, periodEndAt }: UsageAllowanceCardProps) {
  const {
    primaryAllowance,
    overallStatus,
    isMeteringConnected,
    periodLabel,
    overagePreview,
  } = snapshot

  const statusConfig = getUsageStatusConfig(overallStatus)

  return (
    <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-[var(--brand-muted)]" />
          <div>
            <h3 className="text-sm font-semibold text-[var(--brand-text)]">
              Monthly Usage Allowance
            </h3>
            <p className="text-[10px] text-[var(--brand-muted)] mt-0.5">
              {periodLabel}
            </p>
          </div>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
            statusConfig.bgClass,
            statusConfig.textClass,
          )}
        >
          {statusConfig.label}
        </span>
      </div>

      {/* Metering not connected — premium empty state */}
      {!isMeteringConnected && (
        <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-5">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-border)]/40">
              <Activity className="h-5 w-5 text-[var(--brand-muted)] opacity-60" />
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--brand-text)]">
                {BILLING_COPY.meteringNotConnectedTitle}
              </p>
              <p className="text-[11px] text-[var(--brand-muted)] mt-1 max-w-xs mx-auto leading-relaxed">
                {BILLING_COPY.meteringNotConnected}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Primary allowance bar with threshold markers */}
      {primaryAllowance && isMeteringConnected && (
        <AllowanceBarWithThresholds allowance={primaryAllowance} />
      )}

      {/* Overage preview */}
      {overagePreview && isMeteringConnected && (
        <div className="rounded-lg bg-rose-50/80 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-800/30 px-3 py-2.5 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-rose-600 dark:text-rose-400" />
            <p className="text-[11px] font-medium text-rose-700 dark:text-rose-400">
              Estimated overage: ${(overagePreview.totalOverageEstimateCents / 100).toFixed(2)}
            </p>
          </div>
          {overagePreview.lineItems.map((item) => (
            <p
              key={item.metricLabel}
              className="text-[10px] text-rose-600/80 dark:text-rose-400/70 ml-[18px]"
            >
              {item.metricLabel}: {item.overageUnits} units over
              {item.rateCents != null &&
                ` @ $${(item.rateCents / 100).toFixed(2)}/unit`}
            </p>
          ))}
          <p className="text-[10px] text-rose-500/70 dark:text-rose-400/50 ml-[18px] italic">
            {BILLING_COPY.overageNote}
          </p>
        </div>
      )}

      {/* Reset date + billing note */}
      {isMeteringConnected && (
        <ResetDateFooter periodEndAt={periodEndAt ?? null} />
      )}
    </div>
  )
}

// ── Allowance bar with threshold markers ────────────────────────────────────

function AllowanceBarWithThresholds({ allowance }: { allowance: UsageAllowance }) {
  const percent = Math.min(allowance.usagePercent, 100)
  const overPercent = allowance.usagePercent > 100 ? Math.min(allowance.usagePercent - 100, 50) : 0
  const status = deriveUsageStatus(allowance.usagePercent)
  const config = getUsageStatusConfig(status)

  const barColor =
    status === 'overage'
      ? 'bg-rose-500'
      : status === 'limit_reached'
        ? 'bg-orange-500'
        : status === 'high_usage'
          ? 'bg-amber-500'
          : 'bg-emerald-500'

  return (
    <div className="space-y-2">
      {/* Label + count */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--brand-muted)]">{allowance.metricLabel}</span>
        <span className={cn('font-medium tabular-nums', config.textClass)}>
          {allowance.usageConsumed.toLocaleString()} / {allowance.allowanceIncluded.toLocaleString()}
        </span>
      </div>

      {/* Progress bar with threshold markers */}
      <div className="relative">
        <div className="relative h-2.5 rounded-full bg-[var(--brand-border)] overflow-hidden">
          {/* Fill */}
          <div
            className={cn('absolute inset-y-0 left-0 rounded-full transition-all duration-500', barColor)}
            style={{ width: `${percent}%` }}
          />
          {/* Overage pulse */}
          {overPercent > 0 && (
            <div
              className="absolute inset-y-0 right-0 rounded-r-full bg-rose-500/40 animate-pulse"
              style={{ width: `${(overPercent / 150) * 100}%` }}
            />
          )}
        </div>

        {/* 80% threshold marker */}
        <div
          className="absolute top-0 h-2.5 w-px bg-amber-500/60"
          style={{ left: `${USAGE_THRESHOLDS.warning}%` }}
          title="80% warning threshold"
        />

        {/* 100% threshold marker */}
        <div
          className="absolute top-0 h-2.5 w-px bg-rose-500/60"
          style={{ left: '100%', transform: 'translateX(-1px)' }}
          title="100% limit"
        />
      </div>

      {/* Threshold legend */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-[var(--brand-muted)] tabular-nums">
          {formatUsagePercent(allowance.usagePercent, status)}
        </p>
        <div className="flex items-center gap-3 text-[9px] text-[var(--brand-muted)]">
          <span className="flex items-center gap-1">
            <span className="inline-block h-1 w-2 rounded-full bg-amber-500/60" />
            80%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-1 w-2 rounded-full bg-rose-500/60" />
            100%
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Reset date footer ───────────────────────────────────────────────────────

function ResetDateFooter({ periodEndAt }: { periodEndAt: string | null }) {
  const resetDate = formatResetDate(periodEndAt)
  const daysLeft = getDaysUntilReset(periodEndAt)

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-[var(--brand-muted)]">
      <CalendarClock className="h-3 w-3 shrink-0 opacity-60" />
      {resetDate ? (
        <span>
          Allowance resets {resetDate}
          {daysLeft != null && ` (${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining)`}
        </span>
      ) : (
        <span>Allowance resets at the start of your next billing cycle</span>
      )}
    </div>
  )
}
