import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'

/**
 * DELETE /api/leads/[id]/delete
 *
 * Marks a call_log as not-a-lead by setting is_lead = false.
 * The underlying call record is preserved for audit / metrics.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createSupabaseServerClient()

  const { error } = await supabase
    .from('call_logs')
    .update({ is_lead: false, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('client_id', tenant.id) // enforce tenant scope

  if (error) {
    console.error('[leads/delete]', error.message)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
