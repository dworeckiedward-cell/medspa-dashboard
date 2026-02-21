/**
 * GET  /api/services  — list all services for the resolved tenant
 * POST /api/services  — create a new service
 *
 * Tenant resolved from x-tenant-slug header (set by middleware) or Supabase Auth.
 * All writes enforce client_id scoping via the services-mutations helpers.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { listClientServices } from '@/lib/dashboard/services-query'
import { createClientService } from '@/lib/dashboard/services-mutations'

// ── Schemas ────────────────────────────────────────────────────────────────────

const CreateSchema = z.object({
  name:        z.string().min(1).max(120),
  category:    z.string().max(80).nullable().optional(),
  priceCents:  z.number().int().nonnegative().nullable().optional(),
  currency:    z.string().length(3).optional(),
  durationMin: z.number().int().positive().nullable().optional(),
  sortOrder:   z.number().int().nonnegative().optional(),
})

// ── Handlers ───────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const services = await listClientServices(tenant.id)
  return NextResponse.json({ services })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  try {
    const service = await createClientService(tenant.id, parsed.data)
    return NextResponse.json({ service }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
