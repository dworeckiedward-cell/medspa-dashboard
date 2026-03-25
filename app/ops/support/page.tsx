import { listOpsRequests, getSupportKpiSummary } from '@/lib/support/query'
import { OpsRequestsTable } from '@/components/ops/ops-requests-table'

export const dynamic = 'force-dynamic'

export default async function OpsSupportPage() {
  // Auth is handled by the shared layout.

  const [requests, kpi] = await Promise.all([
    listOpsRequests({ limit: 100 }),
    getSupportKpiSummary(),
  ])

  return (
    <div className="space-y-5">
      <OpsRequestsTable requests={requests} kpi={kpi} />
    </div>
  )
}
