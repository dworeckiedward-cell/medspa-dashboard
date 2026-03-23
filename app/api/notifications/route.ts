import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'

export interface LiveNotification {
  id: string
  type: 'new_lead' | 'new_booking' | 'payment' | 'ai_handled'
  title: string
  subtitle?: string
  created_at: string
  href: string
}

export async function GET(req: NextRequest) {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createSupabaseServerClient()
  const hours = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get('hours') ?? '24', 10) || 24, 1), 720)
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
  const slug = tenant.slug

  const [leadsRes, bookingsRes, aiRes] = await Promise.all([
    // New leads in last 24h
    supabase
      .from('call_logs')
      .select('id, caller_name, caller_phone, semantic_title, created_at')
      .eq('client_id', tenant.id)
      .eq('is_lead', true)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20),

    // New bookings + payments in last 24h
    supabase
      .from('bookings')
      .select('id, patient_name, payment_status, amount_cents, currency, created_at, updated_at, tenant_services(name)')
      .eq('tenant_id', tenant.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20),

    // AI-handled inbound calls in last 24h
    supabase
      .from('call_logs')
      .select('id, caller_name, caller_phone, duration_seconds, created_at')
      .eq('client_id', tenant.id)
      .eq('direction', 'inbound')
      .gte('duration_seconds', 15)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const items: LiveNotification[] = []

  // New leads
  function isPhone(s: string | null | undefined): boolean {
    if (!s) return false
    return /^[+\d\s\-().]{7,}$/.test(s.trim())
  }
  for (const lead of leadsRes.data ?? []) {
    const rawName = lead.caller_name
    const name = (rawName && !isPhone(rawName)) ? rawName : (lead.caller_phone ?? 'Unknown caller')
    items.push({
      id: `lead-${lead.id}`,
      type: 'new_lead',
      title: `New Lead: ${name}`,
      subtitle: lead.semantic_title ?? undefined,
      created_at: lead.created_at,
      href: `/dashboard/leads?tenant=${slug}`,
    })
  }

  // Bookings + payments
  for (const b of bookingsRes.data ?? []) {
    const svcName = (Array.isArray(b.tenant_services)
      ? (b.tenant_services as { name: string }[])[0]?.name
      : (b.tenant_services as { name: string } | null)?.name) ?? undefined

    if (b.payment_status === 'paid') {
      const amt = b.amount_cents > 0
        ? ` — $${(b.amount_cents / 100).toFixed(0)}`
        : ''
      items.push({
        id: `payment-${b.id}`,
        type: 'payment',
        title: `Payment received: ${b.patient_name}${amt}`,
        subtitle: svcName,
        created_at: b.updated_at ?? b.created_at,
        href: `/dashboard/appointments?tenant=${slug}`,
      })
    } else {
      items.push({
        id: `booking-${b.id}`,
        type: 'new_booking',
        title: `New Booking: ${b.patient_name}`,
        subtitle: svcName,
        created_at: b.created_at,
        href: `/dashboard/appointments?tenant=${slug}`,
      })
    }
  }

  // AI handled calls
  for (const call of aiRes.data ?? []) {
    const name = call.caller_name ?? call.caller_phone ?? 'Unknown'
    const mins = Math.floor((call.duration_seconds ?? 0) / 60)
    const secs = (call.duration_seconds ?? 0) % 60
    const dur = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
    items.push({
      id: `ai-${call.id}`,
      type: 'ai_handled',
      title: `AI Handled: ${name}`,
      subtitle: `${dur} — Inbound`,
      created_at: call.created_at,
      href: `/dashboard/call-logs?tenant=${slug}`,
    })
  }

  // Sort all by created_at desc
  items.sort((a, b) => b.created_at.localeCompare(a.created_at))

  return NextResponse.json({ items: items.slice(0, 100) })
}
