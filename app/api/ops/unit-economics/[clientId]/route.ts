/**
 * /api/ops/unit-economics/[clientId] — ops-only CAC + LTV management.
 *
 * PATCH → upsert unit economics (CAC, LTV, source, notes, date)
 * DELETE → clear CAC data
 *
 * Auth: operator-scoped via resolveOperatorAccess().
 * SECURITY: Never expose to tenant routes.
 *
 * ── Production columns ────────────────────────────────────────────────────
 * cac_usd, ltv_usd, ltv_mode, acquisition_source, acquired_date, notes
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { upsertUnitEconomics, clearUnitEconomics } from '@/lib/ops/unit-economics/mutations'
import { logOperatorAction } from '@/lib/ops/audit'

export const dynamic = 'force-dynamic'

// ── PATCH: upsert unit economics ────────────────────────────────────────────

const PatchSchema = z.object({
  // CAC fields
  cacUsd: z.number().min(0).max(999999).nullable().optional(),
  acquisitionSource: z.enum(['ads', 'outbound', 'referral', 'organic', 'mixed', 'other']).nullable().optional(),
  acquiredDate: z.string().nullable().optional(), // 'YYYY-MM-DD'
  notes: z.string().max(2000).nullable().optional(),

  // LTV override fields
  ltvUsd: z.number().min(0).max(9_999_999).nullable().optional(),
  ltvMode: z.enum(['auto', 'manual']).optional(),

  // Legacy field names (from old dialog) — mapped to new names
  cacAmount: z.number().min(0).max(999999).nullable().optional(),
  cacSource: z.enum(['ads', 'outbound', 'referral', 'organic', 'mixed', 'other']).nullable().optional(),
  cacNotes: z.string().max(2000).nullable().optional(),
  acquiredAt: z.string().nullable().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const access = await resolveOperatorAccess()
  if (!access.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { clientId } = await params
  if (!clientId) {
    return NextResponse.json({ error: 'Client ID required' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  console.info('[ops] Unit economics PATCH', { clientId, userId: access.userId, payload: body })

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    const details = parsed.error.flatten()
    console.error('[ops] Unit economics validation failed:', details)
    return NextResponse.json(
      { error: 'Validation failed', details },
      { status: 422 },
    )
  }

  const d = parsed.data

  // Map legacy field names → production column names
  const payload = {
    cacUsd: d.cacUsd ?? d.cacAmount,
    ltvUsd: d.ltvUsd,
    ltvMode: d.ltvMode,
    acquisitionSource: d.acquisitionSource ?? d.cacSource,
    acquiredDate: d.acquiredDate ?? (d.acquiredAt ? d.acquiredAt.split('T')[0] : undefined),
    notes: d.notes ?? d.cacNotes,
  }

  const result = await upsertUnitEconomics(clientId, payload)

  if (result.error) {
    console.error('[ops] Unit economics upsert failed:', { clientId, error: result.error })
    return NextResponse.json(
      { error: `Failed to save: ${result.error}` },
      { status: 500 },
    )
  }

  await logOperatorAction({
    operatorId: access.userId ?? 'unknown',
    operatorEmail: access.email,
    action: 'cac_updated',
    targetClientId: clientId,
    metadata: { cacUsd: payload.cacUsd, ltvUsd: payload.ltvUsd },
  })

  return NextResponse.json({ ok: true, data: result.data })
}

// ── DELETE: clear CAC ───────────────────────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const access = await resolveOperatorAccess()
  if (!access.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { clientId } = await params
  if (!clientId) {
    return NextResponse.json({ error: 'Client ID required' }, { status: 400 })
  }

  console.info('[ops] Unit economics DELETE', { clientId, userId: access.userId })

  const success = await clearUnitEconomics(clientId)

  if (!success) {
    return NextResponse.json({ error: 'Failed to clear data' }, { status: 500 })
  }

  await logOperatorAction({
    operatorId: access.userId ?? 'unknown',
    operatorEmail: access.email,
    action: 'cac_cleared',
    targetClientId: clientId,
  })

  return NextResponse.json({ ok: true })
}
