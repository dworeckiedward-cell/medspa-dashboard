'use client'

import { TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMoney, formatRatio } from '@/lib/ops-financials/format'
import { LTV_CONFIDENCE_LABELS } from '@/lib/ops-financials/types'
import type { ClientCommercialSnapshot } from '@/lib/ops-financials/types'

interface OpsClientCommercialSnapshotProps {
  snapshot: ClientCommercialSnapshot
}

function MetricRow({
  label,
  value,
  sub,
  valueClassName,
}: {
  label: string
  value: string
  sub?: string
  valueClassName?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-[var(--brand-border)] last:border-0">
      <span className="text-xs text-[var(--brand-muted)] shrink-0">{label}</span>
      <div className="text-right">
        <span className={cn('text-sm font-medium tabular-nums', valueClassName ?? 'text-[var(--brand-text)]')}>
          {value}
        </span>
        {sub && (
          <span className="block text-[10px] text-[var(--brand-muted)]">{sub}</span>
        )}
      </div>
    </div>
  )
}

export function OpsClientCommercialSnapshot({ snapshot }: OpsClientCommercialSnapshotProps) {
  const ratioColor = snapshot.ltvCacRatio === null
    ? 'text-[var(--brand-muted)]'
    : snapshot.ltvCacRatio >= 3
      ? 'text-emerald-600 dark:text-emerald-400'
      : snapshot.ltvCacRatio >= 1
        ? 'text-blue-600 dark:text-blue-400'
        : 'text-red-600 dark:text-red-400'

  return (
    <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--brand-border)]">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brand-primary)]/10">
          <TrendingUp className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
        </div>
        <h3 className="text-sm font-semibold text-[var(--brand-text)]">Commercial Snapshot</h3>
      </div>

      <div className="px-5 py-3">
        <MetricRow
          label="CAC"
          value={formatMoney(snapshot.cacAmount)}
          sub={snapshot.cacSource ?? undefined}
        />
        <MetricRow
          label="LTV"
          value={formatMoney(snapshot.ltvAmount)}
          sub={LTV_CONFIDENCE_LABELS[snapshot.ltvConfidence]}
        />
        <MetricRow
          label="LTV:CAC"
          value={formatRatio(snapshot.ltvCacRatio)}
          valueClassName={ratioColor}
        />
        <MetricRow
          label="MRR Included"
          value={snapshot.mrrIncluded ? 'Yes' : 'No'}
          valueClassName={snapshot.mrrIncluded ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--brand-muted)]'}
        />
        <MetricRow
          label="Total Collected"
          value={formatMoney(snapshot.totalCollected)}
          sub={snapshot.paymentsCount > 0 ? `${snapshot.paymentsCount} payments` : undefined}
        />
        <MetricRow
          label="This Month"
          value={formatMoney(snapshot.collectedThisMonth)}
        />

        {/* Billing notes shown on profile detail, not snapshot */}
      </div>
    </div>
  )
}
