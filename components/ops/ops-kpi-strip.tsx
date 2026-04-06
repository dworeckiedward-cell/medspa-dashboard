'use client'

/**
 * OpsKpiStrip — compact 4-card KPI row for the ops overview.
 *
 * Active Clients | Active MRR | Bookings | Total Revenue
 */

import {
  Building2,
  TrendingUp,
  CalendarCheck,
  DollarSign,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { formatMoneyCompact } from '@/lib/ops-financials/format'
import { useOpsCurrency } from '@/components/ops/ops-currency-toggle'

interface OpsKpi {
  label: string
  value: string
  icon: React.ElementType
  color: string
  sub?: string
}

export interface OpsKpiStripProps {
  totalClients: number
  totalCalls: number
  totalBookings: number
  totalLtv: number
  activeMrr?: number
  collectedThisMonth?: number
}

export function OpsKpiStrip({
  totalClients,
  totalBookings,
  totalLtv,
  activeMrr,
}: OpsKpiStripProps) {
  const { currency, rate } = useOpsCurrency()

  const kpis: OpsKpi[] = [
    {
      label: 'Active Clients',
      value: totalClients.toLocaleString(),
      icon: Building2,
      color: '#2563EB',
      sub: `${totalClients} active`,
    },
    {
      label: 'Active MRR',
      value: formatMoneyCompact(activeMrr != null ? activeMrr * rate : null),
      icon: TrendingUp,
      color: '#10B981',
      sub: `Monthly recurring (${currency})`,
    },
    {
      label: 'Bookings',
      value: totalBookings.toLocaleString(),
      icon: CalendarCheck,
      color: '#F59E0B',
      sub: 'Last 30 days',
    },
    {
      label: 'Total Revenue',
      value: formatCurrency(totalLtv * rate, currency),
      icon: DollarSign,
      color: '#F59E0B',
      sub: `Lifetime collected (${currency})`,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => {
        const Icon = kpi.icon
        return (
          <div
            key={kpi.label}
            className="relative rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5 overflow-hidden"
          >
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{ background: `radial-gradient(ellipse at top left, ${kpi.color}, transparent 70%)` }}
            />
            <div className="relative flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-[var(--brand-muted)] uppercase tracking-wider mb-1">
                  {kpi.label}
                </p>
                <p className="text-2xl font-semibold tracking-tight text-[var(--brand-text)] tabular-nums leading-none">
                  {kpi.value}
                </p>
                {kpi.sub && (
                  <p className="text-[10px] text-[var(--brand-muted)] mt-1 truncate">{kpi.sub}</p>
                )}
              </div>
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{ background: `${kpi.color}15`, color: kpi.color }}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
