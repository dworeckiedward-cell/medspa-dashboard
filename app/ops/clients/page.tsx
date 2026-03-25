import { getAllClientOverviews, getAllRecentDeliveryLogs } from '@/lib/ops/query'
import { computeClientHealth } from '@/lib/ops/health-score'
import { OpsClientsTable } from '@/components/ops/ops-clients-table'
import { getAllClientUnitEconomics } from '@/lib/ops/unit-economics/query'
import { getAllCommercialSnapshots } from '@/lib/ops-financials/query'
import type { ClientHealthScore } from '@/lib/ops/health-score'
import { cn, polish } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function OpsClientsPage() {
  // Auth is handled by the shared layout.

  // ── Data fetch ──────────────────────────────────────────────────────────
  const [overviews, deliveryLogs, unitEconomics] = await Promise.all([
    getAllClientOverviews(),
    getAllRecentDeliveryLogs(24, 200),
    getAllClientUnitEconomics(),
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

  // Serialize health scores for client components
  const healthScoresArray: Array<[string, ClientHealthScore]> = Array.from(healthScores.entries())

  // ── Commercial snapshots for table ───────────────────────────────────────
  const clients = overviews.map((o) => o.client)
  const commercialSnapshots = await getAllCommercialSnapshots(clients, unitEconomics)

  return (
    <div className="space-y-5">
      <h2 className={cn(polish.sectionTitle, 'mb-3')}>All Clients</h2>
      <OpsClientsTable
        overviews={overviews}
        healthScores={new Map(healthScoresArray)}
        unitEconomics={unitEconomics}
        commercialSnapshots={commercialSnapshots}
      />
    </div>
  )
}
