import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createSupabaseServerClient()

  const { error } = await supabase
    .from('call_logs')
    .update({ is_lead: true, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('client_id', tenant.id)

  if (error) {
    console.error('[call-logs/mark-lead]', error.message)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
