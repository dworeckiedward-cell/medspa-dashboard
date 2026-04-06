import { getAllClientOverviews, getAllRecentDeliveryLogs } from '@/lib/ops/query'
import { computeClientHealth, type HealthLevel } from '@/lib/ops/health-score'
import { deriveOpsAlerts } from '@/lib/ops/alerts'
import { listOpsRequests } from '@/lib/support/query'
import { computeOpsOverviewMetrics, OPS_RANGE_OPTIONS, type OpsChartPoint } from '@/lib/ops/ops-overview-metrics'
import { OpsKpiStrip } from '@/components/ops/ops-kpi-strip'
import { OpsHeroChart } from '@/components/ops/ops-hero-chart'
import { OpsNeedsAttention } from '@/components/ops/ops-needs-attention'
import { HealthDistributionCard } from '@/components/ops/health-distribution-card'
import { getAllClientUnitEconomics } from '@/lib/ops/unit-economics/query'
import { getAllCommercialSnapshots } from '@/lib/ops-financials/query'
import { computeOpsFinancialKpis } from '@/lib/ops-financials/compute'
import type { ClientHealthScore } from '@/lib/ops/health-score'

export const dynamic = 'force-dynamic'

export default async function OpsOverviewPage() {
  // Auth is handled by the shared layout — no need to check again here.

  // ── Data fetch ──────────────────────────────────────────────────────────
  const [overviews, deliveryLogs, unitEconomics, recentRequests] = await Promise.all([
    getAllClientOverviews(),
    getAllRecentDeliveryLogs(24, 200),
    getAllClientUnitEconomics(),
    listOpsRequests({ status: ['open', 'acknowledged', 'in_progress', 'waiting_for_client', 'reopened'], limit: 5 }),
  ])

  // ── Health scoring ───────────────────────────────────────────────────────
  const failuresByClient = new Map<string, number>()
  for (const log of deliveryLogs) {
    if (!log.success) {
      failuresByClient.set(
        log.client_id,
        (failuresByClient.get(log.client_id) ?? 0) + 1,
      )
    }
  }

  const healthScores = new Map<string, ClientHealthScore>()
  for (const overview of overviews) {
    const score = computeClientHealth(overview, {
      failedDeliveries24h: failuresByClient.get(overview.client.id) ?? 0,
    })
    healthScores.set(overview.client.id, score)
  }

  // ── Aggregate KPIs ───────────────────────────────────────────────────────
  const totalClients = overviews.length
  const activeClients = overviews.filter((o) => o.client.is_active).length
  let healthyClients = 0
  let criticalClients = 0
  let totalCalls = 0
  let totalBookings = 0
  let totalRevenue = 0

  const distribution: Record<HealthLevel, number> = {
    healthy: 0,
    watch: 0,
    critical: 0,
    onboarding: 0,
  }

  for (const overview of overviews) {
    const health = healthScores.get(overview.client.id)
    if (health) {
      distribution[health.level]++
      if (health.level === 'healthy') healthyClients++
      if (health.level === 'critical') criticalClients++
    }

    if (overview.client.is_active) {
      totalCalls += overview.callStats.totalCalls
      totalBookings += overview.callStats.bookedCalls
      totalRevenue += overview.callStats.totalRevenue
    }
  }

  // ── Alerts (for needs-attention counts) ──────────────────────────────────
  const alerts = deriveOpsAlerts({
    overviews,
    healthScores,
    deliveryLogs,
  })

  // ── Financial KPIs (for MRR in chart + KPI strip) ───────────────────────
  const clients = overviews.map((o) => o.client)
  const commercialSnapshots = await getAllCommercialSnapshots(clients, unitEconomics)
  const financialKpis = computeOpsFinancialKpis(commercialSnapshots)

  // ── Total LTV ───────────────────────────────────────────────────────────
  const activeClientIds = new Set(overviews.filter((o) => o.client.is_active).map((o) => o.client.id))
  const totalLtv = unitEconomics
    .filter((u) => activeClientIds.has(u.clientId))
    .reduce((sum, u) => {
      const ltv = u.ltvMode === 'manual' && u.manualLtvUsd != null ? u.manualLtvUsd : u.totalCollectedLtv
      return sum + ltv
    }, 0)

  // ── Chart series ────────────────────────────────────────────────────────
  const chartBaseOpts = {
    totalClients: activeClients,
    healthyClients,
    criticalClients,
    totalCalls,
    totalBookings,
    totalRevenue,
    activeMrr: financialKpis.activeMrr,
    healthScores,
    unitEconomics,
  }
  const chartSeriesByRange: Record<number, OpsChartPoint[]> = {}
  for (const r of OPS_RANGE_OPTIONS) {
    chartSeriesByRange[r] = computeOpsOverviewMetrics({ ...chartBaseOpts, rangeDays: r }).series
  }

  // ── Needs attention counts ──────────────────────────────────────────────
  const inactiveClients = overviews.filter((o) => {
    const health = healthScores.get(o.client.id)
    return o.callStats.totalCalls === 0 && o.onboardingComplete && health?.level !== 'onboarding'
  }).length

  const criticalAlertCount = alerts.filter((a) => a.severity === 'critical').length
  const openRequestCount = recentRequests.length

  return (
    <div className="space-y-5">
      {/* 1. KPI strip */}
      <OpsKpiStrip
        totalClients={activeClients}
        totalCalls={totalCalls}
        totalBookings={totalBookings}
        totalLtv={totalLtv}
        activeMrr={financialKpis.activeMrr}
        collectedThisMonth={financialKpis.collectedThisMonth}
      />

      {/* 2. Hero Chart */}
      <OpsHeroChart
        seriesByRange={chartSeriesByRange}
        isEstimated={true}
      />

      {/* 3. Needs Attention */}
      <OpsNeedsAttention
        criticalAlerts={criticalAlertCount}
        openRequests={openRequestCount}
        inactiveClients={inactiveClients}
      />

      {/* 4. Health Distribution */}
      <HealthDistributionCard distribution={distribution} total={totalClients} />
    </div>
  )
}
