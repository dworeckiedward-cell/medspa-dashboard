import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'

const DAILY_LIMIT = 20
const N8N_WEBHOOK = 'https://webhook.xce.pl/webhook/live-younger/manual-call-batch'

interface CallBatchBody {
  lead_ids?: unknown
}

export async function POST(req: NextRequest) {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json()) as CallBatchBody
  const rawIds = body.lead_ids

  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    return NextResponse.json({ error: 'lead_ids must be a non-empty array' }, { status: 400 })
  }

  const leadIds = rawIds.filter((id): id is string => typeof id === 'string').slice(0, DAILY_LIMIT)

  const supabase = createSupabaseServerClient()
  const features = (tenant.features ?? {}) as Record<string, unknown>

  // Check daily limit
  const today = new Date().toISOString().slice(0, 10)
  const lastDate = typeof features.manual_calls_date === 'string' ? features.manual_calls_date : ''
  const usedToday = lastDate === today ? (typeof features.manual_calls_today === 'number' ? features.manual_calls_today : 0) : 0
  const remaining = DAILY_LIMIT - usedToday

  if (remaining <= 0) {
    return NextResponse.json({ error: 'Daily manual call limit reached', remaining_today: 0 }, { status: 429 })
  }

  // Filter out DNC leads
  const { data: dncRows } = await supabase
    .from('outbound_call_tracker')
    .select('call_log_id')
    .eq('client_id', tenant.id)
    .eq('do_not_call', true)
    .in('call_log_id', leadIds)

  const dncSet = new Set((dncRows ?? []).map((r: { call_log_id: string }) => r.call_log_id))
  const eligible = leadIds.filter((id) => !dncSet.has(id)).slice(0, remaining)

  if (eligible.length === 0) {
    return NextResponse.json({ error: 'All selected leads are on the DNC list', remaining_today: remaining }, { status: 422 })
  }

  // POST to n8n
  try {
    await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenant.id, tenant_slug: tenant.slug, lead_ids: eligible }),
    })
  } catch (err) {
    console.error('[call-batch] n8n webhook error:', err)
    return NextResponse.json({ error: 'Failed to queue calls' }, { status: 502 })
  }

  // Update daily counter
  const newUsed = usedToday + eligible.length
  await supabase
    .from('clients')
    .update({ features: { ...features, manual_calls_today: newUsed, manual_calls_date: today } })
    .eq('id', tenant.id)

  return NextResponse.json({
    success: true,
    count: eligible.length,
    remaining_today: DAILY_LIMIT - newUsed,
  })
}

export async function GET() {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const features = (tenant.features ?? {}) as Record<string, unknown>
  const today = new Date().toISOString().slice(0, 10)
  const lastDate = typeof features.manual_calls_date === 'string' ? features.manual_calls_date : ''
  const usedToday = lastDate === today ? (typeof features.manual_calls_today === 'number' ? features.manual_calls_today : 0) : 0

  return NextResponse.json({ used_today: usedToday, remaining_today: DAILY_LIMIT - usedToday, limit: DAILY_LIMIT })
}
