/**
 * /api/branding — tenant branding updates (logo URL).
 *
 * PATCH: Update logo_url for the resolved tenant.
 * Tenant-scoped via resolveTenantAccess.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { updateClientLogoUrl } from '@/lib/dashboard/branding-mutations'

const PatchSchema = z.object({
  logoUrl: z
    .string()
    .url('Must be a valid URL')
    .nullable(),
})

export async function PATCH(req: Request) {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const result = await updateClientLogoUrl(tenant.id, parsed.data.logoUrl)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true, logoUrl: parsed.data.logoUrl })
}
