'use client'

import { Users, UserCheck, Target, DollarSign, Wallet, TrendingUp } from 'lucide-react'
import type { PartnerSummary, PayoutSummary } from '@/lib/partners/types'

interface PartnersKpiStripProps {
  summaries: PartnerSummary[]
  payout: PayoutSummary
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function PartnersKpiStrip({ summaries, payout }: PartnersKpiStripProps) {
  const totalPartners = summaries.length
  const activePartners = summaries.filter((s) => s.partner.status === 'active').length
  const totalReferrals = summaries.reduce((s, p) => s + p.referralCount, 0)
  const totalClients = summaries.reduce((s, p) => s + p.clientCount, 0)
  const avgCloseRate =
    totalReferrals > 0 ? Math.round((totalClients / totalReferrals) * 100) : 0

  const kpis = [
    {
      label: 'Total Partners',
      value: totalPartners.toLocaleString(),
      icon: Users,
      color: '#7C3AED',
      sub: `${activePartners} active`,
    },
    {
      label: 'Referrals',
      value: totalReferrals.toLocaleString(),
      icon: Target,
      color: '#2563EB',
      sub: `${totalClients} converted`,
    },
    {
      label: 'Close Rate',
      value: `${avgCloseRate}%`,
      icon: TrendingUp,
      color: '#10B981',
      sub: 'Avg. conversion',
    },
    {
      label: 'Payable',
      value: formatCents(payout.totalPayableCents),
      icon: Wallet,
      color: '#F59E0B',
      sub: `${formatCents(payout.totalApprovedUnpaidCents)} approved`,
    },
    {
      label: 'Total Paid',
      value: formatCents(payout.totalPaidCents),
      icon: DollarSign,
      color: '#10B981',
      sub: 'All time',
    },
    {
      label: 'Held',
      value: formatCents(payout.totalHeldCents),
      icon: UserCheck,
      color: payout.totalHeldCents > 0 ? '#E11D48' : '#6B7280',
      sub: payout.totalHeldCents > 0 ? 'Under review' : 'None held',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {kpis.map((kpi) => {
        const Icon = kpi.icon
        return (
          <div
            key={kpi.label}
            className="relative rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 overflow-hidden"
          >
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                background: `radial-gradient(ellipse at top left, ${kpi.color}, transparent 70%)`,
              }}
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
                  <p className="text-[10px] text-[var(--brand-muted)] mt-1">
                    {kpi.sub}
                  </p>
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
