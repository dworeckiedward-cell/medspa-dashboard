'use client'

import { useState, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatCurrency } from '@/lib/utils'
import type { ChartDataPoint } from '@/types/database'

// ── Range options ────────────────────────────────────────────────────────────

type ChartRange = '1' | '3' | '7' | '14' | '30'

const RANGE_OPTIONS: { value: ChartRange; label: string }[] = [
  { value: '1', label: '24h' },
  { value: '3', label: '3d' },
  { value: '7', label: '7d' },
  { value: '14', label: '14d' },
  { value: '30', label: '30d' },
]

function getRangeStorageKey(tenantSlug?: string): string {
  return tenantSlug
    ? `servify:chartRange:${tenantSlug}`
    : 'servify:chartRange'
}

function getInitialRange(tenantSlug?: string): ChartRange {
  if (typeof window === 'undefined') return '30'
  const stored = localStorage.getItem(getRangeStorageKey(tenantSlug))
  if (stored && RANGE_OPTIONS.some((o) => o.value === stored)) return stored as ChartRange
  return '30'
}

// ── Types ────────────────────────────────────────────────────────────────────

interface RoiChartProps {
  data: ChartDataPoint[]
  currency?: string
  tenantSlug?: string
}

interface TooltipPayloadItem {
  name: string
  value: number
  color: string
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
    <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] p-3 shadow-xl">
      <p className="text-xs font-semibold text-[var(--brand-muted)] mb-2">{label}</p>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center gap-2 text-xs py-0.5">
          <div className="h-2 w-2 rounded-full" style={{ background: item.color }} />
          <span className="text-[var(--brand-muted)]">{item.name}:</span>
          <span className="font-semibold text-[var(--brand-text)]">
            {formatCurrency(item.value, currency)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function RoiChart({ data, currency = 'USD', tenantSlug }: RoiChartProps) {
  const [range, setRange] = useState<ChartRange>(() => getInitialRange(tenantSlug))

  // Filter data to the selected range (data is sorted chronologically, 1 point per day)
  const filteredData = useMemo(() => {
    const days = Number(range)
    if (days >= data.length) return data
    return data.slice(-days)
  }, [data, range])

  const hasData = filteredData.some((d) => d.potential > 0 || d.booked > 0 || d.inquiries > 0)

  function handleRangeChange(newRange: ChartRange) {
    setRange(newRange)
    localStorage.setItem(getRangeStorageKey(tenantSlug), newRange)
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base">Revenue Pipeline</CardTitle>
          <div className="flex items-center gap-0.5 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-0.5">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleRangeChange(opt.value)}
                className={cn(
                  'rounded-md px-2 py-1 text-[11px] font-medium transition-colors duration-150',
                  range === opt.value
                    ? 'bg-[var(--brand-surface)] text-[var(--brand-text)] shadow-sm'
                    : 'text-[var(--brand-muted)] hover:text-[var(--brand-text)]',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
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
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={filteredData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradPotential" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--brand-primary)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--brand-primary)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradBooked" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradInquiries" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--brand-accent)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--brand-accent)" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--brand-border)"
                strokeOpacity={0.6}
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: 'var(--brand-muted)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: 'var(--brand-muted)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
                width={42}
              />
              <Tooltip content={<CustomTooltip currency={currency} />} />
              <Legend
                wrapperStyle={{ fontSize: 11, color: 'var(--brand-muted)', paddingTop: '12px' }}
                iconType="circle"
                iconSize={8}
              />

              <Area
                type="monotone"
                dataKey="potential"
                name="Potential Revenue"
                stroke="var(--brand-primary)"
                strokeWidth={2}
                fill="url(#gradPotential)"
                dot={false}
                activeDot={{ r: 4, fill: 'var(--brand-primary)' }}
              />
              <Area
                type="monotone"
                dataKey="booked"
                name="Booked Value"
                stroke="#10B981"
                strokeWidth={2}
                fill="url(#gradBooked)"
                dot={false}
                activeDot={{ r: 4, fill: '#10B981' }}
              />
              <Area
                type="monotone"
                dataKey="inquiries"
                name="Inquiries Value"
                stroke="var(--brand-accent)"
                strokeWidth={2}
                fill="url(#gradInquiries)"
                dot={false}
                activeDot={{ r: 4, fill: 'var(--brand-accent)' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
