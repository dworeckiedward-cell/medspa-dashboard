/**
 * PATCH /api/tenant/timezone — update timezone for the resolved tenant.
 * Tenant-scoped via resolveTenantAccess.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const PatchSchema = z.object({
  timezone: z.string().min(1).max(100),
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

  const supabase = createSupabaseServerClient()
  const { error } = await supabase
    .from('tenants')
    .update({ timezone: parsed.data.timezone })
    .eq('id', tenant.id)

  if (error) {
    console.error('[tenant/timezone] update error:', error.message)
    return NextResponse.json({ error: 'Failed to update timezone' }, { status: 500 })
  }

  return NextResponse.json({ success: true, timezone: parsed.data.timezone })
}
