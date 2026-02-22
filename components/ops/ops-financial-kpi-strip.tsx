'use client'

import { DollarSign, TrendingUp, AlertTriangle, Receipt, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMoneyCompact, formatRatio } from '@/lib/ops-financials/format'
import type { OpsFinancialKpis } from '@/lib/ops-financials/types'

interface OpsFinancialKpiStripProps {
  kpis: OpsFinancialKpis
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  iconColor,
  valueColor,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
  iconColor: string
  valueColor?: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] px-4 py-3 min-w-[160px]">
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', iconColor)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className={cn('text-sm font-semibold tabular-nums', valueColor ?? 'text-[var(--brand-text)]')}>
          {value}
        </p>
        <p className="text-[10px] text-[var(--brand-muted)] leading-tight">{label}</p>
        {sub && <p className="text-[10px] text-[var(--brand-muted)]">{sub}</p>}
      </div>
    </div>
  )
}

export function OpsFinancialKpiStrip({ kpis }: OpsFinancialKpiStripProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-[var(--brand-muted)]" />
        <h2 className="text-sm font-semibold text-[var(--brand-text)]">Financial Overview</h2>
        <span className="text-[10px] rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 font-medium">
          Ops Only
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        <KpiCard
          icon={DollarSign}
          label="Active MRR"
          value={formatMoneyCompact(kpis.activeMrr)}
          sub={`${kpis.mrrClientCount} clients`}
          iconColor="bg-emerald-500/10 text-emerald-500"
        />
        <KpiCard
          icon={Receipt}
          label="Collected This Month"
          value={formatMoneyCompact(kpis.collectedThisMonth)}
          iconColor="bg-blue-500/10 text-blue-500"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Overdue Retainers"
          value={String(kpis.overdueRetainerCount)}
          iconColor="bg-red-500/10 text-red-500"
          valueColor={kpis.overdueRetainerCount > 0 ? 'text-red-600 dark:text-red-400' : undefined}
        />
        <KpiCard
          icon={Receipt}
          label="Unpaid Setup Fees"
          value={String(kpis.unpaidSetupFeeCount)}
          iconColor="bg-amber-500/10 text-amber-500"
          valueColor={kpis.unpaidSetupFeeCount > 0 ? 'text-amber-600 dark:text-amber-400' : undefined}
        />
        <KpiCard
          icon={TrendingUp}
          label="Avg LTV:CAC"
          value={formatRatio(kpis.avgLtvCacRatio)}
          sub={kpis.clientsWithBothCount > 0 ? `${kpis.clientsWithBothCount} clients` : undefined}
          iconColor="bg-violet-500/10 text-violet-500"
        />
      </div>
    </div>
  )
}
