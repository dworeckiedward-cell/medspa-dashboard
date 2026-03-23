import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'

const ALLOWED_STATUSES = ['confirmed', 'completed', 'cancelled', 'no_show'] as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { status } = await req.json() as { status?: string }
  if (!status || !ALLOWED_STATUSES.includes(status as typeof ALLOWED_STATUSES[number])) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()

  const { error } = await supabase
    .from('bookings')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('tenant_id', tenant.id) // ensure tenant ownership

  if (error) {
    console.error('[bookings/status] Update error:', error.message)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
