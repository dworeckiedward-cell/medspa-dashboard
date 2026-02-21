import { redirect } from 'next/navigation'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { logOperatorAction } from '@/lib/ops/audit'
import { listPartners, listReferrals, listCommissions, buildPartnerSummaries, computePayoutSummary } from '@/lib/partners/query'
import { PartnersKpiStrip } from '@/components/partners/partners-kpi-strip'
import { PartnersTable } from '@/components/partners/partners-table'
import { PayoutReadinessCard } from '@/components/partners/payout-readiness-card'

export const dynamic = 'force-dynamic'

export default async function PartnersConsolePage() {
  // ── Access guard ─────────────────────────────────────────────────────────
  const access = await resolveOperatorAccess()

  if (!access.authorized) {
    redirect('/login')
  }

  // ── Audit log ────────────────────────────────────────────────────────────
  await logOperatorAction({
    operatorId: access.userId ?? 'unknown',
    operatorEmail: access.email,
    action: 'partners_console_viewed',
  })

  // ── Data fetch ─────────────────────────────────────────────────────────
  const [partners, referrals, commissions] = await Promise.all([
    listPartners(),
    listReferrals(),
    listCommissions(),
  ])

  // ── Aggregation (pure computation) ──────────────────────────────────────
  const summaries = buildPartnerSummaries(partners, referrals, commissions)
  const payout = computePayoutSummary(commissions)

  return (
    <div className="min-h-screen bg-[var(--brand-bg)]">
      {/* Header */}
      <header className="border-b border-[var(--brand-border)] bg-[var(--brand-surface)] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[var(--brand-text)] tracking-tight">
              Partner Console
            </h1>
            <p className="text-xs text-[var(--brand-muted)] mt-0.5">
              Affiliate & referral program management — {partners.length} partner{partners.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/ops"
              className="text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
            >
              ← Back to Ops
            </a>
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
        {/* KPI strip */}
        <PartnersKpiStrip summaries={summaries} payout={payout} />

        {/* Payout overview + partners table */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <h2 className="text-sm font-semibold text-[var(--brand-text)] mb-3">
              All Partners
            </h2>
            <PartnersTable summaries={summaries} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--brand-text)] mb-3">
              Payout Overview
            </h2>
            <PayoutReadinessCard payout={payout} />
          </div>
        </div>
      </div>
    </div>
  )
}
