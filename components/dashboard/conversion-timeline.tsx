'use client'

/**
 * ConversionTimeline — premium horizontal funnel bars.
 *
 * Lead Captured → Contacted → Qualified → Booked → Confirmed
 *
 * Each row: label, count, step-rate, proportional bar, drop-off.
 * Bars are clamped to never exceed the previous step visually,
 * even if raw counts are inconsistent.
 */

import { useMemo } from 'react'
import Link from 'next/link'
import { TrendingDown, Phone, AlertTriangle } from 'lucide-react'
import { cn, polish } from '@/lib/utils'
import { buildDashboardHref } from '@/lib/dashboard/link'
import { computeConversionFunnel } from '@/lib/dashboard/conversion-metrics'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useFrontDeskMode } from '@/lib/dashboard/front-desk-mode'
import type { CallLog } from '@/types/database'

interface ConversionTimelineProps {
  /** When false, funnel shows only Lead Captured → Contacted → Qualified. Default: true */
  showBookedSteps?: boolean
  callLogs: CallLog[]
  tenantSlug?: string
}

export function ConversionTimeline({ callLogs, tenantSlug, showBookedSteps = true }: ConversionTimelineProps) {
  const funnel = useMemo(() => computeConversionFunnel(callLogs, showBookedSteps), [callLogs, showBookedSteps])
  const { mode } = useFrontDeskMode()

  // Detect inconsistent data (later step > earlier step)
  const hasInconsistency = useMemo(() => {
    for (let i = 1; i < funnel.steps.length; i++) {
      if (funnel.steps[i].count > funnel.steps[i - 1].count) return true
    }
    return false
  }, [funnel.steps])

  // Compute biggest drop-off between consecutive stages
  const biggestLeak = useMemo(() => {
    let maxDropPct = 0
    let fromLabel = ''
    let toLabel = ''
    for (let i = 1; i < funnel.steps.length; i++) {
      const prev = funnel.steps[i - 1].count
      if (prev === 0) continue
      const dropPct = Math.round(((prev - funnel.steps[i].count) / prev) * 100)
      if (dropPct > maxDropPct) {
        maxDropPct = dropPct
        fromLabel = funnel.steps[i - 1].label
        toLabel = funnel.steps[i].label
      }
    }
    if (maxDropPct === 0) return null
    return { fromLabel, toLabel, dropPct: maxDropPct }
  }, [funnel.steps])

  // ── Empty state ──────────────────────────────────────────────────────────
  if (funnel.totalLeads === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversion Funnel</CardTitle>
          <CardDescription>Lead-to-booking funnel</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={polish.emptyState}>
            <div className={polish.emptyIcon}>
              <Phone className="h-6 w-6 text-[var(--brand-muted)] opacity-50" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--brand-text)]">No leads tracked yet</p>
              <p className="text-xs text-[var(--brand-muted)] opacity-60 mt-1 max-w-[260px] mx-auto">
                Calls with identified leads will populate the conversion funnel.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── Clamped counts for sane bar widths ────────────────────────────────────
  const clamped: number[] = []
  for (let i = 0; i < funnel.steps.length; i++) {
    if (i === 0) {
      clamped.push(funnel.steps[i].count)
    } else {
      clamped.push(Math.min(funnel.steps[i].count, clamped[i - 1]))
    }
  }

  const maxCount = clamped[0] || 1

  return (
    <Card>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Conversion Funnel</CardTitle>
            <CardDescription>
              {funnel.totalLeads} lead{funnel.totalLeads !== 1 ? 's' : ''} ·{' '}
              <span className="font-semibold text-[var(--brand-text)]">{funnel.overallRate}%</span> booked
            </CardDescription>
            <p className="mt-1 text-xs text-[var(--brand-muted)]">
              {biggestLeak ? (
                <>
                  Biggest leak:{' '}
                  <span className="font-medium text-[var(--brand-text)]">{biggestLeak.fromLabel}</span>
                  {' → '}
                  <span className="font-medium text-[var(--brand-text)]">{biggestLeak.toLabel}</span>
                  {' '}({biggestLeak.dropPct}% drop)
                </>
              ) : (
                'No funnel drop-offs detected yet.'
              )}
            </p>
            {mode !== 'simple' && biggestLeak && (
              <Link
                href={buildDashboardHref('/dashboard/call-logs?hasRecording=1&bookedOrLead=1', tenantSlug)}
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors duration-150"
              >
                Open calls to fix this →
              </Link>
            )}
          </div>
          <div className="shrink-0 rounded-lg border border-[var(--brand-border)]/60 bg-[var(--brand-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--brand-text)] tabular-nums">
            {funnel.overallRate}% conversion
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Warning for inconsistent data — operator/analyst only */}
        {hasInconsistency && mode !== 'simple' && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/20">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 dark:text-amber-300/80 leading-relaxed">
              Some funnel events are missing; showing best-effort counts.
            </p>
          </div>
        )}

        {/* ── Funnel rows ────────────────────────────────────────────── */}
        <div className="space-y-0">
          {funnel.steps.map((step, i) => {
            const barPct = maxCount > 0 ? (clamped[i] / maxCount) * 100 : 0
            const isFirst = i === 0

            return (
              <div
                key={step.key}
                className={cn(
                  'group grid items-center gap-x-3 py-3',
                  // Desktop: 4-column grid; mobile: 2-column
                  'grid-cols-[1fr_auto] sm:grid-cols-[120px_48px_1fr_80px]',
                  !isFirst && 'border-t border-[var(--brand-border)]/40',
                )}
              >
                {/* Label */}
                <p className="text-sm font-medium text-[var(--brand-text)]">
                  {step.label}
                </p>

                {/* Count — big number */}
                <p className="text-right sm:text-left text-2xl font-semibold tracking-tight tabular-nums text-[var(--brand-text)] leading-none">
                  {step.count.toLocaleString()}
                </p>

                {/* Bar — hidden on mobile, shown on sm+ */}
                <div className="hidden sm:flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-[var(--brand-border)]/30 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--brand-primary)]/60 transition-all duration-700 ease-out"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  {/* Step rate badge */}
                  {step.rateFromPrev !== null && (
                    <span className="shrink-0 text-[11px] font-medium tabular-nums text-[var(--brand-muted)]">
                      {step.rateFromPrev}%
                    </span>
                  )}
                </div>

                {/* Drop-off — hidden on mobile, shown on sm+ */}
                <div className="hidden sm:flex items-center justify-end gap-1">
                  {!isFirst && step.dropFromPrev !== 0 && (
                    <>
                      <TrendingDown className="h-3 w-3 text-[var(--brand-muted)] opacity-50" />
                      <span className="text-xs tabular-nums text-[var(--brand-muted)]">
                        −{Math.abs(step.dropFromPrev)}
                        {step.rateFromPrev !== null && (
                          <span className="opacity-50 ml-0.5">
                            ({100 - step.rateFromPrev}%)
                          </span>
                        )}
                      </span>
                    </>
                  )}
                </div>

                {/* Mobile bar — spans full width below the label row */}
                <div className="col-span-2 sm:hidden mt-1.5">
                  <div className="h-1.5 rounded-full bg-[var(--brand-border)]/30 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--brand-primary)]/60 transition-all duration-700 ease-out"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    {step.rateFromPrev !== null ? (
                      <span className="text-[10px] tabular-nums text-[var(--brand-muted)]">
                        {step.rateFromPrev}% from prev
                      </span>
                    ) : (
                      <span />
                    )}
                    {!isFirst && step.dropFromPrev !== 0 && (
                      <span className="text-[10px] tabular-nums text-[var(--brand-muted)]">
                        −{Math.abs(step.dropFromPrev)} drop-off
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
