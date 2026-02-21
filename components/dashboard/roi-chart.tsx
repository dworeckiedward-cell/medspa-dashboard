'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { BarChart3 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import type { ChartDataPoint } from '@/types/database'

interface RoiChartProps {
  data: ChartDataPoint[]
  currency?: string
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

export function RoiChart({ data, currency = 'USD' }: RoiChartProps) {
  const hasData = data.some((d) => d.potential > 0 || d.booked > 0 || d.inquiries > 0)

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Revenue Pipeline</CardTitle>
        <CardDescription>Cumulative values over the last 30 days</CardDescription>
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
            <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
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
