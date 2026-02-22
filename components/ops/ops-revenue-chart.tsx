'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { formatMoneyCompact } from '@/lib/ops-financials/format'
import { TrendingUp, DollarSign } from 'lucide-react'

type Metric = 'mrr' | 'revenue'
type Range = '30d' | '90d' | '6m'

interface OpsRevenueChartProps {
  activeMrr: number
  collectedThisMonth: number
}

/**
 * Simple bar chart showing MRR vs Revenue over selected time range.
 *
 * Uses scaffold data (extrapolated from current MRR/collection figures)
 * until real historical data is wired in.
 */
export function OpsRevenueChart({ activeMrr, collectedThisMonth }: OpsRevenueChartProps) {
  const [metric, setMetric] = useState<Metric>('mrr')
  const [range, setRange] = useState<Range>('6m')

  // Generate scaffold data from current values
  const data = useMemo(() => {
    const months = range === '30d' ? 1 : range === '90d' ? 3 : 6
    const now = new Date()
    const bars: { label: string; mrr: number; revenue: number }[] = []

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label = d.toLocaleDateString('en-US', { month: 'short' })

      // Scaffold: slight growth toward current values
      const growthFactor = months > 1 ? (months - i) / months : 1
      const jitter = 0.9 + Math.random() * 0.2 // ±10% variation

      bars.push({
        label,
        mrr: Math.round(activeMrr * growthFactor * (i === 0 ? 1 : jitter)),
        revenue: Math.round(collectedThisMonth * growthFactor * (i === 0 ? 1 : jitter)),
      })
    }

    return bars
  }, [activeMrr, collectedThisMonth, range])

  const maxVal = Math.max(...data.map((d) => (metric === 'mrr' ? d.mrr : d.revenue)), 1)

  return (
    <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4">
      {/* Header with toggles */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[var(--brand-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--brand-text)]">Revenue Trend</h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Metric toggle */}
          <div className="flex rounded-lg border border-[var(--brand-border)] overflow-hidden">
            <button
              onClick={() => setMetric('mrr')}
              className={cn(
                'px-2.5 py-1 text-[10px] font-medium transition-colors',
                metric === 'mrr'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'text-[var(--brand-muted)] hover:text-[var(--brand-text)]',
              )}
            >
              MRR
            </button>
            <button
              onClick={() => setMetric('revenue')}
              className={cn(
                'px-2.5 py-1 text-[10px] font-medium transition-colors border-l border-[var(--brand-border)]',
                metric === 'revenue'
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  : 'text-[var(--brand-muted)] hover:text-[var(--brand-text)]',
              )}
            >
              Revenue
            </button>
          </div>

          {/* Range toggle */}
          <div className="flex rounded-lg border border-[var(--brand-border)] overflow-hidden">
            {(['30d', '90d', '6m'] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  'px-2 py-1 text-[10px] font-medium transition-colors',
                  r !== '30d' && 'border-l border-[var(--brand-border)]',
                  range === r
                    ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                    : 'text-[var(--brand-muted)] hover:text-[var(--brand-text)]',
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-2 h-32">
        {data.map((bar) => {
          const val = metric === 'mrr' ? bar.mrr : bar.revenue
          const pct = maxVal > 0 ? (val / maxVal) * 100 : 0
          const barColor = metric === 'mrr' ? 'bg-emerald-500' : 'bg-blue-500'

          return (
            <div key={bar.label} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[9px] text-[var(--brand-muted)] tabular-nums">
                {formatMoneyCompact(val)}
              </span>
              <div className="w-full flex justify-center">
                <div
                  className={cn('w-full max-w-[40px] rounded-t-md transition-all', barColor)}
                  style={{ height: `${Math.max(pct, 2)}%`, minHeight: '2px' }}
                />
              </div>
              <span className="text-[9px] text-[var(--brand-muted)]">{bar.label}</span>
            </div>
          )
        })}
      </div>

      {/* Current value callout */}
      <div className="mt-3 pt-3 border-t border-[var(--brand-border)] flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-[10px] text-[var(--brand-muted)]">Current MRR:</span>
          <span className="text-xs font-semibold text-[var(--brand-text)] tabular-nums">
            {formatMoneyCompact(activeMrr)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-blue-500" />
          <span className="text-[10px] text-[var(--brand-muted)]">Collected this month:</span>
          <span className="text-xs font-semibold text-[var(--brand-text)] tabular-nums">
            {formatMoneyCompact(collectedThisMonth)}
          </span>
        </div>
      </div>
    </div>
  )
}
