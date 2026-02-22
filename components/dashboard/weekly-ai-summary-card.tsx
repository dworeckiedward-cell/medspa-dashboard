'use client'

/**
 * WeeklyAiSummaryCard — compact AI performance digest.
 *
 * Deterministic, rules-based summary generated from call logs.
 * Shows: AI autonomy rate, follow-up queue, conversion trend, issues.
 */

import { useMemo } from 'react'
import { Bot, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { computePeriodSummary, type PeriodSummary } from '@/lib/dashboard/conversion-metrics'
import type { CallLog } from '@/types/database'

// ── Props ────────────────────────────────────────────────────────────────────

interface WeeklyAiSummaryCardProps {
  callLogs: CallLog[]
  currency?: string
}

// ── Narrative generator ──────────────────────────────────────────────────────

function generateSummary(
  current: PeriodSummary,
  prior: PeriodSummary,
): string {
  const parts: string[] = []

  // Autonomy
  const autonomyRate =
    current.callsHandled > 0
      ? Math.round(
          ((current.callsHandled - current.followUpsNeeded) /
            current.callsHandled) *
            100,
        )
      : 0

  if (current.callsHandled === 0) {
    return 'No calls were processed this week. Verify your AI receptionist is active and connected.'
  }

  parts.push(
    `AI handled ${current.callsHandled} call${current.callsHandled !== 1 ? 's' : ''} this week with a ${autonomyRate}% autonomy rate.`,
  )

  // Booking summary
  if (current.booked > 0) {
    parts.push(
      `${current.booked} appointment${current.booked !== 1 ? 's' : ''} booked directly by AI.`,
    )
  }

  // Follow-up
  if (current.followUpsNeeded > 0) {
    parts.push(
      `${current.followUpsNeeded} call${current.followUpsNeeded !== 1 ? 's' : ''} flagged for human follow-up.`,
    )
  }

  // Trend
  if (prior.callsHandled > 0) {
    const volumeDelta = Math.round(
      ((current.callsHandled - prior.callsHandled) / prior.callsHandled) * 100,
    )
    if (volumeDelta > 10) {
      parts.push(`Call volume is up ${volumeDelta}% vs last week.`)
    } else if (volumeDelta < -10) {
      parts.push(`Call volume is down ${Math.abs(volumeDelta)}% vs last week.`)
    }
  }

  return parts.join(' ')
}

// ── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  trend,
}: {
  label: string
  value: string
  trend: 'up' | 'down' | 'flat' | null
}) {
  const TrendIcon =
    trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus
  const trendColor =
    trend === 'up'
      ? 'text-emerald-500'
      : trend === 'down'
        ? 'text-rose-500'
        : 'text-[var(--brand-muted)]'

  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg bg-[var(--brand-bg)] px-3 py-2 min-w-[72px]">
      <div className="flex items-center gap-1">
        <span className="text-sm font-bold text-[var(--brand-text)] tabular-nums">
          {value}
        </span>
        {trend !== null && (
          <TrendIcon className={cn('h-3 w-3', trendColor)} />
        )}
      </div>
      <span className="text-[10px] text-[var(--brand-muted)] whitespace-nowrap">
        {label}
      </span>
    </div>
  )
}

// ── Helper: compute trend direction ──────────────────────────────────────────

function trendDir(
  current: number,
  prior: number,
): 'up' | 'down' | 'flat' | null {
  if (prior === 0 && current === 0) return null
  if (prior === 0) return 'up'
  const delta = ((current - prior) / prior) * 100
  if (delta > 5) return 'up'
  if (delta < -5) return 'down'
  return 'flat'
}

// ── Main export ──────────────────────────────────────────────────────────────

export function WeeklyAiSummaryCard({ callLogs }: WeeklyAiSummaryCardProps) {
  const current = useMemo(() => computePeriodSummary(callLogs, 0, 7), [callLogs])
  const prior = useMemo(() => computePeriodSummary(callLogs, 7, 7), [callLogs])

  const summary = useMemo(
    () => generateSummary(current, prior),
    [current, prior],
  )

  const autonomyRate =
    current.callsHandled > 0
      ? Math.round(
          ((current.callsHandled - current.followUpsNeeded) /
            current.callsHandled) *
            100,
        )
      : 0

  const bookingRate =
    current.callsHandled > 0
      ? Math.round((current.booked / current.callsHandled) * 100)
      : 0

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--user-accent-soft)]">
            <Bot className="h-3.5 w-3.5 text-[var(--user-accent)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--brand-text)]">
              Weekly AI Summary
            </p>
            <p className="text-[10px] text-[var(--brand-muted)]">
              Last 7 days vs prior 7 days
            </p>
          </div>
        </div>

        {/* Narrative summary */}
        <p className="text-xs leading-relaxed text-[var(--brand-text)] mb-3">
          {summary}
        </p>

        {/* Stat pills */}
        <div className="flex items-center gap-2 overflow-x-auto">
          <StatPill
            label="Calls"
            value={current.callsHandled.toLocaleString()}
            trend={trendDir(current.callsHandled, prior.callsHandled)}
          />
          <StatPill
            label="Autonomy"
            value={`${autonomyRate}%`}
            trend={trendDir(
              current.callsHandled - current.followUpsNeeded,
              prior.callsHandled - prior.followUpsNeeded,
            )}
          />
          <StatPill
            label="Booked"
            value={current.booked.toLocaleString()}
            trend={trendDir(current.booked, prior.booked)}
          />
          <StatPill
            label="Booking %"
            value={`${bookingRate}%`}
            trend={trendDir(current.booked, prior.booked)}
          />
          <StatPill
            label="Follow-ups"
            value={current.followUpsNeeded.toLocaleString()}
            trend={
              // For follow-ups, "down" is good → invert sense
              current.followUpsNeeded < prior.followUpsNeeded
                ? 'down'
                : current.followUpsNeeded > prior.followUpsNeeded
                  ? 'up'
                  : prior.followUpsNeeded === 0 && current.followUpsNeeded === 0
                    ? null
                    : 'flat'
            }
          />
        </div>
      </CardContent>
    </Card>
  )
}
