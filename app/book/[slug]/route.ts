import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * GET /book/:slug — Booking link redirect with click tracking.
 *
 * Flow:
 *   1. Resolve tenant by slug
 *   2. Log a "booking_link_clicked" event in call_logs
 *   3. Redirect to tenant's booking URL (e.g. Jane App)
 *
 * Query params forwarded:
 *   ?utm_source, ?ref, ?phone — for attribution
 *
 * If no booking URL configured, shows a fallback message.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const supabase = createSupabaseServerClient()

  // Resolve tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, website_url, n8n_webhook_url')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (!tenant) {
    return new NextResponse('Booking page not found', { status: 404 })
  }

  // Look for booking_url in tenant config — fallback to website_url
  // Convention: tenants can store booking_url in a config column or we derive it
  const bookingUrl = tenant.website_url
    ? `${tenant.website_url.replace(/\/$/, '')}/book`
    : null

  if (!bookingUrl) {
    return new NextResponse(
      `<html><body style="font-family:system-ui;text-align:center;padding:60px">
        <h2>Book with ${tenant.name}</h2>
        <p>Please call us directly to schedule your appointment.</p>
      </body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } },
    )
  }

  // Log the click as a call_log entry for tracking
  const sp = request.nextUrl.searchParams
  const phone = sp.get('phone')
  const source = sp.get('utm_source') ?? sp.get('ref') ?? 'booking_link'

  await supabase.from('call_logs').insert({
    client_id: tenant.id,
    external_call_id: `booking-click-${Date.now()}`,
    call_type: 'booking',
    direction: 'inbound',
    duration_seconds: 0,
    is_booked: false,
    is_lead: true,
    lead_source: source,
    caller_phone: phone,
    agent_provider: 'booking_link',
    semantic_title: 'Booking link clicked',
    potential_revenue: 0,
    booked_value: 0,
    inquiries_value: 0,
    raw_payload: {
      type: 'booking_link_clicked',
      slug,
      query: Object.fromEntries(sp.entries()),
      timestamp: new Date().toISOString(),
    },
  })

  // Forward query params to booking URL
  const targetUrl = new URL(bookingUrl)
  sp.forEach((val, key) => {
    targetUrl.searchParams.set(key, val)
  })

  return NextResponse.redirect(targetUrl.toString(), 302)
}
