import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { phone?: string }
  const phone = body.phone?.trim()

  if (!phone) {
    return NextResponse.json({ error: 'phone is required' }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()

  // 1. Mark lead as lost in call_logs
  const { error: logError } = await supabase
    .from('call_logs')
    .update({ lead_status: 'lost', updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('client_id', tenant.id)

  if (logError) {
    console.error('[leads/dnc] call_logs update error:', logError.message)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  // 2. Set do_not_call in outbound_call_tracker (soft — ignore if row doesn't exist)
  const { error: trackerError } = await supabase
    .from('outbound_call_tracker')
    .update({ do_not_call: true })
    .eq('phone', phone)

  if (trackerError) {
    // Non-fatal — tracker row may not exist for inbound leads
    console.warn('[leads/dnc] outbound_call_tracker update warning:', trackerError.message)
  }

  return NextResponse.json({ ok: true })
}
