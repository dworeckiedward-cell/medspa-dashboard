'use client'

/**
 * WeeklyReportCard — executive performance summary.
 *
 * Compares the last 7 days vs the prior 7 days and surfaces:
 *  • Top-line metrics (calls handled, leads, booked, revenue, hours saved)
 *  • Rules-based AI insights bullets
 *  • Action recommendations
 *  • Copy / share as text
 */

import { useMemo, useState } from 'react'
import {
  Phone,
  Users,
  CalendarCheck,
  DollarSign,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Copy,
  Check,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { formatCurrency, formatDuration } from '@/lib/utils'
import { computePeriodSummary, formatDelta, type PeriodSummary } from '@/lib/dashboard/conversion-metrics'
import { cn } from '@/lib/utils'
import type { CallLog } from '@/types/database'

// ── Props ────────────────────────────────────────────────────────────────────

interface WeeklyReportCardProps {
  callLogs: CallLog[]
  currency?: string
}

// ── Rules-based insight engine ───────────────────────────────────────────────

interface Insight {
  type: 'positive' | 'warning' | 'tip'
  text: string
}

function generateInsights(current: PeriodSummary, prior: PeriodSummary): Insight[] {
  const insights: Insight[] = []

  // Booking rate
  const bookingRate = current.callsHandled > 0
    ? Math.round((current.booked / current.callsHandled) * 100) : 0
  const priorBookingRate = prior.callsHandled > 0
    ? Math.round((prior.booked / prior.callsHandled) * 100) : 0

  if (bookingRate >= 30) {
    insights.push({ type: 'positive', text: `Strong booking rate at ${bookingRate}% — above the 30% benchmark.` })
  } else if (bookingRate < 15 && current.callsHandled > 3) {
    insights.push({ type: 'warning', text: `Booking rate is ${bookingRate}% — below the 15% floor. Consider reviewing call scripts.` })
  }

  if (bookingRate > priorBookingRate + 5) {
    insights.push({ type: 'positive', text: `Booking rate improved ${bookingRate - priorBookingRate}pp week-over-week.` })
  }
  if (bookingRate < priorBookingRate - 5) {
    insights.push({ type: 'warning', text: `Booking rate dropped ${priorBookingRate - bookingRate}pp vs last week. Review recent call summaries.` })
  }

  // Follow-ups
  if (current.followUpsNeeded > 0) {
    const pct = Math.round((current.followUpsNeeded / (current.leadsGenerated || 1)) * 100)
    if (pct >= 40) {
      insights.push({
        type: 'warning',
        text: `${current.followUpsNeeded} leads (${pct}%) still need human follow-up — prioritise callbacks to protect pipeline.`,
      })
    } else {
      insights.push({
        type: 'tip',
        text: `${current.followUpsNeeded} lead${current.followUpsNeeded !== 1 ? 's' : ''} flagged for follow-up this week.`,
      })
    }
  }

  // Revenue
  if (current.revenue > prior.revenue * 1.2 && prior.revenue > 0) {
    insights.push({
      type: 'positive',
      text: `Revenue is up ${Math.round(((current.revenue - prior.revenue) / prior.revenue) * 100)}% vs last week — great momentum.`,
    })
  }

  // Volume
  if (current.callsHandled > prior.callsHandled * 1.3 && prior.callsHandled > 0) {
    insights.push({ type: 'positive', text: `Call volume jumped ${Math.round(((current.callsHandled - prior.callsHandled) / prior.callsHandled) * 100)}% — AI handled the surge automatically.` })
  }

  // Low volume
  if (current.callsHandled === 0) {
    insights.push({ type: 'tip', text: 'No calls processed this week yet. Verify your AI receptionist is connected.' })
  }

  // Hour savings tip
  if (current.hoursSaved > 10) {
    insights.push({
      type: 'positive',
      text: `AI saved ${Math.round(current.hoursSaved)} hours of reception time this week — equivalent to ${Math.round(current.hoursSaved / 8)} full days.`,
    })
  }

  return insights.slice(0, 4)
}

// ── Delta badge ──────────────────────────────────────────────────────────────

function DeltaBadge({ current, prior }: { current: number; prior: number }) {
  const delta = formatDelta(current, prior)
  if (!delta) return null
  const Icon = delta.positive ? TrendingUp : delta.label === '+0%' ? Minus : TrendingDown
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-[10px] font-semibold rounded-full px-1.5 py-0.5',
        delta.positive
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
          : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400',
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {delta.label}
    </span>
  )
}

// ── Metric row ───────────────────────────────────────────────────────────────

function MetricRow({
  icon: Icon,
  label,
  value,
  current,
  prior,
  color = 'var(--brand-primary)',
}: {
  icon: React.ElementType
  label: string
  value: string
  current: number
  prior: number
  color?: string
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[var(--brand-border)] last:border-0">
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
          style={{ background: `${color}20`, color }}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-xs text-[var(--brand-muted)]">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <DeltaBadge current={current} prior={prior} />
        <span className="text-sm font-semibold text-[var(--brand-text)] tabular-nums">{value}</span>
      </div>
    </div>
  )
}

// ── Main export ──────────────────────────────────────────────────────────────

export function WeeklyReportCard({ callLogs, currency = 'USD' }: WeeklyReportCardProps) {
  const [copied, setCopied] = useState(false)

  const current = useMemo(() => computePeriodSummary(callLogs, 0, 7), [callLogs])
  const prior   = useMemo(() => computePeriodSummary(callLogs, 7, 7), [callLogs])
  const insights = useMemo(() => generateInsights(current, prior), [current, prior])

  const weekLabel = (() => {
    const end   = new Date()
    const start = new Date(Date.now() - 7 * 86_400_000)
    return `${start.toLocaleDateString('en', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en', { month: 'short', day: 'numeric' })}`
  })()

  function handleCopy() {
    const lines = [
      `Weekly AI Receptionist Report (${weekLabel})`,
      ``,
      `Calls handled:  ${current.callsHandled}`,
      `Leads captured: ${current.leadsGenerated}`,
      `Appointments:   ${current.booked}`,
      `Revenue:        ${formatCurrency(current.revenue, currency)}`,
      `Hours saved:    ${current.hoursSaved.toFixed(1)} h`,
      ``,
      ...insights.map((ins) => `• ${ins.text}`),
    ]
    navigator.clipboard.writeText(lines.join('\n')).catch(() => undefined)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const metrics = [
    {
      icon: Phone,
      label: 'Calls handled',
      value: current.callsHandled.toLocaleString(),
      current: current.callsHandled,
      prior: prior.callsHandled,
      color: 'var(--brand-primary)',
    },
    {
      icon: Users,
      label: 'Leads generated',
      value: current.leadsGenerated.toLocaleString(),
      current: current.leadsGenerated,
      prior: prior.leadsGenerated,
      color: '#7C3AED',
    },
    {
      icon: CalendarCheck,
      label: 'Appointments booked',
      value: current.booked.toLocaleString(),
      current: current.booked,
      prior: prior.booked,
      color: '#10B981',
    },
    {
      icon: DollarSign,
      label: 'Revenue',
      value: formatCurrency(current.revenue, currency),
      current: current.revenue,
      prior: prior.revenue,
      color: '#F59E0B',
    },
    {
      icon: Clock,
      label: 'Hours saved',
      value: `${current.hoursSaved.toFixed(1)} h`,
      current: current.hoursSaved,
      prior: prior.hoursSaved,
      color: 'var(--brand-accent)',
    },
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Weekly Report</CardTitle>
            <CardDescription>{weekLabel}</CardDescription>
          </div>
          <button
            onClick={handleCopy}
            className="shrink-0 flex items-center gap-1.5 rounded-md border border-[var(--brand-border)] px-2.5 py-1.5 text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-border)]/40 transition-colors"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy report'}
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Metrics */}
        <div>
          {metrics.map((m) => (
            <MetricRow key={m.label} {...m} />
          ))}
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider mb-2">
              AI Insights
            </p>
            <ul className="space-y-2">
              {insights.map((ins, i) => {
                const Icon =
                  ins.type === 'positive' ? TrendingUp
                  : ins.type === 'warning' ? AlertTriangle
                  : Lightbulb
                const iconColor =
                  ins.type === 'positive' ? 'text-emerald-500'
                  : ins.type === 'warning' ? 'text-amber-500'
                  : 'text-[var(--user-accent)]'
                return (
                  <li key={i} className="flex items-start gap-2">
                    <Icon className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', iconColor)} />
                    <span className="text-xs text-[var(--brand-text)] leading-relaxed">{ins.text}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Data completeness note */}
        <p className="text-[10px] text-[var(--brand-muted)] opacity-60 text-center">
          Based on {callLogs.length} total logged calls · Last 7 days vs prior 7 days
        </p>
      </CardContent>
    </Card>
  )
}
