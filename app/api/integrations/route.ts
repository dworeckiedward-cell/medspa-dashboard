/**
 * GET  /api/integrations  — list all integrations for the resolved tenant
 * POST /api/integrations  — create a new integration connection
 *
 * Tenant resolved from x-tenant-slug header (set by middleware) or Supabase Auth.
 * All writes enforce client_id scoping via the config-mutations helpers.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { listClientIntegrations } from '@/lib/integrations/crm/config-query'
import { createClientIntegration } from '@/lib/integrations/crm/config-mutations'

// ── Schemas ────────────────────────────────────────────────────────────────────

const CreateSchema = z.object({
  provider:     z.enum(['custom_webhook', 'hubspot', 'ghl']),
  name:         z.string().min(1).max(120),
  config:       z.record(z.unknown()),
  eventToggles: z.record(z.boolean()).optional(),
  eventMapping: z.record(z.string()).optional(),
})

// ── Handlers ───────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const integrations = await listClientIntegrations(tenant.id)
  return NextResponse.json({ integrations })
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
    const integration = await createClientIntegration(tenant.id, parsed.data)
    return NextResponse.json({ integration }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
