'use client'

import { Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CAC_SOURCE_LABELS, CAC_SOURCE_COLORS } from '@/lib/ops/unit-economics/types'
import type { CacSourceRow } from '@/lib/ops/unit-economics/types'

interface CacSourceSummaryCardProps {
  rows: CacSourceRow[]
}

function formatDollars(amount: number): string {
  if (amount >= 1000) return `$${Math.round(amount / 1000)}k`
  return `$${Math.round(amount)}`
}

export function CacSourceSummaryCard({ rows }: CacSourceSummaryCardProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Tag className="h-4 w-4 text-[var(--brand-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--brand-text)]">CAC by Source</h3>
        </div>
        <p className="text-xs text-[var(--brand-muted)]">
          No acquisition source data yet. Edit CAC on client rows to classify.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--brand-border)]">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-[var(--brand-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--brand-text)]">CAC by Source</h3>
        </div>
        <span className="text-[10px] text-[var(--brand-muted)]">
          {rows.reduce((s, r) => s + r.clientsCount, 0)} clients classified
        </span>
      </div>

      <div className="divide-y divide-[var(--brand-border)]">
        {rows.map((row) => (
          <div key={row.source} className="flex items-center gap-3 px-5 py-2.5">
            {/* Source dot + label */}
            <div className="flex items-center gap-2 min-w-[100px]">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: CAC_SOURCE_COLORS[row.source] }}
              />
              <span className="text-xs font-medium text-[var(--brand-text)]">
                {CAC_SOURCE_LABELS[row.source]}
              </span>
            </div>

            {/* Client count */}
            <span className="text-[10px] text-[var(--brand-muted)] tabular-nums min-w-[60px]">
              {row.clientsCount} client{row.clientsCount !== 1 ? 's' : ''}
            </span>

            {/* Avg CAC */}
            <div className="flex-1 text-right">
              <span className="text-xs text-[var(--brand-muted)]">Avg CAC </span>
              <span className="text-xs font-semibold text-[var(--brand-text)] tabular-nums">
                {row.avgCac > 0 ? formatDollars(row.avgCac) : '—'}
              </span>
            </div>

            {/* Avg LTV */}
            <div className="text-right min-w-[70px]">
              <span className="text-xs text-[var(--brand-muted)]">LTV </span>
              <span className="text-xs font-semibold text-[var(--brand-text)] tabular-nums">
                {formatDollars(row.avgLtv)}
              </span>
            </div>

            {/* LTV:CAC ratio */}
            <div className="text-right min-w-[50px]">
              {row.avgLtvCacRatio !== null ? (
                <span className={cn(
                  'text-xs font-semibold tabular-nums',
                  row.avgLtvCacRatio >= 3
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : row.avgLtvCacRatio >= 1
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-red-600 dark:text-red-400',
                )}>
                  {row.avgLtvCacRatio}x
                </span>
              ) : (
                <span className="text-xs text-[var(--brand-muted)]">—</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
