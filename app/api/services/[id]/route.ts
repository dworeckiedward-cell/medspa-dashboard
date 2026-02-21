/**
 * PATCH  /api/services/[id]  — update fields on a service
 * DELETE /api/services/[id]  — soft-delete (deactivate) a service
 *
 * Tenant scoping is enforced in the mutation helpers — both operations
 * include `.eq('client_id', tenantId)` so cross-tenant writes are impossible.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import {
  updateClientService,
  deactivateClientService,
  reorderClientService,
} from '@/lib/dashboard/services-mutations'

// ── Schemas ────────────────────────────────────────────────────────────────────

const PatchSchema = z.object({
  name:        z.string().min(1).max(120).optional(),
  category:    z.string().max(80).nullable().optional(),
  priceCents:  z.number().int().nonnegative().nullable().optional(),
  currency:    z.string().length(3).optional(),
  durationMin: z.number().int().positive().nullable().optional(),
  sortOrder:   z.number().int().nonnegative().optional(),
  isActive:    z.boolean().optional(),
  /** Convenience: move the service up or down in sort_order (swaps with neighbour). */
  reorder:     z.enum(['up', 'down']).optional(),
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
    return NextResponse.json({ error: 'Missing service id' }, { status: 400 })
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
    const { reorder, ...rest } = parsed.data

    // Reorder is a separate operation — doesn't need the full patch path
    if (reorder) {
      await reorderClientService(tenant.id, id, reorder)
      return NextResponse.json({ success: true })
    }

    const service = await updateClientService(tenant.id, id, rest)
    return NextResponse.json({ service })
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
    return NextResponse.json({ error: 'Missing service id' }, { status: 400 })
  }

  try {
    await deactivateClientService(tenant.id, id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
