'use client'

/**
 * ExecutiveReportCard — monthly executive summary.
 *
 * Designed for stakeholder presentations and management review.
 * Includes copy-as-text for easy sharing via email/Slack.
 *
 * All values clearly labelled as exact or estimated.
 */

import { useMemo } from 'react'
import {
  FileText,
  Phone,
  CalendarCheck,
  DollarSign,
  Clock,
  PhoneOff,
  TrendingUp,
  Target,
  ArrowRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ConfidenceBadge } from './confidence-badge'
import { ReportDeliveryActions } from './report-delivery-actions'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import {
  computeRoiSummary,
  computeMissedCallRecovery,
  filterLogsToWindow,
  type RoiConfig,
} from '@/lib/dashboard/roi-proof'
import { computeConversionFunnel } from '@/lib/dashboard/conversion-metrics'
import { buildReportPayload } from '@/lib/dashboard/report-export'
import type { CallLog } from '@/types/database'
import type { ClientService } from '@/lib/types/domain'

// ── Props ────────────────────────────────────────────────────────────────────

interface ExecutiveReportCardProps {
  callLogs: CallLog[]
  services: ClientService[]
  currency?: string
  config?: RoiConfig
  tenantName?: string
}

// ── Component ────────────────────────────────────────────────────────────────

export function ExecutiveReportCard({
  callLogs,
  services,
  currency = 'USD',
  config,
  tenantName,
}: ExecutiveReportCardProps) {
  const roi = useMemo(
    () => computeRoiSummary(filterLogsToWindow(callLogs, 30), services, 'Last 30 days', config),
    [callLogs, services, config],
  )

  const recovery = useMemo(
    () => computeMissedCallRecovery(filterLogsToWindow(callLogs, 30)),
    [callLogs],
  )

  const funnel = useMemo(
    () => computeConversionFunnel(filterLogsToWindow(callLogs, 30)),
    [callLogs],
  )

  const reportPayload = useMemo(
    () =>
      roi.totalCalls > 0
        ? buildReportPayload({
            tenantName: tenantName ?? 'Clinic',
            roi,
            recovery,
            funnel,
            currency,
          })
        : null,
    [tenantName, roi, recovery, funnel, currency],
  )

  const periodLabel = reportPayload?.periodLabel ?? (() => {
    const end = new Date()
    const start = new Date(Date.now() - 30 * 86_400_000)
    return `${start.toLocaleDateString('en', { month: 'long', day: 'numeric' })} – ${end.toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' })}`
  })()

  // ── Render ────────────────────────────────────────────────────────────────

  const rows: Array<{
    icon: React.ElementType
    label: string
    value: string
    sub?: string
    color: string
    tag?: 'exact' | 'estimated'
  }> = [
    { icon: Phone, label: 'Calls Handled', value: roi.totalCalls.toLocaleString(), color: 'var(--brand-primary)' },
    { icon: CalendarCheck, label: 'Appointments Booked', value: roi.totalBooked.toLocaleString(), color: '#10B981', tag: 'exact' },
    { icon: Target, label: 'Lead Conversion Rate', value: `${roi.conversionRate}%`, color: '#F59E0B' },
    { icon: DollarSign, label: 'Booked Revenue', value: formatCurrency(roi.bookedRevenue, currency), color: '#10B981', tag: 'exact', sub: 'from call logs' },
    { icon: Clock, label: 'Labor Cost Savings', value: formatCurrency(roi.laborSavings, currency), color: 'var(--brand-accent)', tag: 'estimated', sub: `${roi.hoursSaved}h saved` },
    { icon: PhoneOff, label: 'Recovered Revenue', value: formatCurrency(roi.recoveredRevenue, currency), color: '#F59E0B', tag: 'estimated', sub: `${recovery.recoveredCalls.length} missed calls` },
    { icon: TrendingUp, label: 'Total Value Generated', value: formatCurrency(roi.totalValueGenerated, currency), color: 'var(--brand-primary)' },
  ]

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-[var(--brand-muted)]" />
              Monthly Executive Report
            </CardTitle>
            <CardDescription className="mt-0.5">{periodLabel}</CardDescription>
          </div>
          <ReportDeliveryActions payload={reportPayload} />
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {roi.totalCalls === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-border)]/40">
              <FileText className="h-6 w-6 text-[var(--brand-muted)] opacity-50" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--brand-text)]">No report data yet</p>
              <p className="text-xs text-[var(--brand-muted)] mt-1 max-w-xs mx-auto">
                Once your AI receptionist handles calls, this report will show executive-ready metrics
                including ROI, revenue attribution, and conversion funnels.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Metric rows */}
            <div className="rounded-lg border border-[var(--brand-border)] overflow-hidden divide-y divide-[var(--brand-border)]">
              {rows.map((row) => {
                const Icon = row.icon
                return (
                  <div key={row.label} className="flex items-center justify-between px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                        style={{ background: `${row.color}20`, color: row.color }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <span className="text-xs text-[var(--brand-muted)]">{row.label}</span>
                        {row.sub && (
                          <p className="text-[10px] text-[var(--brand-muted)] opacity-60">{row.sub}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {row.tag && (
                        <ConfidenceBadge type={row.tag} />
                      )}
                      <span className="text-sm font-semibold text-[var(--brand-text)] tabular-nums">
                        {row.value}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ROI callout */}
            {roi.roiPercent !== null && (
              <div className={cn(
                'rounded-xl border-2 p-4 text-center',
                roi.roiPercent > 0
                  ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20'
                  : 'border-rose-300 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/20',
              )}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--brand-muted)] mb-1">
                  Net ROI vs {formatCurrency(roi.subscriptionCost, currency)}/mo subscription
                </p>
                <p className={cn(
                  'text-3xl font-bold tabular-nums',
                  roi.roiPercent > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400',
                )}>
                  {roi.roiPercent > 0 ? '+' : ''}{roi.roiPercent}%
                </p>
              </div>
            )}

            {/* Conversion funnel mini */}
            <div>
              <p className="text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider mb-2">
                Conversion Funnel
              </p>
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {funnel.steps.map((step, i) => (
                  <div key={step.key} className="flex items-center gap-1 shrink-0">
                    <div className="rounded-lg border border-[var(--brand-border)] px-2.5 py-1.5 text-center min-w-[80px]">
                      <p className="text-sm font-bold text-[var(--brand-text)] tabular-nums">{step.count}</p>
                      <p className="text-[9px] text-[var(--brand-muted)]">{step.label}</p>
                    </div>
                    {i < funnel.steps.length - 1 && (
                      <div className="flex flex-col items-center shrink-0">
                        <ArrowRight className="h-3 w-3 text-[var(--brand-muted)]" />
                        {step.rateFromPrev !== null && (
                          <span className="text-[8px] text-[var(--brand-muted)]">
                            {funnel.steps[i + 1].rateFromPrev}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[10px] text-[var(--brand-muted)] opacity-60 text-center">
              Based on {roi.totalCalls} calls over {periodLabel.toLowerCase()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
