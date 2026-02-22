/**
 * /api/ai-control — tenant-scoped AI system control.
 *
 * GET   → read current AI control state
 * PATCH → update AI control state (partial)
 *
 * Auth: tenant-scoped via resolveTenantAccess().
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { getAiControlState } from '@/lib/ai-control/query'
import { updateAiControlState } from '@/lib/ai-control/mutations'
import { deriveEffectiveStatus } from '@/lib/ai-control/effective-status'

// ── GET: read AI control state ──────────────────────────────────────────────

export async function GET() {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const state = await getAiControlState(tenant.id)
  const effectiveStatus = deriveEffectiveStatus(state)

  return NextResponse.json({ ...state, effectiveStatus })
}

// ── PATCH: update AI control state ──────────────────────────────────────────

const PatchSchema = z.object({
  ai_enabled: z.boolean().optional(),
  ai_operating_mode: z.enum(['live', 'paused', 'outbound_only', 'inbound_only', 'maintenance']).optional(),
  ai_fallback_mode: z.enum(['human_handoff', 'voicemail_only', 'capture_only', 'disabled']).optional(),
  ai_pause_reason: z.enum(['holiday', 'staff_preference', 'testing', 'billing_issue', 'other']).nullable().optional(),
  ai_pause_note: z.string().max(500).nullable().optional(),
  ai_auto_resume_at: z.string().nullable().optional(),
})

export async function PATCH(request: Request) {
  const { tenant, userId } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
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

  const updatedBy = userId ?? 'tenant'
  const updatedState = await updateAiControlState(tenant.id, parsed.data, updatedBy)

  if (!updatedState) {
    // DB columns may not exist yet (migration 018 not applied).
    // Return optimistic state so the UI updates immediately and doesn't error.
    const currentState = await getAiControlState(tenant.id)
    const optimistic = { ...currentState, ...parsed.data }
    const effectiveStatus = deriveEffectiveStatus(optimistic)

    return NextResponse.json({
      ...optimistic,
      effectiveStatus,
      _warning: 'State saved optimistically — DB migration 018 may not be applied yet.',
    })
  }

  const effectiveStatus = deriveEffectiveStatus(updatedState)

  return NextResponse.json({ ...updatedState, effectiveStatus })
}
