'use client'

import { useMemo } from 'react'
import { subDays, format, parseISO, startOfDay } from 'date-fns'
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
import { useDashboardData } from './dashboard-data-provider'
import { useTabState } from './tab-state-context'
import type { CallSentiment } from '@/types/database'

type CallFilter = 'all' | 'inbound' | 'outbound'

function getFilter(activeTab: string): CallFilter {
  if (activeTab.includes('filter=inbound')) return 'inbound'
  if (activeTab.includes('filter=outbound')) return 'outbound'
  return 'all'
}

const MISSED_DISCONNECT = new Set(['voicemail_reached', 'machine_detected', 'dial_no_answer', 'dial_failed'])

function sentimentBucket(call: {
  sentiment?: CallSentiment | null | string
  disconnect_reason?: string | null
  disposition?: string | null
}): 'positive' | 'neutral' | 'negative' | 'follow_up' {
  // 1. Explicit sentiment value wins
  if (call.sentiment === 'positive') return 'positive'
  if (call.sentiment === 'negative') return 'negative'
  if (call.sentiment === 'follow_up') return 'follow_up'
  if (call.sentiment === 'neutral') return 'neutral'

  // 2. Null/missing: derive from disconnect_reason
  if (call.disconnect_reason && MISSED_DISCONNECT.has(call.disconnect_reason)) return 'follow_up'

  // 3. Derive from disposition
  const disp = call.disposition
  if (disp === 'booked' || disp === 'interested') return 'positive'
  if (disp === 'not_interested' || disp === 'spam') return 'negative'

  return 'neutral'
}

const TOOLTIP_STYLE = {
  background: 'var(--brand-surface)',
  border: '1px solid var(--brand-border)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--brand-text)',
}

export function CallLogsChart() {
  const ctx = useDashboardData()
  const tabState = useTabState()
  const activeTab = tabState?.activeTab ?? '/dashboard/call-logs'
  const filter = getFilter(activeTab)
  const calls = ctx?.calls ?? []

  const chartData = useMemo(() => {
    const map = new Map<string, {
      label: string
      inbound: number
      outbound: number
      positive: number
      neutral: number
      negative: number
      follow_up: number
    }>()

    for (let i = 6; i >= 0; i--) {
      const d = startOfDay(subDays(new Date(), i))
      const key = format(d, 'yyyy-MM-dd')
      map.set(key, { label: format(d, 'EEE'), inbound: 0, outbound: 0, positive: 0, neutral: 0, negative: 0, follow_up: 0 })
    }

    for (const call of calls) {
      try {
        const key = format(parseISO(call.created_at), 'yyyy-MM-dd')
        const point = map.get(key)
        if (!point) continue
        const isOut = call.direction === 'outbound'

        if (filter === 'all') {
          if (isOut) point.outbound++
          else point.inbound++
        } else if (filter === 'inbound' && !isOut) {
          point[sentimentBucket(call)]++
        } else if (filter === 'outbound' && isOut) {
          point[sentimentBucket(call)]++
        }
      } catch {
        // skip malformed timestamps
      }
    }

    return Array.from(map.values())
  }, [calls, filter])

  const tickStyle = { fontSize: 11, fill: 'var(--brand-muted)' } as const
  const axisProps = { axisLine: false, tickLine: false } as const
  const barRadius = [3, 3, 0, 0] as [number, number, number, number]
  const legendStyle = { fontSize: 11, paddingTop: 8 }

  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] px-4 pt-4 pb-2">
      <p className="text-xs font-semibold text-[var(--brand-muted)] mb-3 uppercase tracking-wide">
        {filter === 'all' ? 'Calls this week — Inbound vs Outbound' : filter === 'inbound' ? 'Inbound calls this week — by sentiment' : 'Outbound calls this week — by sentiment'}
      </p>
      <ResponsiveContainer width="100%" height={180}>
        {filter === 'all' ? (
          <BarChart data={chartData} barGap={2} barCategoryGap="35%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--brand-border)" opacity={0.5} vertical={false} />
            <XAxis dataKey="label" tick={tickStyle} {...axisProps} />
            <YAxis tick={tickStyle} {...axisProps} width={24} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--brand-primary)', opacity: 0.05 }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
            <Bar dataKey="inbound" name="Inbound" fill="#4ade80" radius={barRadius} />
            <Bar dataKey="outbound" name="Outbound" fill="#818cf8" radius={barRadius} />
          </BarChart>
        ) : (
          <BarChart data={chartData} barGap={2} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--brand-border)" opacity={0.5} vertical={false} />
            <XAxis dataKey="label" tick={tickStyle} {...axisProps} />
            <YAxis tick={tickStyle} {...axisProps} width={24} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--brand-primary)', opacity: 0.05 }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
            <Bar dataKey="positive" name="Positive" fill="#4ade80" radius={barRadius} />
            <Bar dataKey="neutral" name="Neutral" fill="#60a5fa" radius={barRadius} />
            <Bar dataKey="negative" name="Negative" fill="#fb923c" radius={barRadius} />
            <Bar dataKey="follow_up" name="Needs Follow-up" fill="#f59e0b" radius={barRadius} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
