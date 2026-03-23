/**
 * PATCH /api/ops/tenants/[tenantId]/patch — Inline update tenant/client fields.
 *
 * Operator-only. Supports partial updates to the `tenants` table.
 * Used by OPS clients table for inline editing (active toggle, status, etc.).
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { logOperatorAction } from '@/lib/ops/audit'

export const dynamic = 'force-dynamic'

const PatchSchema = z.object({
  is_active: z.boolean().optional(),
  ai_enabled: z.boolean().optional(),
  ai_operating_mode: z.enum(['live', 'paused', 'outbound_only', 'inbound_only', 'maintenance']).optional(),
  retell_phone_number: z.string().max(30).nullable().optional(),
  retell_agent_id: z.string().max(200).nullable().optional(),
  timezone: z.string().max(100).optional(),
  client_status: z.enum(['onboarding', 'live', 'watch', 'canceled']).nullable().optional(),
  website_url: z.string().max(500).nullable().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const access = await resolveOperatorAccess()
  if (!access.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { tenantId } = await params
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 })
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

  const updates = parsed.data
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()
  const { error } = await supabase
    .from('tenants')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', tenantId)

  if (error) {
    console.error('[ops] tenant patch error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logOperatorAction({
    operatorId: access.userId ?? 'unknown',
    operatorEmail: access.email,
    action: 'ai_control_updated',
    targetClientId: tenantId,
    metadata: { fields: Object.keys(updates) },
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
