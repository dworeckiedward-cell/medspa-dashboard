import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { OpsUnauthorized } from '@/components/shared/ops-unauthorized'
import { getAllClientOverviews, getAllRecentDeliveryLogs } from '@/lib/ops/query'
import { computeClientHealth, type HealthLevel } from '@/lib/ops/health-score'
import { deriveOpsAlerts } from '@/lib/ops/alerts'
import { logOperatorAction } from '@/lib/ops/audit'
import { listOpsRequests, getSupportKpiSummary } from '@/lib/support/query'
import { getOpsNotifications, countUnreadNotifications } from '@/lib/ops/notifications'
import { computeOpsOverviewMetrics, OPS_RANGE_OPTIONS, type OpsChartPoint } from '@/lib/ops/ops-overview-metrics'
import { OpsKpiStrip } from '@/components/ops/ops-kpi-strip'
import { OpsHeroChart } from '@/components/ops/ops-hero-chart'
import { OpsNeedsAttention } from '@/components/ops/ops-needs-attention'
import { OpsClientsTable } from '@/components/ops/ops-clients-table'
import { OpsAlertsPanel } from '@/components/ops/ops-alerts-panel'
import { OpsSupportInboxCard } from '@/components/ops/ops-support-inbox-card'
import { OpsHeaderActions } from '@/components/ops/ops-header-actions'
import { HealthDistributionCard } from '@/components/ops/health-distribution-card'
import { OpsUsageWatchlist } from '@/components/ops/ops-usage-watchlist'
import { OpsAiControlWatchlist } from '@/components/ops/ops-ai-control-watchlist'
import { CacSourceSummaryCard } from '@/components/ops/cac-source-summary-card'
import { AcquisitionCohortsCard } from '@/components/ops/acquisition-cohorts-card'
import { OpsFinancialKpiStrip } from '@/components/ops/ops-financial-kpi-strip'
import { OpsSidebarNav } from '@/components/ops/ops-sidebar-nav'
import { ServifyLogo } from '@/components/branding/servify-logo'
import { getAllClientUnitEconomics } from '@/lib/ops/unit-economics/query'
import { buildCohortRows, buildCacSourceRows } from '@/lib/ops/unit-economics/cohorts'
import { getAllCommercialSnapshots } from '@/lib/ops-financials/query'
import { computeOpsFinancialKpis } from '@/lib/ops-financials/compute'
import type { ClientHealthScore } from '@/lib/ops/health-score'
import { cn, polish } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function OpsConsolePage() {
  // ── Access guard ─────────────────────────────────────────────────────────
  const access = await resolveOperatorAccess()

  if (!access.authorized) {
    return <OpsUnauthorized email={access.email} reason={access.reason} />
  }

  // ── Data fetch + audit log run in parallel ────────────────────────────────
  const [overviews, deliveryLogs, unitEconomics, recentRequests, supportKpi, notifications, unreadCount] = await Promise.all([
    getAllClientOverviews(),
    getAllRecentDeliveryLogs(24, 200),
    getAllClientUnitEconomics(),
    listOpsRequests({ status: ['open', 'acknowledged', 'in_progress', 'waiting_for_client', 'reopened'], limit: 5 }),
    getSupportKpiSummary(),
    getOpsNotifications(15, true),
    countUnreadNotifications(),
    // Audit write runs concurrently — result unused, errors swallowed inside logOperatorAction
    logOperatorAction({
      operatorId: access.userId ?? 'unknown',
      operatorEmail: access.email,
      action: 'ops_console_viewed',
    }),
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

    // KPI stats scoped to active clients only
    if (overview.client.is_active) {
      totalCalls += overview.callStats.totalCalls
      totalBookings += overview.callStats.bookedCalls
      totalRevenue += overview.callStats.totalRevenue
    }
  }

  // ── Alerts ───────────────────────────────────────────────────────────────
  const alerts = deriveOpsAlerts({
    overviews,
    healthScores,
    deliveryLogs,
  })

  // Serialize health scores for client components
  const healthScoresArray: Array<[string, ClientHealthScore]> = Array.from(healthScores.entries())

  // ── Unit economics aggregations ────────────────────────────────────────────
  const cohortRows = buildCohortRows(unitEconomics)
  const cacSourceRows = buildCacSourceRows(unitEconomics)

  // ── Financial snapshots + KPIs ─────────────────────────────────────────────
  const clients = overviews.map((o) => o.client)
  const commercialSnapshots = await getAllCommercialSnapshots(clients, unitEconomics)
  const financialKpis = computeOpsFinancialKpis(commercialSnapshots)

  // ── Total LTV (cumulative, active clients only) ───────────────────────────
  const activeClientIds = new Set(overviews.filter((o) => o.client.is_active).map((o) => o.client.id))
  const totalLtv = unitEconomics
    .filter((u) => activeClientIds.has(u.clientId))
    .reduce((sum, u) => sum + u.totalCollectedLtv, 0)

  // ── Chart series (all ranges, for client-side switching) ─────────────────
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
  const chartIsEstimated = true

  // ── Inactive client count (no calls in 30d, onboarding complete) ────────
  const inactiveClients = overviews.filter((o) => {
    const health = healthScores.get(o.client.id)
    return o.callStats.totalCalls === 0 && o.onboardingComplete && health?.level !== 'onboarding'
  }).length

  const criticalAlertCount = alerts.filter((a) => a.severity === 'critical').length
  const openRequestCount = recentRequests.length

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 h-14 flex items-center border-b border-[#1e1e2e] bg-[#0a0a0f]/90 backdrop-blur-xl px-4 sm:px-6">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#6366f1]/10 border border-[#6366f1]/30 shrink-0">
              <ServifyLogo size="md" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-bold text-[#f0f0f5] tracking-tight">Servify OS</span>
              <span className="text-[#71717a] text-[13px]">·</span>
              <span className="text-[12px] text-[#71717a]">
                {activeClients} active client{activeClients !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="hidden sm:inline text-[11px] text-[#71717a]">
              {access.email ?? 'Operator'}
            </span>
            <div className="hidden sm:block h-4 w-px bg-[#1e1e2e]" />
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#6366f1]/15 text-[#818cf8] font-medium border border-[#6366f1]/20">
              {access.grantedVia === 'dev_mode' ? 'Dev Mode' : 'Admin'}
            </span>
            <OpsHeaderActions
              notifications={notifications}
              unreadCount={unreadCount}
              clinics={overviews.map((o) => ({
                id: o.client.id,
                name: o.client.name,
                slug: o.client.slug,
                brand_color: o.client.brand_color,
              }))}
            />
          </div>
        </div>
      </header>

      {/* ── Content with sidebar ────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-7 flex gap-6">
        <OpsSidebarNav email={access.email} />

        <div className="min-w-0 flex-1 space-y-5">
          {/* ═══════════════ ABOVE THE FOLD ═══════════════ */}

          {/* 1. KPI strip — 6 focused cards */}
          <section id="overview">
            <OpsKpiStrip
              totalClients={activeClients}
              healthyClients={healthyClients}
              criticalClients={criticalClients}
              totalCalls={totalCalls}
              totalBookings={totalBookings}
              totalLtv={totalLtv}
              activeMrr={financialKpis.activeMrr}
              collectedThisMonth={financialKpis.collectedThisMonth}
            />
          </section>

          {/* 2. Hero Chart — 3 views, 5 ranges */}
          <OpsHeroChart
            seriesByRange={chartSeriesByRange}
            isEstimated={chartIsEstimated}
          />

          {/* 3. Needs Attention — compact triage panel */}
          <OpsNeedsAttention
            criticalAlerts={criticalAlertCount}
            openRequests={openRequestCount}
            inactiveClients={inactiveClients}
          />

          {/* ═══════════════ BELOW THE FOLD ═══════════════ */}

          {/* 4. Triage Row — Alerts + Support Inbox */}
          <section id="alerts">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <OpsAlertsPanel alerts={alerts} />
              </div>
              <div id="support">
                <OpsSupportInboxCard requests={recentRequests} kpi={supportKpi} />
              </div>
            </div>
          </section>

          {/* 5. All Clients table */}
          <section id="clients">
            <h2 className={cn(polish.sectionTitle, 'mb-3')}>All Clients</h2>
            <OpsClientsTable
              overviews={overviews}
              healthScores={new Map(healthScoresArray)}
              unitEconomics={unitEconomics}
              commercialSnapshots={commercialSnapshots}
            />
          </section>

          {/* 6. Usage + Health distribution */}
          <section id="usage">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <OpsUsageWatchlist />
              </div>
              <div>
                <HealthDistributionCard distribution={distribution} total={totalClients} />
              </div>
            </div>
          </section>

          {/* 7. AI Control Watchlist */}
          <OpsAiControlWatchlist />

          {/* 8. Financial Overview KPIs */}
          <section id="financials">
            <OpsFinancialKpiStrip kpis={financialKpis} />
          </section>

          {/* 9. Unit Economics — CAC by Source + Acquisition Cohorts */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <CacSourceSummaryCard rows={cacSourceRows} />
            <AcquisitionCohortsCard rows={cohortRows} />
          </div>
        </div>
      </div>
    </div>
  )
}
