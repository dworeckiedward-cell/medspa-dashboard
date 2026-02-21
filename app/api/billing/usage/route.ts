/**
 * /api/billing/usage — GET tenant-scoped usage summary.
 *
 * Tenant-scoped via resolveTenantAccess().
 * Returns current billing period usage with allowance, status, and overage preview.
 */

import { NextResponse } from 'next/server'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { getTenantUsageSummary } from '@/lib/billing/usage-query'
import { buildBillingUsageSnapshot, buildOveragePreview } from '@/lib/billing/usage'

export async function GET() {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const summary = await getTenantUsageSummary(tenant.id)
  const snapshot = buildBillingUsageSnapshot(summary)
  const overagePreview = buildOveragePreview(summary.allowances)

  return NextResponse.json({
    summary,
    snapshot,
    overagePreview: overagePreview.hasOverage ? overagePreview : null,
  })
}
