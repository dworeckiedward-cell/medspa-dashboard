import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'

const ALLOWED_STATUSES = ['new', 'contacted', 'booking_link_sent', 'clicked_link', 'booked', 'lost', 'followup_needed'] as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { lead_status?: string; human_followup_needed?: boolean }
  const { lead_status, human_followup_needed } = body

  if (lead_status && !ALLOWED_STATUSES.includes(lead_status as typeof ALLOWED_STATUSES[number])) {
    return NextResponse.json({ error: 'Invalid lead_status' }, { status: 400 })
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (lead_status !== undefined) update.lead_status = lead_status
  if (human_followup_needed !== undefined) update.human_followup_needed = human_followup_needed

  const supabase = createSupabaseServerClient()

  const { error } = await supabase
    .from('call_logs')
    .update(update)
    .eq('id', params.id)
    .eq('client_id', tenant.id) // enforce tenant scope

  if (error) {
    console.error('[leads/status] Update error:', error.message)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
