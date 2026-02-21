/**
 * GET /api/reports/monthly/preview
 *
 * Dev-safe tenant-scoped report payload preview.
 * Returns the executive report data as JSON — no external send,
 * no email, no PDF. Useful for debugging and integration testing.
 *
 * Gated by dev route guard in production (requires ENABLE_DEV_ROUTES=true).
 * Requires authenticated tenant access via resolveTenantAccess.
 */

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
import { guardDevRoute, apiUnauthorized, apiInternalError } from '@/lib/api-utils'
import { log } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET() {
  const blocked = guardDevRoute()
  if (blocked) return blocked

  const { tenant } = await resolveTenantAccess()
  if (!tenant) return apiUnauthorized('Tenant not found or not authenticated')

  try {
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

    log.info('report.preview', { tenantId: tenant.id, totalCalls: roi.totalCalls })

    return Response.json({ payload, formattedText: text })
  } catch (err) {
    log.error('report.preview.failed', { tenantId: tenant.id, error: String(err) })
    return apiInternalError('Failed to generate report preview')
  }
}
