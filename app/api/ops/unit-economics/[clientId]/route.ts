/**
 * /api/ops/unit-economics/[clientId] — ops-only CAC management.
 *
 * PATCH → upsert CAC data for a specific client
 * DELETE → clear CAC data for a specific client
 *
 * Auth: operator-scoped via resolveOperatorAccess().
 * SECURITY: Never expose to tenant routes.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { upsertClientCac, clearClientCac } from '@/lib/ops/unit-economics/mutations'
import { logOperatorAction } from '@/lib/ops/audit'

// ── PATCH: upsert CAC ──────────────────────────────────────────────────────

const PatchSchema = z.object({
  cacAmount: z.number().min(0).max(999999).nullable(),
  cacCurrency: z.string().min(3).max(3).optional(),
  cacSource: z.enum(['ads', 'outbound', 'referral', 'organic', 'mixed', 'other']).nullable().optional(),
  cacNotes: z.string().max(500).nullable().optional(),
  acquiredAt: z.string().nullable().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: { clientId: string } },
) {
  const access = await resolveOperatorAccess()
  if (!access.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { clientId } = params
  if (!clientId) {
    return NextResponse.json({ error: 'Client ID required' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const result = await upsertClientCac(clientId, parsed.data)

  if (!result) {
    return NextResponse.json({ error: 'Failed to save CAC data' }, { status: 500 })
  }

  // Audit log
  await logOperatorAction({
    operatorId: access.userId ?? 'unknown',
    operatorEmail: access.email,
    action: 'cac_updated',
    targetClientId: clientId,
    metadata: {
      cacAmount: parsed.data.cacAmount,
      cacSource: parsed.data.cacSource,
    },
  })

  return NextResponse.json({ success: true, data: result })
}

// ── DELETE: clear CAC ───────────────────────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: { clientId: string } },
) {
  const access = await resolveOperatorAccess()
  if (!access.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { clientId } = params
  if (!clientId) {
    return NextResponse.json({ error: 'Client ID required' }, { status: 400 })
  }

  const success = await clearClientCac(clientId)

  if (!success) {
    return NextResponse.json({ error: 'Failed to clear CAC data' }, { status: 500 })
  }

  await logOperatorAction({
    operatorId: access.userId ?? 'unknown',
    operatorEmail: access.email,
    action: 'cac_cleared',
    targetClientId: clientId,
  })

  return NextResponse.json({ success: true })
}
