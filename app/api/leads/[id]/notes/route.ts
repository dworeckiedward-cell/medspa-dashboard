import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { notes?: string }
  const notes = typeof body.notes === 'string' ? body.notes : ''

  const supabase = createSupabaseServerClient()

  const { error } = await supabase
    .from('call_logs')
    .update({ notes, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('client_id', tenant.id)

  if (error) {
    console.error('[leads/notes] Update error:', error.message)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
