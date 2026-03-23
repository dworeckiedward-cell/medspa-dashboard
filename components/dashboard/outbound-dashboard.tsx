'use client'

/**
 * OutboundDashboard — renders inside DashboardLayout for client_type='outbound'.
 *
 * Shows:
 *  1. KPI strip: Calls Made | Contacted | Qualified | Booked | Contact Rate | Booking Rate
 *  2. Next Best Actions strip (Phase 1)
 *  3. Conversion funnel bar + Trend chart v2 with 3-mode toggle (Phase 2)
 *  4. Recent outbound calls table with Qualification Highlights (Phase 3)
 *  5. Saved Views presets (Phase 4)
 */

import { useState } from 'react'
import { Phone, UserCheck, Sparkles, CalendarCheck, TrendingUp, Activity, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { cn, formatCurrency } from '@/lib/utils'
import { OutboundNextActions } from './outbound-next-actions'
import type { OutboundMetrics } from '@/lib/dashboard/outbound-metrics'
import type { CallLog, Client } from '@/types/database'

// ── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  color: string
}) {
  return (
    <div className="relative rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{ background: `radial-gradient(ellipse at top left, ${color}, transparent 70%)` }}
      />
      <div className="relative flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-[var(--brand-muted)] uppercase tracking-wider mb-1">
            {label}
          </p>
          <p className="text-2xl font-semibold tracking-tight text-[var(--brand-text)] tabular-nums leading-none">
            {value}
          </p>
          {sub && <p className="text-[10px] text-[var(--brand-muted)] mt-1 truncate">{sub}</p>}
        </div>
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `${color}15`, color }}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  )
}

// ── Conversion funnel ─────────────────────────────────────────────────────────

interface FunnelStage {
  label: string
  count: number
  color: string
}

function ConversionFunnel({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(...stages.map((s) => s.count), 1)

  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5">
      <h3 className="text-xs font-semibold text-[var(--brand-text)] mb-4">Conversion Funnel</h3>
      <div className="space-y-2.5">
        {stages.map((stage, i) => {
          const pct = Math.round((stage.count / max) * 100)
          const convRate =
            i > 0 && stages[i - 1].count > 0
              ? Math.round((stage.count / stages[i - 1].count) * 100)
              : null
          return (
            <div key={stage.label} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[var(--brand-muted)]">{stage.label}</span>
                <div className="flex items-center gap-2">
                  {convRate !== null && (
                    <span className="text-[10px] text-[var(--brand-muted)]">{convRate}% of prev</span>
                  )}
                  <span className="text-[11px] font-semibold text-[var(--brand-text)] tabular-nums w-8 text-right">
                    {stage.count}
                  </span>
                </div>
              </div>
              <div className="h-2 rounded-full bg-[var(--brand-border)]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: stage.color }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Qualification helpers (Phase 3) ──────────────────────────────────────────

function ConfidencePill({ confidence }: { confidence: number | null | undefined }) {
  if (confidence == null) return <span className="text-[10px] text-[var(--brand-muted)]">—</span>
  const pct = Math.round(confidence * 100)
  const cls =
    pct >= 60
      ? 'bg-violet-100 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400'
      : pct >= 40
      ? 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
      : 'bg-[var(--brand-border)] text-[var(--brand-muted)]'
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium', cls)}>
      {pct}% conf
    </span>
  )
}

function DurationBucketBadge({ seconds }: { seconds: number | null | undefined }) {
  const secs = seconds ?? 0
  const label = secs <= 30 ? '≤30s' : secs < 120 ? '30s–2m' : '2m+'
  const cls =
    secs <= 30
      ? 'bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400'
      : secs < 120
      ? 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
      : 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium', cls)}>
      {label}
    </span>
  )
}

// ── Disposition badge ─────────────────────────────────────────────────────────

function DispositionBadge({ disposition }: { disposition: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    booked:         { label: 'Booked',         cls: 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' },
    follow_up:      { label: 'Follow-up',      cls: 'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400' },
    not_interested: { label: 'Not interested', cls: 'bg-[var(--brand-border)] text-[var(--brand-muted)]' },
    no_answer:      { label: 'No answer',      cls: 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400' },
    voicemail:      { label: 'Voicemail',      cls: 'bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400' },
  }
  const cfg = disposition
    ? (map[disposition] ?? { label: disposition, cls: 'bg-[var(--brand-border)] text-[var(--brand-muted)]' })
    : null
  if (!cfg) return <span className="text-[10px] text-[var(--brand-muted)]">—</span>
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium', cfg.cls)}>
      {cfg.label}
    </span>
  )
}

// ── Recent calls table ────────────────────────────────────────────────────────

function RecentCallsTable({ calls, viewAllHref }: { calls: CallLog[]; viewAllHref?: string }) {
  if (calls.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]">
        <div className="px-5 py-4 border-b border-[var(--brand-border)] flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[var(--brand-text)]">Recent Outbound Calls</h3>
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="inline-flex items-center gap-1 text-[10px] text-[var(--brand-primary)] hover:opacity-80 transition-opacity"
            >
              View all <ArrowRight className="h-2.5 w-2.5" />
            </Link>
          )}
        </div>
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-[var(--brand-muted)]">No outbound calls recorded yet.</p>
          <p className="text-[11px] text-[var(--brand-muted)] mt-1">
            Call logs with <code className="font-mono text-[10px]">direction=&apos;outbound&apos;</code> will appear here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--brand-border)] flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[var(--brand-text)]">Recent Outbound Calls</h3>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-1 text-[10px] text-[var(--brand-primary)] hover:opacity-80 transition-opacity"
          >
            View all <ArrowRight className="h-2.5 w-2.5" />
          </Link>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--brand-border)]">
              {/* Phase 3: replaced Contacted / Qualified / Disposition with Qualification */}
              {['Lead', 'Duration', 'Qualification', 'Revenue'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2 text-left text-[10px] font-medium text-[var(--brand-muted)] uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--brand-border)]">
            {calls.map((call) => {
              const dur = call.duration_seconds
                ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s`
                : '—'
              return (
                <tr key={call.id} className="hover:bg-[var(--brand-bg)]/50 transition-colors">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-[var(--brand-text)] truncate max-w-[180px]">
                      {call.caller_name ?? call.semantic_title ?? 'Unknown'}
                    </p>
                    {call.caller_phone && (
                      <p className="text-[10px] text-[var(--brand-muted)] font-mono">
                        {call.caller_phone}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--brand-muted)] tabular-nums">{dur}</td>
                  {/* Phase 3: Qualification cell — confidence pill + duration bucket + disposition */}
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      <ConfidencePill confidence={call.lead_confidence} />
                      <DurationBucketBadge seconds={call.duration_seconds} />
                      <DispositionBadge disposition={call.disposition} />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-[var(--brand-muted)]">
                    {call.potential_revenue > 0 ? formatCurrency(call.potential_revenue, 'USD') : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Saved Views presets (Phase 4) ────────────────────────────────────────────

const SAVED_VIEWS = [
  {
    label: 'Qualified, Not Booked',
    href: '/dashboard/call-logs?direction=outbound&minConfidence=60',
  },
  {
    label: 'Long Calls (≥2m)',
    href: '/dashboard/call-logs?direction=outbound&minDuration=120',
  },
  {
    label: 'Booked Appointments',
    href: '/dashboard/call-logs?direction=outbound&bookedOnly=1',
  },
]

// ── Trend chart modes (Phase 2) ───────────────────────────────────────────────

type ChartMode = 'calls' | 'contactRate' | 'bookingRate'

const CHART_MODES: { id: ChartMode; label: string; color: string }[] = [
  { id: 'calls',       label: 'Daily Calls', color: '#2563EB' },
  { id: 'contactRate', label: 'Contact %',   color: '#06B6D4' },
  { id: 'bookingRate', label: 'Booking %',   color: '#F59E0B' },
]

// ── Main component ─────────────────────────────────────────────────────────────

interface OutboundDashboardProps {
  tenant: Client
  metrics: OutboundMetrics
  callLogs: CallLog[]
  rangeDays?: number
}

export function OutboundDashboard({ tenant, metrics, callLogs, rangeDays }: OutboundDashboardProps) {
  const [chartMode, setChartMode] = useState<ChartMode>('calls')

  const kpis = [
    {
      label: 'Calls Made',
      value: metrics.callsMade.toLocaleString(),
      icon: Phone,
      color: '#2563EB',
      sub: 'Outbound total',
    },
    {
      label: 'Contacted',
      value: metrics.contacted.toLocaleString(),
      icon: UserCheck,
      color: '#10B981',
      sub: 'Answered (>30s)',
    },
    {
      label: 'Qualified',
      value: metrics.qualified.toLocaleString(),
      icon: Sparkles,
      color: '#8B5CF6',
      sub: 'Lead confidence ≥60%',
    },
    {
      label: 'Booked',
      value: metrics.booked.toLocaleString(),
      icon: CalendarCheck,
      color: '#F59E0B',
      sub: 'Appointments set',
    },
    {
      label: 'Contact Rate',
      value: `${metrics.contactRate}%`,
      icon: Activity,
      color: '#06B6D4',
      sub: 'Contacted / called',
    },
    {
      label: 'Booking Rate',
      value: `${metrics.bookingRate}%`,
      icon: TrendingUp,
      color: metrics.bookingRate >= 10 ? '#10B981' : '#EF4444',
      sub: 'Booked / contacted',
    },
  ]

  const funnelStages = [
    { label: 'Calls Made', count: metrics.callsMade, color: '#2563EB' },
    { label: 'Contacted',  count: metrics.contacted,  color: '#10B981' },
    { label: 'Qualified',  count: metrics.qualified,  color: '#8B5CF6' },
    { label: 'Booked',     count: metrics.booked,     color: '#F59E0B' },
  ]

  // Phase 2: compute chart values for the active mode
  const activeMode = CHART_MODES.find((m) => m.id === chartMode)!
  const chartPoints = metrics.chartSeries.slice(-14).map((pt) => {
    let value = 0
    if (chartMode === 'calls') {
      value = pt.calls
    } else if (chartMode === 'contactRate') {
      value = pt.calls > 0 ? Math.round((pt.contacted / pt.calls) * 100) : 0
    } else {
      value = pt.contacted > 0 ? Math.round((pt.booked / pt.contacted) * 100) : 0
    }
    return { ...pt, value }
  })
  const chartMax = Math.max(...chartPoints.map((p) => p.value), 1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[var(--brand-text)]">Outbound Dashboard</h1>
          <p className="text-xs text-[var(--brand-muted)] mt-0.5">
            {tenant.name} — outbound calling performance · last {rangeDays ?? 30} days
          </p>
        </div>
        <span className="ml-2 inline-flex items-center rounded-full border border-[var(--brand-border)]/60 bg-[var(--brand-surface)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--brand-muted)]">
          Outbound Only
        </span>
      </div>

      {/* Empty state — no outbound calls at all */}
      {metrics.callsMade === 0 && (
        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] px-6 py-10 text-center">
          <Phone className="mx-auto h-8 w-8 text-[var(--brand-muted)] opacity-40 mb-3" />
          <p className="text-sm font-medium text-[var(--brand-text)]">No outbound calls yet</p>
          <p className="text-xs text-[var(--brand-muted)] mt-1 max-w-xs mx-auto">
            Outbound calls with <code className="font-mono text-[10px]">direction=&apos;outbound&apos;</code> will appear here once ingested.
          </p>
        </div>
      )}

      {/* KPI strip */}
      {metrics.callsMade > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {kpis.map((kpi) => (
            <KpiCard
              key={kpi.label}
              icon={kpi.icon}
              label={kpi.label}
              value={kpi.value}
              sub={kpi.sub}
              color={kpi.color}
            />
          ))}
        </div>
      )}

      {/* Next Best Actions (Phase 1) */}
      {metrics.callsMade > 0 && (
        <OutboundNextActions metrics={metrics} callLogs={callLogs} rangeDays={rangeDays} />
      )}

      {/* Funnel + Trend chart v2 (Phase 2) */}
      {metrics.callsMade > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ConversionFunnel stages={funnelStages} />

          {/* Trend chart with 3-mode toggle */}
          <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-[var(--brand-text)]">Daily Trend</h3>

              {/* Mode toggle */}
              <div className="flex items-center gap-0.5 rounded-lg border border-[var(--brand-border)] p-0.5">
                {CHART_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setChartMode(mode.id)}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors',
                      chartMode === mode.id
                        ? 'bg-[var(--brand-primary)] text-white'
                        : 'text-[var(--brand-muted)] hover:text-[var(--brand-text)]',
                    )}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {metrics.chartSeries.length > 1 ? (
              <div className="flex-1 space-y-1.5">
                {chartPoints.map((pt) => {
                  const pct = Math.round((pt.value / chartMax) * 100)
                  const displayVal =
                    chartMode === 'calls' ? pt.value.toString() : `${pt.value}%`
                  return (
                    <div key={pt.date} className="flex items-center gap-2">
                      <span className="text-[9px] text-[var(--brand-muted)] w-16 shrink-0 tabular-nums">
                        {pt.date.slice(5)}
                      </span>
                      <div className="flex-1 h-1.5 rounded-full bg-[var(--brand-border)]">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%`, background: activeMode.color }}
                        />
                      </div>
                      <span className="text-[9px] tabular-nums text-[var(--brand-muted)] w-8 text-right">
                        {displayVal}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-[11px] text-[var(--brand-muted)] mt-4">
                More data needed for trend chart (≥2 days of calls).
              </p>
            )}
          </div>
        </div>
      )}

      {/* Saved Views presets (Phase 4) */}
      {metrics.callsMade > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--brand-muted)]">
            Saved Views:
          </span>
          {SAVED_VIEWS.map((view) => (
            <Link
              key={view.label}
              href={view.href}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-1 text-[10px] font-medium text-[var(--brand-muted)] transition-colors hover:border-[var(--brand-primary)]/40 hover:text-[var(--brand-primary)]"
            >
              {view.label}
              <ArrowRight className="h-2.5 w-2.5" />
            </Link>
          ))}
        </div>
      )}

      {/* Recent calls table with Qualification Highlights (Phase 3) */}
      <RecentCallsTable
        calls={metrics.recentCalls}
        viewAllHref="/dashboard/call-logs?direction=outbound"
      />
    </div>
  )
}
