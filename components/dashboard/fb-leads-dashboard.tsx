'use client'

/**
 * FbLeadsDashboard — full dashboard for the fb_leads mode.
 *
 * Shows:
 *  1. KPI strip: New Leads | Speed-to-Lead | Cost per Lead | Conversion Rate
 *  2. Conversion funnel (New → Contacted → Booked)
 *  3. Lead flow bar chart (Recharts) — daily new leads vs contacted vs booked
 *  4. Speed-to-lead distribution
 *  5. Recent leads table with ad source attribution
 */

import { useState } from 'react'
import {
  Zap,
  Timer,
  DollarSign,
  Target,
  Megaphone,
  ArrowRight,
  TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { cn, formatCurrency } from '@/lib/utils'
import { getModeConfig } from '@/lib/dashboard/mode-registry'
import type { FbLeadsMetrics } from '@/lib/dashboard/fb-leads-metrics'
import type { CallLog, Client } from '@/types/database'

// ── KPI card (reusable, matching OutboundDashboard style) ───────────────────

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

// ── Speed-to-lead helpers ───────────────────────────────────────────────────

function formatSpeed(sec: number | null): string {
  if (sec === null) return '—'
  if (sec < 60) return `${Math.round(sec)}s`
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function speedLabel(sec: number | null): string {
  if (sec === null) return 'Pending data'
  if (sec <= 30) return 'Excellent'
  if (sec <= 120) return 'Good'
  if (sec <= 300) return 'Okay'
  return 'Needs work'
}

// ── Conversion funnel ───────────────────────────────────────────────────────

interface FunnelStage {
  label: string
  count: number
  color: string
}

function ConversionFunnel({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(...stages.map((s) => s.count), 1)

  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5">
      <h3 className="text-xs font-semibold text-[var(--brand-text)] mb-4">Lead Conversion Funnel</h3>
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

// ── Speed-to-lead distribution ──────────────────────────────────────────────

function SpeedDistribution({ leads }: { leads: CallLog[] }) {
  const buckets = [
    { label: '< 30s', min: 0, max: 30, color: '#10B981' },
    { label: '30s–2m', min: 30, max: 120, color: '#F59E0B' },
    { label: '2m–5m', min: 120, max: 300, color: '#F97316' },
    { label: '5m+', min: 300, max: Infinity, color: '#EF4444' },
  ]

  const counts = buckets.map((b) => ({
    ...b,
    count: leads.filter((c) => {
      const sec = c.response_time_seconds
      if (sec === null || sec === undefined) return false
      return sec >= b.min && sec < b.max
    }).length,
  }))

  const total = counts.reduce((s, c) => s + c.count, 0)
  if (total === 0) return null

  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5">
      <h3 className="text-xs font-semibold text-[var(--brand-text)] mb-4">Speed-to-Lead Distribution</h3>
      <div className="space-y-2">
        {counts.map((b) => {
          const pct = total > 0 ? Math.round((b.count / total) * 100) : 0
          return (
            <div key={b.label} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[var(--brand-muted)]">{b.label}</span>
                <span className="text-[11px] font-semibold text-[var(--brand-text)] tabular-nums">
                  {b.count} ({pct}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-[var(--brand-border)]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: b.color }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Recent leads table ──────────────────────────────────────────────────────

function RecentLeadsTable({ leads }: { leads: CallLog[] }) {
  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]">
        <div className="px-5 py-4 border-b border-[var(--brand-border)]">
          <h3 className="text-xs font-semibold text-[var(--brand-text)]">Recent FB Leads</h3>
        </div>
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-[var(--brand-muted)]">No Facebook leads recorded yet.</p>
          <p className="text-[11px] text-[var(--brand-muted)] mt-1">
            Leads with <code className="font-mono text-[10px]">lead_source=&apos;facebook&apos;</code> will appear here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--brand-border)] flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[var(--brand-text)]">Recent FB Leads</h3>
        <Link
          href="/dashboard/call-logs?leadSource=facebook"
          className="inline-flex items-center gap-1 text-[10px] text-[var(--brand-primary)] hover:opacity-80 transition-opacity"
        >
          View all <ArrowRight className="h-2.5 w-2.5" />
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--brand-border)]">
              {['Lead', 'Speed-to-Lead', 'Ad Set', 'Status', 'Revenue'].map((h) => (
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
            {leads.slice(0, 20).map((lead) => (
              <tr key={lead.id} className="hover:bg-[var(--brand-bg)]/50 transition-colors">
                <td className="px-4 py-2.5">
                  <p className="font-medium text-[var(--brand-text)] truncate max-w-[180px]">
                    {lead.caller_name ?? lead.semantic_title ?? 'Unknown'}
                  </p>
                  {lead.caller_phone && (
                    <p className="text-[10px] text-[var(--brand-muted)] font-mono">
                      {lead.caller_phone}
                    </p>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <SpeedBadge seconds={lead.response_time_seconds} />
                </td>
                <td className="px-4 py-2.5 text-[var(--brand-muted)] truncate max-w-[120px]">
                  {lead.ad_set_name ?? '—'}
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge isBooked={lead.is_booked} disposition={lead.disposition} />
                </td>
                <td className="px-4 py-2.5 tabular-nums text-[var(--brand-muted)]">
                  {lead.booked_value > 0 ? formatCurrency(lead.booked_value, 'USD') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SpeedBadge({ seconds }: { seconds: number | null | undefined }) {
  if (seconds === null || seconds === undefined) {
    return <span className="text-[10px] text-[var(--brand-muted)]">Pending</span>
  }
  const cls =
    seconds <= 30
      ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
      : seconds <= 120
      ? 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
      : 'bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400'
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium', cls)}>
      {formatSpeed(seconds)}
    </span>
  )
}

function StatusBadge({ isBooked, disposition }: { isBooked: boolean; disposition: string | null }) {
  if (isBooked) {
    return (
      <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400">
        Booked
      </span>
    )
  }
  if (disposition === 'not_interested') {
    return (
      <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium bg-[var(--brand-border)] text-[var(--brand-muted)]">
        Not interested
      </span>
    )
  }
  if (disposition === 'follow_up') {
    return (
      <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400">
        Follow-up
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400">
      In pipeline
    </span>
  )
}

// ── Recharts custom tooltip ─────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] p-2.5 shadow-md text-xs">
      <p className="font-medium text-[var(--brand-text)] mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[var(--brand-muted)]">{p.name}:</span>
          <span className="font-semibold text-[var(--brand-text)] tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

interface FbLeadsDashboardProps {
  tenant: Client
  metrics: FbLeadsMetrics
  callLogs: CallLog[]
  rangeDays?: number
}

export function FbLeadsDashboard({ tenant, metrics, callLogs, rangeDays = 30 }: FbLeadsDashboardProps) {
  const modeConfig = getModeConfig('fb_leads')

  // Format cost from cents to dollars
  const fmtCost = (cents: number | null) =>
    cents !== null ? `$${(cents / 100).toFixed(2)}` : '—'

  const kpis = [
    {
      label: 'New Leads',
      value: metrics.newLeads.toLocaleString(),
      icon: Zap,
      color: '#F59E0B',
      sub: 'From FB Ads',
    },
    {
      label: 'Speed-to-Lead',
      value: formatSpeed(metrics.avgSpeedToLeadSec),
      icon: Timer,
      color: '#10B981',
      sub: `${speedLabel(metrics.avgSpeedToLeadSec)} · avg first contact`,
    },
    {
      label: 'Cost per Lead',
      value: fmtCost(metrics.costPerLeadCents),
      icon: DollarSign,
      color: '#EF4444',
      sub: metrics.totalAdSpendCents > 0
        ? `Total spend: $${(metrics.totalAdSpendCents / 100).toFixed(2)}`
        : 'No spend data',
    },
    {
      label: 'Lead Conversion',
      value: `${metrics.leadConversionRate}%`,
      icon: Target,
      color: '#8B5CF6',
      sub: `${metrics.booked} booked of ${metrics.newLeads} leads`,
    },
  ]

  const funnelStages: FunnelStage[] = [
    { label: 'New Leads (FB)', count: metrics.newLeads, color: '#F59E0B' },
    { label: 'Contacted', count: metrics.contacted, color: '#06B6D4' },
    { label: 'Booked', count: metrics.booked, color: '#10B981' },
  ]

  // Chart data: last 14 days
  const chartData = metrics.chartSeries.slice(-14).map((pt) => ({
    date: pt.date.slice(5), // 'MM-DD'
    'New Leads': pt.newLeads,
    Contacted: pt.contacted,
    Booked: pt.booked,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F59E0B]/10">
          <Megaphone className="h-5 w-5 text-[#F59E0B]" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-[var(--brand-text)]">
            {modeConfig.label}
          </h1>
          <p className="text-xs text-[var(--brand-muted)]">
            {tenant.name} &middot; Last {rangeDays} days
          </p>
        </div>
        {metrics.adROI !== null && (
          <span
            className={cn(
              'ml-auto inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold',
              metrics.adROI >= 0
                ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                : 'border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400',
            )}
          >
            <TrendingUp className="h-3 w-3" />
            Ad ROI: {metrics.adROI >= 0 ? '+' : ''}{metrics.adROI}%
          </span>
        )}
      </div>

      {/* Empty state */}
      {metrics.newLeads === 0 && (
        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] px-6 py-10 text-center">
          <Megaphone className="mx-auto h-8 w-8 text-[var(--brand-muted)] opacity-40 mb-3" />
          <p className="text-sm font-medium text-[var(--brand-text)]">No FB leads yet</p>
          <p className="text-xs text-[var(--brand-muted)] mt-1 max-w-xs mx-auto">
            Leads with <code className="font-mono text-[10px]">lead_source=&apos;facebook&apos;</code> will
            appear here once ingested via n8n.
          </p>
        </div>
      )}

      {/* KPI strip */}
      {metrics.newLeads > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

      {/* Funnel + Bar chart */}
      {metrics.newLeads > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ConversionFunnel stages={funnelStages} />

          {/* Lead flow chart */}
          <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5">
            <h3 className="text-xs font-semibold text-[var(--brand-text)] mb-4">
              {modeConfig.primaryChart.title}
            </h3>
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barGap={2}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--brand-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'var(--brand-muted)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--brand-muted)' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    iconSize={8}
                    wrapperStyle={{ fontSize: 10 }}
                  />
                  {modeConfig.primaryChart.series.map((s) => (
                    <Bar
                      key={s.key}
                      dataKey={s.label}
                      fill={s.color}
                      radius={[2, 2, 0, 0]}
                      maxBarSize={24}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-[11px] text-[var(--brand-muted)] mt-4">
                More data needed for chart (at least 2 days of leads).
              </p>
            )}
          </div>
        </div>
      )}

      {/* Speed-to-lead distribution */}
      {metrics.newLeads > 0 && (
        <SpeedDistribution leads={metrics.recentLeads} />
      )}

      {/* Ad spend summary (only if we have cost data) */}
      {metrics.totalAdSpendCents > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              label: 'Total Ad Spend',
              value: `$${(metrics.totalAdSpendCents / 100).toFixed(2)}`,
              color: '#EF4444',
            },
            {
              label: 'Revenue from Bookings',
              value: formatCurrency(metrics.bookedRevenue, 'USD'),
              color: '#10B981',
            },
            {
              label: 'Return on Ad Spend',
              value: metrics.adROI !== null ? `${metrics.adROI >= 0 ? '+' : ''}${metrics.adROI}%` : '—',
              color: metrics.adROI !== null && metrics.adROI >= 0 ? '#10B981' : '#EF4444',
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4"
            >
              <p className="text-[10px] font-medium text-[var(--brand-muted)] uppercase tracking-wider mb-1">
                {item.label}
              </p>
              <p
                className="text-xl font-semibold tabular-nums"
                style={{ color: item.color }}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Recent leads table */}
      <RecentLeadsTable leads={metrics.recentLeads} />
    </div>
  )
}
