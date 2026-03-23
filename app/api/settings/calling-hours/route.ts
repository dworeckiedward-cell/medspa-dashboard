import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'

interface CallingHoursBody {
  calling_start?: string
  calling_end?: string
  max_daily?: number
  max_total?: number
}

function isValidTime(t: unknown): t is string {
  return typeof t === 'string' && /^\d{2}:\d{2}$/.test(t)
}

function isValidCount(n: unknown, min: number, max: number): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max
}

export async function PATCH(req: NextRequest) {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json()) as CallingHoursBody

  const patch: Record<string, unknown> = {}
  if (isValidTime(body.calling_start)) patch.calling_start = body.calling_start
  if (isValidTime(body.calling_end)) patch.calling_end = body.calling_end
  if (isValidCount(body.max_daily, 1, 5)) patch.max_daily = body.max_daily
  if (isValidCount(body.max_total, 1, 10)) patch.max_total = body.max_total

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()

  const { error } = await supabase
    .from('clients')
    .update({ features: { ...(tenant.features ?? {}), ...patch } })
    .eq('id', tenant.id)

  if (error) {
    console.error('[settings/calling-hours] Update error:', error.message)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
