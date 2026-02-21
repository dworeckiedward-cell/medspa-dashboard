'use client'

/**
 * ConversionTimeline — horizontal 5-step funnel stepper.
 *
 * Lead Captured → Contacted → Qualified → Booked → Confirmed
 *
 * Renders count, conversion rate from previous step, and a progress bar
 * proportional to the lead count.
 */

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { computeConversionFunnel } from '@/lib/dashboard/conversion-metrics'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { CallLog } from '@/types/database'

interface ConversionTimelineProps {
  callLogs: CallLog[]
}

// Step icon characters (kept as inline SVG paths for zero-dependency rendering)
const STEP_ICONS = ['⬤', '◎', '◆', '✓', '★'] as const

export function ConversionTimeline({ callLogs }: ConversionTimelineProps) {
  const funnel = useMemo(() => computeConversionFunnel(callLogs), [callLogs])

  if (funnel.totalLeads === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversion Timeline</CardTitle>
          <CardDescription>Lead-to-booking funnel</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--brand-muted)] text-center py-8 opacity-70">
            No leads tracked yet. Calls with identified leads will appear here.
          </p>
        </CardContent>
      </Card>
    )
  }

  const maxCount = funnel.steps[0].count || 1

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Conversion Timeline</CardTitle>
            <CardDescription>
              {funnel.totalLeads} lead{funnel.totalLeads !== 1 ? 's' : ''} ·{' '}
              <span className="text-[var(--user-accent)] font-semibold">{funnel.overallRate}%</span> overall conversion
            </CardDescription>
          </div>
          <div className="shrink-0 rounded-full bg-[var(--user-accent-soft)] px-3 py-1">
            <span className="text-sm font-bold text-[var(--user-accent)] tabular-nums">
              {funnel.overallRate}%
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Desktop: horizontal stepper */}
        <div className="hidden sm:block">
          <div className="relative flex items-stretch">
            {funnel.steps.map((step, i) => {
              const isLast = i === funnel.steps.length - 1
              const barWidth = maxCount > 0 ? (step.count / maxCount) * 100 : 0

              return (
                <div key={step.key} className="flex-1 min-w-0 relative">
                  {/* Connector line between steps */}
                  {!isLast && (
                    <div className="absolute top-5 left-1/2 right-0 h-px bg-[var(--brand-border)] z-0" />
                  )}

                  {/* Step content */}
                  <div className="relative z-10 flex flex-col items-center px-1">
                    {/* Circle indicator */}
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors',
                        step.count > 0
                          ? 'border-[var(--user-accent)] bg-[var(--user-accent-soft)] text-[var(--user-accent)]'
                          : 'border-[var(--brand-border)] bg-[var(--brand-surface)] text-[var(--brand-muted)]',
                      )}
                    >
                      {step.count > 0 ? STEP_ICONS[i] : '○'}
                    </div>

                    {/* Count */}
                    <span
                      className={cn(
                        'mt-1.5 text-xl font-bold tabular-nums leading-none',
                        step.count > 0 ? 'text-[var(--brand-text)]' : 'text-[var(--brand-muted)] opacity-40',
                      )}
                    >
                      {step.count.toLocaleString()}
                    </span>

                    {/* Label */}
                    <span className="mt-0.5 text-[10px] text-[var(--brand-muted)] text-center leading-tight px-1">
                      {step.label}
                    </span>

                    {/* Conversion rate from previous */}
                    {step.rateFromPrev !== null && (
                      <span
                        className={cn(
                          'mt-1 text-[10px] font-semibold rounded-full px-1.5 py-0.5',
                          step.rateFromPrev >= 50
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : step.rateFromPrev >= 25
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400',
                        )}
                      >
                        {step.rateFromPrev}%
                      </span>
                    )}
                  </div>

                  {/* Mini progress bar */}
                  <div className="mt-3 h-1 rounded-full bg-[var(--brand-border)]/50 overflow-hidden mx-2">
                    <div
                      className="h-full rounded-full bg-[var(--user-accent)] transition-all duration-700"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Mobile: vertical list */}
        <div className="sm:hidden space-y-3">
          {funnel.steps.map((step, i) => {
            const barWidth = maxCount > 0 ? (step.count / maxCount) * 100 : 0
            return (
              <div key={step.key}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                        step.count > 0
                          ? 'bg-[var(--user-accent-soft)] text-[var(--user-accent)]'
                          : 'bg-[var(--brand-border)]/50 text-[var(--brand-muted)]',
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="text-xs font-medium text-[var(--brand-text)]">{step.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {step.rateFromPrev !== null && (
                      <span className="text-[10px] text-[var(--brand-muted)]">
                        {step.rateFromPrev}% conv.
                      </span>
                    )}
                    <span className="text-sm font-bold tabular-nums text-[var(--brand-text)]">
                      {step.count.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="h-1 rounded-full bg-[var(--brand-border)]/50 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--user-accent)] transition-all duration-700"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
