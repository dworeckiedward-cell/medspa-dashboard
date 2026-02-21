/**
 * GET /api/reports/monthly/preview
 *
 * Dev-safe tenant-scoped report payload preview.
 * Returns the executive report data as JSON — no external send,
 * no email, no PDF. Useful for debugging and integration testing.
 *
 * Requires authenticated tenant access via resolveTenantAccess.
 */

import { NextResponse } from 'next/server'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { getCallLogs } from '@/lib/dashboard/metrics'
import { listActiveClientServices } from '@/lib/dashboard/services-query'
import {
  computeRoiSummary,
  computeMissedCallRecovery,
  filterLogsToWindow,
} from '@/lib/dashboard/roi-proof'
import { computeConversionFunnel } from '@/lib/dashboard/conversion-metrics'
import { buildReportPayload, formatReportAsText } from '@/lib/dashboard/report-export'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { tenant } = await resolveTenantAccess()

  if (!tenant) {
    return NextResponse.json(
      { error: 'Tenant not found or not authenticated' },
      { status: 401 },
    )
  }

  const [{ data: callLogs }, services] = await Promise.all([
    getCallLogs(tenant.id, { limit: 500 }),
    listActiveClientServices(tenant.id),
  ])

  const windowLogs = filterLogsToWindow(callLogs, 30)
  const roi = computeRoiSummary(windowLogs, services, 'Last 30 days')
  const recovery = computeMissedCallRecovery(windowLogs)
  const funnel = computeConversionFunnel(windowLogs)

  const payload = buildReportPayload({
    tenantName: tenant.name,
    roi,
    recovery,
    funnel,
    currency: tenant.currency,
  })

  const text = formatReportAsText(payload)

  return NextResponse.json({
    payload,
    formattedText: text,
  })
}
