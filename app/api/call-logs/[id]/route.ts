import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'

/**
 * DELETE /api/call-logs/[id]
 * Deletes a call log record, scoped to the authenticated tenant.
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
    .delete()
    .eq('id', params.id)
    .eq('client_id', tenant.id)

  if (error) {
    console.error('[call-logs/delete]', error.message)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
