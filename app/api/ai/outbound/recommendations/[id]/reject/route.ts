/**
 * POST /api/ai/outbound/recommendations/[id]/reject
 *
 * Set recommendation status to 'rejected'.
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { updateRecommendation } from '@/lib/ai/agent-optimization/store'
import { apiUnauthorized, apiInternalError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) return apiUnauthorized('Tenant not found')

  try {
    const updated = await updateRecommendation(tenant.id, params.id, {
      status: 'rejected',
    })
    return NextResponse.json({ recommendation: updated })
  } catch (err) {
    console.error('[ai/outbound/recommendations/reject] Error:', err)
    return apiInternalError('Failed to reject recommendation')
  }
}
