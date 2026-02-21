/**
 * PATCH  /api/integrations/[id]  — update fields on an integration
 * DELETE /api/integrations/[id]  — delete an integration connection
 *
 * Tenant scoping is enforced in the mutation helpers — both operations
 * include `.eq('client_id', tenantId)` so cross-tenant writes are impossible.
 *
 * SECURITY: If config is sent in a PATCH, secrets_masked is rebuilt automatically.
 * Raw secrets are never returned in the response.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import {
  updateClientIntegration,
  deleteClientIntegration,
} from '@/lib/integrations/crm/config-mutations'

// ── Schemas ────────────────────────────────────────────────────────────────────

const PatchSchema = z.object({
  name:           z.string().min(1).max(120).optional(),
  config:         z.record(z.unknown()).optional(),
  isEnabled:      z.boolean().optional(),
  status:         z.enum(['connected', 'disconnected', 'error', 'testing']).optional(),
  eventToggles:   z.record(z.boolean()).optional(),
  eventMapping:   z.record(z.string()).optional(),
})

// ── Handlers ───────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const { id } = params
  if (!id) {
    return NextResponse.json({ error: 'Missing integration id' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  try {
    const integration = await updateClientIntegration(tenant.id, id, parsed.data)
    return NextResponse.json({ integration })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const { id } = params
  if (!id) {
    return NextResponse.json({ error: 'Missing integration id' }, { status: 400 })
  }

  try {
    await deleteClientIntegration(tenant.id, id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
