import { redirect, notFound } from 'next/navigation'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { logOperatorAction } from '@/lib/ops/audit'
import {
  getPartner,
  listReferrals,
  listCommissions,
  buildPartnerSummaries,
  computePayoutSummary,
} from '@/lib/partners/query'
import { PartnerDetailHeader } from '@/components/partners/partner-detail-header'
import { PartnerReferralsTable } from '@/components/partners/partner-referrals-table'
import { PartnerCommissionLedger } from '@/components/partners/partner-commission-ledger'
import { PayoutReadinessCard } from '@/components/partners/payout-readiness-card'

export const dynamic = 'force-dynamic'

interface PartnerDetailPageProps {
  params: Promise<{ partnerId: string }>
}

export default async function PartnerDetailPage({ params }: PartnerDetailPageProps) {
  const { partnerId } = await params

  // ── Access guard ─────────────────────────────────────────────────────────
  const access = await resolveOperatorAccess()
  if (!access.authorized) {
    redirect('/login')
  }

  // ── Data fetch ─────────────────────────────────────────────────────────
  const partner = await getPartner(partnerId)
  if (!partner) {
    notFound()
  }

  const [referrals, commissions] = await Promise.all([
    listReferrals(partnerId),
    listCommissions(partnerId),
  ])

  // ── Audit log ────────────────────────────────────────────────────────────
  await logOperatorAction({
    operatorId: access.userId ?? 'unknown',
    operatorEmail: access.email,
    action: 'partner_detail_viewed',
    metadata: { partnerId, partnerName: partner.name },
  })

  // ── Aggregation ─────────────────────────────────────────────────────────
  const [summary] = buildPartnerSummaries([partner], referrals, commissions)
  const payout = computePayoutSummary(commissions)

  return (
    <div className="min-h-screen bg-[var(--brand-bg)]">
      {/* Header */}
      <header className="border-b border-[var(--brand-border)] bg-[var(--brand-surface)] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[var(--brand-text)] tracking-tight">
              Partner Detail
            </h1>
            <p className="text-xs text-[var(--brand-muted)] mt-0.5">
              {partner.name} — {partner.type}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--brand-muted)]">
              {access.email ?? 'Operator'}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 font-medium">
              {access.grantedVia === 'dev_mode' ? 'Dev Mode' : 'Admin'}
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Partner header card */}
        <PartnerDetailHeader summary={summary} />

        {/* Referrals + Payout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-sm font-semibold text-[var(--brand-text)]">
              Referrals ({referrals.length})
            </h2>
            <PartnerReferralsTable referrals={referrals} />
          </div>
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-[var(--brand-text)]">
              Payout Status
            </h2>
            <PayoutReadinessCard payout={payout} partner={partner} />
          </div>
        </div>

        {/* Commission Ledger */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--brand-text)]">
            Commission Ledger ({commissions.length})
          </h2>
          <PartnerCommissionLedger commissions={commissions} />
        </div>
      </div>
    </div>
  )
}
