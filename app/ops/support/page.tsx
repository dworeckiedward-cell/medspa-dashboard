import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { logOperatorAction } from '@/lib/ops/audit'
import { listOpsRequests, getSupportKpiSummary } from '@/lib/support/query'
import { OpsRequestsTable } from '@/components/ops/ops-requests-table'

export const dynamic = 'force-dynamic'

export default async function OpsSupportPage() {
  const access = await resolveOperatorAccess()
  if (!access.authorized) return null // Layout handles unauthorized

  await logOperatorAction({
    operatorId: access.userId ?? 'unknown',
    operatorEmail: access.email,
    action: 'support_requests_viewed',
  })

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
