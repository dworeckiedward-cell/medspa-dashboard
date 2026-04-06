'use client'

/**
 * OpsHeroChart — full-width chart module with 3 views and 5 range options.
 *
 * Views:
 *   1. MRR & Clients — dual area chart
 *   2. ROI: CAC vs MRR — dual line chart
 *   3. Clients & Churn — area + line
 *
 * All data is scaffolded (estimated) until historical time-series storage exists.
 */

import { useState, useMemo } from 'react'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn, polish } from '@/lib/utils'
import { formatMoneyCompact } from '@/lib/ops-financials/format'
import type {
  OpsChartPoint,
  OpsChartView,
  OpsRange,
} from '@/lib/ops/ops-overview-metrics'
import {
  OPS_CHART_VIEWS,
  OPS_RANGE_OPTIONS,
} from '@/lib/ops/ops-overview-metrics'

// ── Props ────────────────────────────────────────────────────────────────────

interface OpsHeroChartProps {
  seriesByRange: Record<number, OpsChartPoint[]>
  isEstimated: boolean
}

// ── View titles ──────────────────────────────────────────────────────────────

const VIEW_TITLES: Record<OpsChartView, string> = {
  'mrr-clients': 'MRR & Clients',
  roi: 'ROI: CAC vs MRR',
  churn: 'Clients & Churn',
}

// ── Pill toggle (reusable) ───────────────────────────────────────────────────

function PillToggle<T extends string | number>({
  options,
  active,
  onChange,
}: {
  options: readonly { value: T; label: string }[]
  active: T
  onChange: (val: T) => void
}) {
  return (
    <div className="inline-flex items-center gap-px rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-0.5">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/30',
            active === opt.value
              ? 'bg-[var(--brand-surface)] text-[var(--brand-text)] shadow-sm'
              : 'text-[var(--brand-muted)] hover:text-[var(--brand-text)]',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── Custom tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
  view,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
  view: OpsChartView
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-2 shadow-lg">
      <p className="text-[10px] font-medium text-[var(--brand-muted)] mb-1">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-xs text-[var(--brand-muted)]">{entry.name}:</span>
          <span className="text-xs font-semibold text-[var(--brand-text)] tabular-nums">
            {entry.name.includes('MRR') || entry.name.includes('CAC')
              ? formatMoneyCompact(entry.value)
              : entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function OpsHeroChart({ seriesByRange, isEstimated }: OpsHeroChartProps) {
  const [view, setView] = useState<OpsChartView>('mrr-clients')
  const [range, setRange] = useState<OpsRange>(30)

  // Select the pre-computed series for the active range
  const data = seriesByRange[range] ?? seriesByRange[30] ?? []

  const viewOptions = useMemo(
    () => OPS_CHART_VIEWS.map((v) => ({ value: v.key, label: v.label })),
    [],
  )

  const rangeOptions = useMemo(
    () =>
      OPS_RANGE_OPTIONS.map((r) => ({
        value: r,
        label: r === 365 ? '1y' : `${r}d`,
      })),
    [],
  )

  // Check if we have CAC data for ROI view
  const hasCac = data.some((p) => p.avgCac !== null && p.avgCac > 0)

  return (
    <Card>
      <CardContent className="p-5">
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-[var(--brand-text)] leading-tight">
              {VIEW_TITLES[view]}
            </h3>
            {isEstimated && (
              <div className="flex items-center gap-1 mt-0.5">
                <Info className="h-3 w-3 text-[var(--brand-muted)] opacity-60" />
                <span className="text-[10px] text-[var(--brand-muted)] opacity-60">
                  Estimated from current snapshots
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <PillToggle options={viewOptions} active={view} onChange={setView} />
            <PillToggle options={rangeOptions} active={range} onChange={setRange} />
          </div>
        </div>

        {/* ── Chart body ────────────────────────────────────────────── */}
        <div className="h-64 sm:h-72">
          {view === 'mrr-clients' && <MrrClientsChart data={data} />}
          {view === 'roi' && (
            hasCac ? (
              <RoiChart data={data} />
            ) : (
              <ChartEmptyState message="CAC data not available yet. Add acquisition costs in Unit Economics to see ROI trends." />
            )
          )}
          {view === 'churn' && <ChurnChart data={data} />}
        </div>

        {/* ── Legend ─────────────────────────────────────────────────── */}
        <div className="mt-3 pt-3 border-t border-[var(--brand-border)]/40 flex flex-wrap items-center gap-4">
          {view === 'mrr-clients' && (
            <>
              <LegendDot color="#34d399" label="MRR" />
              <LegendDot color="#818cf8" label="Active Clients" />
            </>
          )}
          {view === 'roi' && hasCac && (
            <>
              <LegendDot color="#34d399" label="MRR" />
              <LegendDot color="#fbbf24" label="Avg CAC" />
            </>
          )}
          {view === 'churn' && (
            <>
              <LegendDot color="#818cf8" label="Active Clients" />
              <LegendDot color="#f87171" label="Churn (estimated)" />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Sub-charts ───────────────────────────────────────────────────────────────

function MrrClientsChart({ data }: { data: OpsChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
        <defs>
          <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="clientsGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818cf8" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--brand-border)" strokeOpacity={0.3} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--brand-muted)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis
          yAxisId="mrr"
          tick={{ fontSize: 10, fill: 'var(--brand-muted)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => formatMoneyCompact(v)}
        />
        <YAxis
          yAxisId="clients"
          orientation="right"
          tick={{ fontSize: 10, fill: 'var(--brand-muted)' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<ChartTooltip view="mrr-clients" />} />
        <Area
          yAxisId="mrr"
          type="monotone"
          dataKey="mrr"
          name="MRR"
          stroke="#34d399"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="url(#mrrGrad)"
          fillOpacity={0.15}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, fill: 'var(--brand-surface)' }}
        />
        <Area
          yAxisId="clients"
          type="monotone"
          dataKey="activeClients"
          name="Active Clients"
          stroke="#818cf8"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="url(#clientsGrad)"
          fillOpacity={0.15}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, fill: 'var(--brand-surface)' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function RoiChart({ data }: { data: OpsChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--brand-border)" strokeOpacity={0.3} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--brand-muted)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis
          tick={{ fontSize: 10, fill: 'var(--brand-muted)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => formatMoneyCompact(v)}
        />
        <Tooltip content={<ChartTooltip view="roi" />} />
        <Line
          type="monotone"
          dataKey="mrr"
          name="MRR"
          stroke="#34d399"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, fill: 'var(--brand-surface)' }}
        />
        <Line
          type="monotone"
          dataKey="avgCac"
          name="Avg CAC"
          stroke="#fbbf24"
          strokeWidth={2}
          strokeLinecap="round"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, fill: 'var(--brand-surface)' }}
          strokeDasharray="6 3"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function ChurnChart({ data }: { data: OpsChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
        <defs>
          <linearGradient id="clientsChurnGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818cf8" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--brand-border)" strokeOpacity={0.3} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--brand-muted)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis
          yAxisId="clients"
          tick={{ fontSize: 10, fill: 'var(--brand-muted)' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="churn"
          orientation="right"
          tick={{ fontSize: 10, fill: 'var(--brand-muted)' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<ChartTooltip view="churn" />} />
        <Area
          yAxisId="clients"
          type="monotone"
          dataKey="activeClients"
          name="Active Clients"
          stroke="#818cf8"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="url(#clientsChurnGrad)"
          fillOpacity={0.15}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, fill: 'var(--brand-surface)' }}
        />
        <Line
          yAxisId="churn"
          type="monotone"
          dataKey="churnCount"
          name="Churn (est.)"
          stroke="#f87171"
          strokeWidth={2}
          strokeLinecap="round"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, fill: 'var(--brand-surface)' }}
          strokeDasharray="6 3"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2 w-2 rounded-full" style={{ background: color }} />
      <span className="text-[10px] text-[var(--brand-muted)]">{label}</span>
    </div>
  )
}

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className={cn(polish.emptyState, 'py-10 h-full')}>
      <div>
        <p className="text-sm font-semibold text-[var(--brand-text)]">Not enough data yet</p>
        <p className="text-xs text-[var(--brand-muted)] opacity-60 mt-1 max-w-[300px] mx-auto">
          {message}
        </p>
      </div>
    </div>
  )
}
