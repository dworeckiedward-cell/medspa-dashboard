/**
 * /api/ops/requests — cross-tenant support request queue.
 *
 * GET → list all support requests across tenants (operator-scoped).
 *
 * Auth: operator-scoped via resolveOperatorAccess().
 */

import { NextResponse, type NextRequest } from 'next/server'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { listOpsRequests, getSupportKpiSummary } from '@/lib/support/query'
import type { RequestStatus, RequestPriority } from '@/lib/support/types'

export async function GET(request: NextRequest) {
  const { authorized } = await resolveOperatorAccess()
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const params = request.nextUrl.searchParams
  const status = params.get('status')
  const priority = params.get('priority') as RequestPriority | null
  const search = params.get('search') ?? undefined
  const limit = Math.min(parseInt(params.get('limit') ?? '50'), 100)
  const offset = parseInt(params.get('offset') ?? '0')
  const includeKpi = params.get('kpi') === 'true'

  const statusArr = status
    ? (status.split(',') as RequestStatus[])
    : undefined

  const [requests, kpi] = await Promise.all([
    listOpsRequests({ status: statusArr, priority: priority ?? undefined, search, limit, offset }),
    includeKpi ? getSupportKpiSummary() : Promise.resolve(null),
  ])

  return NextResponse.json({
    requests,
    total: requests.length,
    ...(kpi ? { kpi } : {}),
  })
}
