'use client'

import { Users, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LTV_CONFIDENCE_LABELS } from '@/lib/ops/unit-economics/types'
import type { CohortRow } from '@/lib/ops/unit-economics/types'

interface AcquisitionCohortsCardProps {
  rows: CohortRow[]
  /** Maximum number of cohort months to display */
  maxRows?: number
}

function formatDollars(amount: number): string {
  if (amount >= 1000) return `$${Math.round(amount / 1000)}k`
  return `$${Math.round(amount)}`
}

function formatMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, 1)
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

export function AcquisitionCohortsCard({ rows, maxRows = 6 }: AcquisitionCohortsCardProps) {
  const displayRows = rows.slice(0, maxRows)
  const hasFallbacks = displayRows.some((r) => r.hasFallbackDates)

  if (displayRows.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-[var(--brand-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--brand-text)]">Acquisition Cohorts</h3>
        </div>
        <p className="text-xs text-[var(--brand-muted)]">
          No cohort data yet. Clients will appear as they are created or have acquisition dates set.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--brand-border)]">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[var(--brand-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--brand-text)]">Acquisition Cohorts</h3>
        </div>
        <span className="text-[10px] text-[var(--brand-muted)]">
          Last {displayRows.length} months
        </span>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-6 gap-2 px-5 py-2 border-b border-[var(--brand-border)] bg-[var(--brand-bg)]/50">
        <span className="text-[10px] font-medium text-[var(--brand-muted)]">Month</span>
        <span className="text-[10px] font-medium text-[var(--brand-muted)] text-right">Clients</span>
        <span className="text-[10px] font-medium text-[var(--brand-muted)] text-right">Avg CAC</span>
        <span className="text-[10px] font-medium text-[var(--brand-muted)] text-right">Avg LTV</span>
        <span className="text-[10px] font-medium text-[var(--brand-muted)] text-right">LTV:CAC</span>
        <span className="text-[10px] font-medium text-[var(--brand-muted)] text-right">Recovered</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-[var(--brand-border)]">
        {displayRows.map((row) => (
          <div key={row.cohortMonth} className="grid grid-cols-6 gap-2 px-5 py-2.5 hover:bg-[var(--brand-border)]/10 transition-colors">
            {/* Month */}
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium text-[var(--brand-text)]">
                {formatMonth(row.cohortMonth)}
              </span>
              {row.hasFallbackDates && (
                <span className="text-[8px] text-amber-500" title="Some dates fall back to client created_at">*</span>
              )}
            </div>

            {/* Client count */}
            <span className="text-xs tabular-nums text-[var(--brand-text)] text-right">
              {row.clientsCount}
            </span>

            {/* Avg CAC */}
            <span className="text-xs tabular-nums text-[var(--brand-text)] text-right">
              {row.avgCac > 0 ? formatDollars(row.avgCac) : '—'}
            </span>

            {/* Avg LTV */}
            <span className="text-xs tabular-nums text-[var(--brand-text)] text-right">
              {formatDollars(row.avgLtv)}
            </span>

            {/* LTV:CAC ratio */}
            <span className={cn(
              'text-xs tabular-nums text-right font-medium',
              row.avgLtvCacRatio === null
                ? 'text-[var(--brand-muted)]'
                : row.avgLtvCacRatio >= 3
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : row.avgLtvCacRatio >= 1
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-red-600 dark:text-red-400',
            )}>
              {row.avgLtvCacRatio !== null ? `${row.avgLtvCacRatio}x` : '—'}
            </span>

            {/* Recovered count */}
            <span className="text-xs tabular-nums text-right">
              <span className={cn(
                row.recoveredCount > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-[var(--brand-muted)]',
              )}>
                {row.recoveredCount}
              </span>
              <span className="text-[var(--brand-muted)]">/{row.clientsCount}</span>
            </span>
          </div>
        ))}
      </div>

      {/* Footer with confidence + fallback note */}
      <div className="flex items-center justify-between px-5 py-2 border-t border-[var(--brand-border)] bg-[var(--brand-bg)]/50">
        <div className="flex items-center gap-3">
          {displayRows.length > 0 && (
            <span className="text-[10px] text-[var(--brand-muted)]">
              LTV: {LTV_CONFIDENCE_LABELS[displayRows[0].cohortConfidence]}
            </span>
          )}
        </div>
        {hasFallbacks && (
          <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            * Uses client created_at as fallback
          </span>
        )}
      </div>
    </div>
  )
}
