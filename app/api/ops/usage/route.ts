/**
 * /api/ops/usage — GET cross-tenant usage overview for operator console.
 *
 * Protected by operator access guard.
 * Returns usage summaries for all tenants, sorted by usage percent (highest first).
 */

import { NextResponse } from 'next/server'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { getAllTenantUsageOverviews } from '@/lib/billing/usage-query'

export async function GET(request: Request) {
  const access = await resolveOperatorAccess()
  if (!access.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const url = new URL(request.url)
  const minPercent = parseInt(url.searchParams.get('minPercent') ?? '0', 10)
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10)

  const overviews = await getAllTenantUsageOverviews()

  // Filter by minimum usage percent and sort highest first
  const filtered = overviews
    .filter((o) => {
      const primary = o.summary.allowances[0]
      return primary ? primary.usagePercent >= minPercent : false
    })
    .sort((a, b) => {
      const aPercent = a.summary.allowances[0]?.usagePercent ?? 0
      const bPercent = b.summary.allowances[0]?.usagePercent ?? 0
      return bPercent - aPercent
    })
    .slice(0, limit)

  // Summary stats
  const nearLimit = overviews.filter((o) => {
    const p = o.summary.allowances[0]?.usagePercent ?? 0
    return p >= 80 && p < 100
  }).length

  const overLimit = overviews.filter((o) => {
    const p = o.summary.allowances[0]?.usagePercent ?? 0
    return p >= 100
  }).length

  return NextResponse.json({
    overviews: filtered,
    stats: {
      totalTenants: overviews.length,
      nearLimit,
      overLimit,
    },
  })
}
