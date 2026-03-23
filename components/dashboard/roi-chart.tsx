'use client'

import { useState, useMemo } from 'react'
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatCurrency } from '@/lib/utils'
import type { ChartDataPoint } from '@/types/database'
import { useDashboardData } from './dashboard-data-provider'
import { format, parseISO } from 'date-fns'

// ── Metric options ──────────────────────────────────────────────────────────

type MetricView = 'potential' | 'booked'

const METRIC_OPTIONS: { value: MetricView; label: string }[] = [
  { value: 'booked', label: 'Booked value' },
  { value: 'potential', label: 'Potential revenue' },
]

// ── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipPayloadItem {
  name: string
  value: number
  color: string
  dataKey: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
  currency: string
}

function CustomTooltip({ active, payload, label, currency }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-white/10 bg-gray-900/90 backdrop-blur-sm p-3 shadow-xl">
      <p className="text-xs font-semibold text-gray-400 mb-2">{label}</p>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center gap-2 text-xs py-0.5">
          <div className="h-2 w-2 rounded-full shrink-0" style={{ background: item.color }} />
          <span className="text-gray-400">{item.name}:</span>
          <span className="font-semibold text-white">
            {item.dataKey === 'inbound' || item.dataKey === 'outbound'
              ? `${item.value} call${item.value === 1 ? '' : 's'}`
              : formatCurrency(item.value, currency)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Segmented toggle ────────────────────────────────────────────────────────

function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-md px-2 py-1 text-[11px] font-medium transition-colors duration-150 whitespace-nowrap',
            value === opt.value
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

// ── Custom legend ────────────────────────────────────────────────────────────

interface LegendPayloadItem {
  value: string
  color: string
}

function CustomLegend({ payload }: { payload?: LegendPayloadItem[] }) {
  if (!payload?.length) return null
  return (
    <div className="flex items-center justify-center gap-5 pt-3">
      {payload.map((entry) => (
        <div key={entry.value} className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full shrink-0" style={{ background: entry.color }} />
          <span className="text-xs text-gray-400">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main export ─────────────────────────────────────────────────────────────

interface RoiChartProps {
  /** When false: hide the Booked Value toggle and always show Potential Revenue. Default: true */
  showBookedValue?: boolean
  data: ChartDataPoint[]
  currency?: string
  /** Number of days to display — inherited from the global range switch. Defaults to 30. */
  rangeDays?: number
  /** Optional range selector rendered in the card header, left of the metric toggle. */
  rangeSwitch?: React.ReactNode
}

export function RoiChart({ data, currency = 'USD', rangeDays = 30, rangeSwitch, showBookedValue = true }: RoiChartProps) {
  const [metric, setMetric] = useState<MetricView>(showBookedValue ? 'booked' : 'potential')
  const ctx = useDashboardData()

  // Build per-date inbound/outbound counts — mirrors logic in InboundTab/OutboundTab
  const { inboundByDate, outboundByDate } = useMemo(() => {
    const inbound = new Map<string, number>()
    const outbound = new Map<string, number>()
    for (const call of ctx?.calls ?? []) {
      try {
        const label = format(parseISO(call.created_at), 'MMM dd')
        const isOutbound =
          call.direction === 'outbound' ||
          (!call.direction && (call.call_type as string) === 'outbound_call')
        if (isOutbound) {
          outbound.set(label, (outbound.get(label) ?? 0) + 1)
        } else {
          inbound.set(label, (inbound.get(label) ?? 0) + 1)
        }
      } catch {
        // skip unparseable dates
      }
    }
    return { inboundByDate: inbound, outboundByDate: outbound }
  }, [ctx?.calls])

  const filteredData = useMemo(() => {
    const sliced = rangeDays === 0 || rangeDays >= data.length ? data : data.slice(-rangeDays)
    const mapped = sliced.map((d) => ({
      ...d,
      inbound: inboundByDate.get(d.date) ?? 0,
      outbound: outboundByDate.get(d.date) ?? 0,
    }))
    // Recharts needs ≥2 points to draw lines/areas — pad with a zero-point at start
    if (mapped.length === 1) {
      return [{ ...mapped[0], date: '', potential: 0, booked: 0, inquiries: 0, inbound: 0, outbound: 0 }, ...mapped]
    }
    return mapped
  }, [data, rangeDays, inboundByDate, outboundByDate])

  const hasData = filteredData.some((d) => d.potential > 0 || d.booked > 0 || d.inquiries > 0 || d.inbound > 0 || d.outbound > 0)

  const primaryKey = metric === 'potential' ? 'potential' : 'booked'
  const primaryLabel = metric === 'potential' ? 'Potential Revenue' : 'Booked Value'
  const primaryColor = '#818cf8'
  const gradientId = metric === 'potential' ? 'gradPotential' : 'gradBooked'

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">{showBookedValue ? 'Revenue Pipeline' : 'AI Revenue Pipeline'}</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {rangeSwitch}
            {showBookedValue && <SegmentedToggle options={METRIC_OPTIONS} value={metric} onChange={setMetric} />}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex h-48 sm:h-64 flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-border)]/50">
              <BarChart3 className="h-6 w-6 text-[var(--brand-muted)] opacity-50" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--brand-muted)]">No call data yet</p>
              <p className="text-xs text-[var(--brand-muted)] opacity-60 mt-1">
                Revenue pipeline will appear as calls come in
              </p>
            </div>
          </div>
        ) : (
          <div className="py-2 px-1 h-[260px] sm:h-[310px]"><ResponsiveContainer width="100%" height="100%">
            {/*
              Render order matters in recharts — last element is drawn on top.
              Outbound and Inbound lines render first (background),
              Revenue Area renders last so it stays visually on top.
            */}
            <ComposedChart data={filteredData} margin={{ top: 8, right: 36, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradPotential" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradBooked" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradInbound" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradOutbound" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f87171" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />

              {/* Left Y axis — revenue */}
              <YAxis
                yAxisId="revenue"
                orientation="left"
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => {
                  const sym = currency === 'CAD' ? 'CA$' : '$'
                  return v >= 1000 ? `${sym}${(v / 1000).toFixed(0)}k` : `${sym}${v}`
                }}
                width={54}
              />

              {/* Right Y axis — call counts. Always present to avoid layout flash. */}
              <YAxis
                yAxisId="calls"
                orientation="right"
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                label={{
                  value: 'Calls',
                  angle: 90,
                  position: 'insideRight',
                  offset: 10,
                  style: { fill: 'rgba(255,255,255,0.25)', fontSize: 10 },
                }}
                width={32}
              />

              <Tooltip content={<CustomTooltip currency={currency} />} />
              <Legend content={<CustomLegend />} />

              {/*
                Render order: inbound → outbound → revenue (last = top layer).
                animationBegin staggers entry for a premium cascade feel.
              */}

              {/* Inbound — emerald, enters first */}
              <Area
                yAxisId="calls"
                type="monotone"
                dataKey="inbound"
                name="Inbound"
                stroke="#34d399"
                strokeWidth={2.5}
                fill="url(#gradInbound)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: '#34d399' }}
                animationBegin={0}
                animationDuration={1000}
                animationEasing="ease-out"
              />

              {/* Outbound — soft red, enters second */}
              <Area
                yAxisId="calls"
                type="monotone"
                dataKey="outbound"
                name="Outbound"
                stroke="#f87171"
                strokeWidth={2.5}
                fill="url(#gradOutbound)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: '#f87171' }}
                animationBegin={350}
                animationDuration={1000}
                animationEasing="ease-out"
              />

              {/* Revenue — indigo, renders LAST (on top), enters third */}
              <Area
                yAxisId="revenue"
                type="monotone"
                dataKey={primaryKey}
                name={primaryLabel}
                stroke={primaryColor}
                strokeWidth={2.5}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: primaryColor }}
                animationBegin={700}
                animationDuration={1200}
                animationEasing="ease-out"
              />
            </ComposedChart>
          </ResponsiveContainer></div>
        )}
      </CardContent>
    </Card>
  )
}
