'use client'

import { Building2, HeartPulse, AlertTriangle, Phone, CalendarCheck, DollarSign, TrendingUp, Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { formatMoneyCompact } from '@/lib/ops-financials/format'

interface OpsKpi {
  label: string
  value: string
  icon: React.ElementType
  color: string
  sub?: string
}

interface OpsKpiStripProps {
  totalClients: number
  healthyClients: number
  criticalClients: number
  totalCalls: number
  totalBookings: number
  totalRevenue: number
  activeMrr?: number
  collectedThisMonth?: number
}

export function OpsKpiStrip({
  totalClients,
  healthyClients,
  criticalClients,
  totalCalls,
  totalBookings,
  totalRevenue,
  activeMrr,
  collectedThisMonth,
}: OpsKpiStripProps) {
  const kpis: OpsKpi[] = [
    {
      label: 'Active Clients',
      value: totalClients.toLocaleString(),
      icon: Building2,
      color: '#2563EB',
      sub: `${healthyClients} healthy`,
    },
    {
      label: 'Active MRR',
      value: formatMoneyCompact(activeMrr ?? null),
      icon: TrendingUp,
      color: '#10B981',
      sub: 'Monthly recurring',
    },
    {
      label: 'Collected',
      value: formatMoneyCompact(collectedThisMonth ?? null),
      icon: Receipt,
      color: '#3B82F6',
      sub: 'This month',
    },
    {
      label: 'Critical',
      value: criticalClients.toLocaleString(),
      icon: AlertTriangle,
      color: criticalClients > 0 ? '#E11D48' : '#10B981',
      sub: criticalClients > 0 ? 'Needs attention' : 'All clear',
    },
    {
      label: 'Total Calls',
      value: totalCalls.toLocaleString(),
      icon: Phone,
      color: '#7C3AED',
      sub: 'Last 30 days',
    },
    {
      label: 'Bookings',
      value: totalBookings.toLocaleString(),
      icon: CalendarCheck,
      color: '#F59E0B',
      sub: 'Last 30 days',
    },
    {
      label: 'Call Revenue',
      value: formatCurrency(totalRevenue, 'USD'),
      icon: DollarSign,
      color: '#F59E0B',
      sub: 'AI-estimated from calls',
    },
    {
      label: 'Avg Health',
      value: totalClients > 0 ? `${Math.round((healthyClients / totalClients) * 100)}%` : '—',
      icon: HeartPulse,
      color: '#06B6D4',
      sub: 'Healthy rate',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8">
      {kpis.map((kpi) => {
        const Icon = kpi.icon
        return (
          <div
            key={kpi.label}
            className="relative rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 overflow-hidden"
          >
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{ background: `radial-gradient(ellipse at top left, ${kpi.color}, transparent 70%)` }}
            />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-[10px] font-medium text-[var(--brand-muted)] uppercase tracking-wider mb-1.5">
                  {kpi.label}
                </p>
                <p className="text-xl font-bold text-[var(--brand-text)] tabular-nums leading-none">
                  {kpi.value}
                </p>
                {kpi.sub && (
                  <p className="text-[10px] text-[var(--brand-muted)] mt-1">{kpi.sub}</p>
                )}
              </div>
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: `${kpi.color}18`, color: kpi.color }}
              >
                <Icon className="h-4 w-4" />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
