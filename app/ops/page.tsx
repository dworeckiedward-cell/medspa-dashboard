import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { OpsUnauthorized } from '@/components/shared/ops-unauthorized'
import { getAllClientOverviews, getAllRecentDeliveryLogs } from '@/lib/ops/query'
import { computeClientHealth, type HealthLevel } from '@/lib/ops/health-score'
import { deriveOpsAlerts } from '@/lib/ops/alerts'
import { logOperatorAction } from '@/lib/ops/audit'
import { listOpsRequests, getSupportKpiSummary } from '@/lib/support/query'
import { getOpsNotifications, countUnreadNotifications } from '@/lib/ops/notifications'
import { OpsKpiStrip } from '@/components/ops/ops-kpi-strip'
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
import { OpsRevenueChart } from '@/components/ops/ops-revenue-chart'
import { ServifyLogo } from '@/components/branding/servify-logo'
import { getAllClientUnitEconomics } from '@/lib/ops/unit-economics/query'
import { buildCohortRows, buildCacSourceRows } from '@/lib/ops/unit-economics/cohorts'
import { getAllCommercialSnapshots } from '@/lib/ops-financials/query'
import { computeOpsFinancialKpis } from '@/lib/ops-financials/compute'
import type { ClientHealthScore } from '@/lib/ops/health-score'

export const dynamic = 'force-dynamic'

export default async function OpsConsolePage() {
  // ── Access guard ─────────────────────────────────────────────────────────
  const access = await resolveOperatorAccess()

  if (!access.authorized) {
    return <OpsUnauthorized email={access.email} reason={access.reason} />
  }

  // ── Audit log ────────────────────────────────────────────────────────────
  await logOperatorAction({
    operatorId: access.userId ?? 'unknown',
    operatorEmail: access.email,
    action: 'ops_console_viewed',
  })

  // ── Data fetch ───────────────────────────────────────────────────────────
  const [overviews, deliveryLogs, unitEconomics, recentRequests, supportKpi, notifications, unreadCount] = await Promise.all([
    getAllClientOverviews(),
    getAllRecentDeliveryLogs(24, 200),
    getAllClientUnitEconomics(),
    listOpsRequests({ status: ['open', 'acknowledged', 'in_progress', 'waiting_for_client', 'reopened'], limit: 5 }),
    getSupportKpiSummary(),
    getOpsNotifications(15, true),
    countUnreadNotifications(),
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
    totalCalls += overview.callStats.totalCalls
    totalBookings += overview.callStats.bookedCalls
    totalRevenue += overview.callStats.totalRevenue
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

  return (
    <div className="min-h-screen bg-[var(--brand-bg)]">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-[var(--brand-border)] bg-[var(--brand-surface)] px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm border border-gray-100">
              <ServifyLogo size="md" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--brand-text)] tracking-tight">
                Servify OS
              </h1>
              <p className="text-[11px] text-[var(--brand-muted)] mt-0.5">
                Operator Console — {totalClients} active client{totalClients !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--brand-muted)]">
              {access.email ?? 'Operator'}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 font-medium">
              {access.grantedVia === 'dev_mode' ? 'Dev Mode' : 'Admin'}
            </span>
            <OpsHeaderActions
              notifications={notifications}
              unreadCount={unreadCount}
            />
          </div>
        </div>
      </header>

      {/* ── Content with sidebar ────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex gap-6">
        <OpsSidebarNav email={access.email} />

        <div className="min-w-0 flex-1 space-y-4 sm:space-y-6">
          {/* 1. KPI strip */}
          <section id="overview">
            <OpsKpiStrip
              totalClients={totalClients}
              healthyClients={healthyClients}
              criticalClients={criticalClients}
              totalCalls={totalCalls}
              totalBookings={totalBookings}
              totalRevenue={totalRevenue}
              activeMrr={financialKpis.activeMrr}
              collectedThisMonth={financialKpis.collectedThisMonth}
            />
          </section>

          {/* 2. Revenue Chart */}
          <OpsRevenueChart
            activeMrr={financialKpis.activeMrr}
            collectedThisMonth={financialKpis.collectedThisMonth}
          />

          {/* 3. Triage Row — Alerts + Support Inbox */}
          <section id="alerts">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <OpsAlertsPanel alerts={alerts} />
              </div>
              <div id="support">
                <OpsSupportInboxCard requests={recentRequests} kpi={supportKpi} />
              </div>
            </div>
          </section>

          {/* 4. All Clients table */}
          <section id="clients">
            <h2 className="text-sm font-semibold text-[var(--brand-text)] mb-3">
              All Clients
            </h2>
            <OpsClientsTable
              overviews={overviews}
              healthScores={new Map(healthScoresArray)}
              unitEconomics={unitEconomics}
              commercialSnapshots={commercialSnapshots}
            />
          </section>

          {/* 5. Usage + Health distribution */}
          <section id="usage">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <OpsUsageWatchlist />
              </div>
              <div>
                <HealthDistributionCard distribution={distribution} total={totalClients} />
              </div>
            </div>
          </section>

          {/* 6. AI Control Watchlist */}
          <OpsAiControlWatchlist />

          {/* 7. Financial Overview KPIs */}
          <section id="financials">
            <OpsFinancialKpiStrip kpis={financialKpis} />
          </section>

          {/* 8. Unit Economics — CAC by Source + Acquisition Cohorts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CacSourceSummaryCard rows={cacSourceRows} />
            <AcquisitionCohortsCard rows={cohortRows} />
          </div>

          {/* 9. Quick links */}
          <section id="partners">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <a
                href="/ops/alerts"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-4 py-2 text-sm font-medium text-[var(--brand-text)] hover:border-rose-400/50 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>
                Alerts Console
              </a>
              <a
                href="/ops/requests"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-4 py-2 text-sm font-medium text-[var(--brand-text)] hover:border-blue-400/50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                Support Requests
              </a>
              <a
                href="/ops/partners"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-4 py-2 text-sm font-medium text-[var(--brand-text)] hover:border-violet-400/50 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                </svg>
                Partner Console
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
