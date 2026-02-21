import { redirect } from 'next/navigation'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { getAllClientOverviews, getAllRecentDeliveryLogs } from '@/lib/ops/query'
import { computeClientHealth, type HealthLevel } from '@/lib/ops/health-score'
import { deriveOpsAlerts } from '@/lib/ops/alerts'
import { logOperatorAction } from '@/lib/ops/audit'
import { OpsKpiStrip } from '@/components/ops/ops-kpi-strip'
import { OpsClientsTable } from '@/components/ops/ops-clients-table'
import { OpsAlertsPanel } from '@/components/ops/ops-alerts-panel'
import { HealthDistributionCard } from '@/components/ops/health-distribution-card'
import type { ClientHealthScore } from '@/lib/ops/health-score'

export const dynamic = 'force-dynamic'

export default async function OpsConsolePage() {
  // ── Access guard ─────────────────────────────────────────────────────────
  const access = await resolveOperatorAccess()

  if (!access.authorized) {
    // Redirect unauthorized users to login
    redirect('/login')
  }

  // ── Audit log ────────────────────────────────────────────────────────────
  await logOperatorAction({
    operatorId: access.userId ?? 'unknown',
    operatorEmail: access.email,
    action: 'ops_console_viewed',
  })

  // ── Data fetch ───────────────────────────────────────────────────────────
  const [overviews, deliveryLogs] = await Promise.all([
    getAllClientOverviews(),
    getAllRecentDeliveryLogs(24, 200),
  ])

  // ── Health scoring ───────────────────────────────────────────────────────
  // Count delivery failures per client for health calculation
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

  return (
    <div className="min-h-screen bg-[var(--brand-bg)]">
      {/* Header */}
      <header className="border-b border-[var(--brand-border)] bg-[var(--brand-surface)] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[var(--brand-text)] tracking-tight">
              Servify Operator Console
            </h1>
            <p className="text-xs text-[var(--brand-muted)] mt-0.5">
              Multi-tenant control tower — {totalClients} active client{totalClients !== 1 ? 's' : ''}
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
        {/* KPI strip */}
        <OpsKpiStrip
          totalClients={totalClients}
          healthyClients={healthyClients}
          criticalClients={criticalClients}
          totalCalls={totalCalls}
          totalBookings={totalBookings}
          totalRevenue={totalRevenue}
        />

        {/* Alerts + Health distribution */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <OpsAlertsPanel alerts={alerts} />
          </div>
          <div>
            <HealthDistributionCard distribution={distribution} total={totalClients} />
          </div>
        </div>

        {/* Clients table */}
        <div>
          <h2 className="text-sm font-semibold text-[var(--brand-text)] mb-3">
            All Clients
          </h2>
          <OpsClientsTable
            overviews={overviews}
            healthScores={new Map(healthScoresArray)}
          />
        </div>
      </div>
    </div>
  )
}
