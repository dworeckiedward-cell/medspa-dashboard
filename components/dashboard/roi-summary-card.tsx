'use client'

/**
 * ROI Summary Card — top-line ROI metrics.
 *
 * Shows the financial value the AI receptionist delivers:
 * booked revenue, labor savings, recovered revenue, net ROI.
 *
 * All revenue figures are labelled as "estimated" or "reported"
 * depending on the attribution source.
 */

import { useMemo, useState } from 'react'
import {
  DollarSign,
  TrendingUp,
  Clock,
  PhoneOff,
  Calculator,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import {
  computeRoiSummary,
  filterLogsToWindow,
  type RoiConfig,
} from '@/lib/dashboard/roi-proof'
import type { CallLog } from '@/types/database'
import type { ClientService } from '@/lib/types/domain'

// ── Props ────────────────────────────────────────────────────────────────────

interface RoiSummaryCardProps {
  callLogs: CallLog[]
  services: ClientService[]
  currency?: string
  config?: RoiConfig
}

// ── Period selector ─────────────────────────────────────────────────────────

type Period = '7d' | '30d' | '90d'

const PERIOD_CONFIG: Record<Period, { days: number; label: string }> = {
  '7d':  { days: 7,  label: 'Last 7 days' },
  '30d': { days: 30, label: 'Last 30 days' },
  '90d': { days: 90, label: 'Last 90 days' },
}

// ── Component ────────────────────────────────────────────────────────────────

export function RoiSummaryCard({ callLogs, services, currency = 'USD', config }: RoiSummaryCardProps) {
  const [period, setPeriod] = useState<Period>('30d')

  const roi = useMemo(() => {
    const { days, label } = PERIOD_CONFIG[period]
    const windowLogs = filterLogsToWindow(callLogs, days)
    return computeRoiSummary(windowLogs, services, label, config)
  }, [callLogs, services, period, config])

  const stats = [
    {
      label: 'Booked Revenue',
      value: formatCurrency(roi.bookedRevenue, currency),
      sub: `${roi.totalBooked} appointments`,
      icon: DollarSign,
      color: '#10B981',
      tag: 'reported',
    },
    {
      label: 'Labor Savings',
      value: formatCurrency(roi.laborSavings, currency),
      sub: `${roi.hoursSaved}h of AI call time`,
      icon: Clock,
      color: 'var(--brand-accent)',
      tag: 'estimated',
    },
    {
      label: 'Recovered Revenue',
      value: formatCurrency(roi.recoveredRevenue, currency),
      sub: `${roi.missedCallsRecovered} missed calls recovered`,
      icon: PhoneOff,
      color: '#F59E0B',
      tag: 'estimated',
    },
    {
      label: 'Total Value Generated',
      value: formatCurrency(roi.totalValueGenerated, currency),
      sub: roi.roiPercent !== null ? `${roi.roiPercent}% ROI` : 'ROI not calculable',
      icon: roi.roiPercent !== null && roi.roiPercent > 0 ? TrendingUp : Calculator,
      color: 'var(--brand-primary)',
      tag: null,
    },
  ]

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[var(--brand-muted)]" />
              ROI Summary
            </CardTitle>
            <CardDescription className="mt-0.5">
              Financial value delivered by your AI receptionist
            </CardDescription>
          </div>

          {/* Period selector */}
          <div className="flex rounded-lg border border-[var(--brand-border)] overflow-hidden text-xs shrink-0">
            {(['7d', '30d', '90d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-3 py-1.5 font-medium transition-colors',
                  period === p
                    ? 'bg-[var(--user-accent-soft)] text-[var(--user-accent)]'
                    : 'text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-bg)]',
                )}
              >
                {PERIOD_CONFIG[p].label.replace('Last ', '')}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {roi.totalCalls === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <Calculator className="h-6 w-6 text-[var(--brand-muted)] opacity-40" />
            <p className="text-xs text-[var(--brand-muted)]">No call data for this period</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {stats.map((stat) => {
                const Icon = stat.icon
                return (
                  <div
                    key={stat.label}
                    className="relative rounded-xl border border-[var(--brand-border)] p-3 overflow-hidden"
                  >
                    <div
                      className="absolute inset-0 opacity-[0.03]"
                      style={{ background: `radial-gradient(ellipse at top left, ${stat.color}, transparent 70%)` }}
                    />
                    <div className="relative space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-3 w-3 shrink-0" style={{ color: stat.color }} />
                        <span className="text-[10px] font-medium text-[var(--brand-muted)] uppercase tracking-wider">
                          {stat.label}
                        </span>
                      </div>
                      <p className="text-lg font-bold text-[var(--brand-text)] tabular-nums leading-none">
                        {stat.value}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-[var(--brand-muted)]">{stat.sub}</span>
                        {stat.tag && (
                          <span className={cn(
                            'text-[8px] font-medium uppercase tracking-wider rounded px-1 py-0.5',
                            stat.tag === 'reported'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
                          )}>
                            {stat.tag}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ROI bar */}
            {roi.roiPercent !== null && (
              <div className="rounded-lg border border-[var(--brand-border)] p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--brand-muted)] flex items-center gap-1">
                    <Calculator className="h-3 w-3" />
                    Net ROI vs subscription cost ({formatCurrency(roi.subscriptionCost, currency)}/mo)
                  </span>
                  <span className={cn(
                    'font-bold tabular-nums',
                    roi.roiPercent > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
                  )}>
                    {roi.roiPercent > 0 ? '+' : ''}{roi.roiPercent}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--brand-border)] overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      roi.roiPercent > 0 ? 'bg-emerald-500' : 'bg-rose-500',
                    )}
                    style={{ width: `${Math.min(Math.abs(roi.roiPercent), 500) / 5}%` }}
                  />
                </div>
              </div>
            )}

            <p className="text-[10px] text-[var(--brand-muted)] opacity-60 flex items-center gap-1">
              <Info className="h-3 w-3 shrink-0" />
              Labor savings based on {formatCurrency(config?.hourlyRate ?? 22, currency)}/hr receptionist rate.
              Revenue figures from call log data and service catalog matching.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
