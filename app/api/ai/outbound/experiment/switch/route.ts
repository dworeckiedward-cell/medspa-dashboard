/**
 * POST /api/ai/outbound/experiment/switch
 *
 * Switch the active A/B variant stored in tenant JSON.
 * Does NOT push anything to Retell — operator must manually copy the prompt.
 *
 * Body: { activeVariant: 'A' | 'B', variantA_prompt?: string, variantB_prompt?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { updateExperiment } from '@/lib/ai/agent-optimization/store'
import { apiBadRequest, apiUnauthorized, apiInternalError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) return apiUnauthorized('Tenant not found')

  let body: { activeVariant?: string; variantA_prompt?: string; variantB_prompt?: string }
  try {
    body = await request.json()
  } catch {
    return apiBadRequest('Invalid JSON body')
  }

  if (body.activeVariant !== 'A' && body.activeVariant !== 'B') {
    return apiBadRequest('activeVariant must be "A" or "B"')
  }

  try {
    await updateExperiment(tenant.id, {
      active_variant: body.activeVariant,
      ...(body.variantA_prompt !== undefined ? { variantA_prompt: body.variantA_prompt } : {}),
      ...(body.variantB_prompt !== undefined ? { variantB_prompt: body.variantB_prompt } : {}),
      last_switched_at: new Date().toISOString(),
    })
    return NextResponse.json({ ok: true, active_variant: body.activeVariant })
  } catch (err) {
    console.error('[ai/outbound/experiment/switch] Error:', err)
    return apiInternalError('Failed to update experiment')
  }
}
