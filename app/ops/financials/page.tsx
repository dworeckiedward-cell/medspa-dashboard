import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { getAllClientOverviews } from '@/lib/ops/query'
import { logOperatorAction } from '@/lib/ops/audit'
import { OpsFinancialKpiStrip } from '@/components/ops/ops-financial-kpi-strip'
import { CacSourceSummaryCard } from '@/components/ops/cac-source-summary-card'
import { AcquisitionCohortsCard } from '@/components/ops/acquisition-cohorts-card'
import { getAllClientUnitEconomics } from '@/lib/ops/unit-economics/query'
import { buildCohortRows, buildCacSourceRows } from '@/lib/ops/unit-economics/cohorts'
import { getAllCommercialSnapshots } from '@/lib/ops-financials/query'
import { computeOpsFinancialKpis } from '@/lib/ops-financials/compute'

export const dynamic = 'force-dynamic'

export default async function OpsFinancialsPage() {
  const access = await resolveOperatorAccess()
  if (!access.authorized) return null // Layout handles unauthorized

  // ── Data fetch ──────────────────────────────────────────────────────────
  const [overviews, unitEconomics] = await Promise.all([
    getAllClientOverviews(),
    getAllClientUnitEconomics(),
    logOperatorAction({
      operatorId: access.userId ?? 'unknown',
      operatorEmail: access.email,
      action: 'ops_console_viewed',
    }),
  ])

  // ── Unit economics aggregations ─────────────────────────────────────────
  const cohortRows = buildCohortRows(unitEconomics)
  const cacSourceRows = buildCacSourceRows(unitEconomics)

  // ── Financial snapshots + KPIs ──────────────────────────────────────────
  const clients = overviews.map((o) => o.client)
  const commercialSnapshots = await getAllCommercialSnapshots(clients, unitEconomics)
  const financialKpis = computeOpsFinancialKpis(commercialSnapshots)

  return (
    <div className="space-y-5">
      {/* Financial Overview KPIs */}
      <OpsFinancialKpiStrip kpis={financialKpis} />

      {/* Unit Economics — CAC by Source + Acquisition Cohorts */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <CacSourceSummaryCard rows={cacSourceRows} />
        <AcquisitionCohortsCard rows={cohortRows} />
      </div>
    </div>
  )
}
