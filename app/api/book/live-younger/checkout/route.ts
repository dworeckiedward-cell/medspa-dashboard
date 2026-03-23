import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type Stripe from 'stripe'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/server'

const CheckoutSchema = z.object({
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  practitioner: z.string(),
  staffMemberId: z.string().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(9),
  email: z.string().email(),
  notes: z.string().optional(),
  ref: z.string().optional(),
  tenantId: z.string().uuid(),
})

/**
 * POST /api/book/live-younger/checkout
 *
 * Creates booking in DB. If clinic has Stripe Connect:
 *   - Paid service → Stripe Checkout (payment mode) with destination charge
 *   - Free/varies → Stripe Checkout (setup mode) to save card for no-show fee
 * If not connected: saves booking, returns skipPayment=true (collect at clinic).
 *
 * Jane appointment is created AFTER Stripe webhook confirms payment.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = CheckoutSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })

  const data = parsed.data
  const supabase = createSupabaseServerClient()

  // Fetch service
  const { data: service } = await supabase
    .from('tenant_services')
    .select('id, name, price_cents, currency, price_varies, duration_minutes, jane_treatment_id')
    .eq('id', data.serviceId)
    .maybeSingle()
  if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 })

  // Fetch tenant — need Stripe Connect fields
  const { data: tenant } = await supabase
    .from('clients')
    .select('id, stripe_connect_account_id, stripe_connect_onboarded, platform_fee_percent')
    .eq('id', data.tenantId)
    .maybeSingle()
  if (!tenant) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })

  // Link to call log if ref provided
  let callLogId: string | null = null
  if (data.ref) {
    const { data: callLog } = await supabase
      .from('call_logs').select('id')
      .eq('client_id', data.tenantId).eq('external_call_id', data.ref)
      .maybeSingle()
    callLogId = callLog?.id ?? null
  }

  // Create booking record
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      tenant_id: data.tenantId,
      service_id: data.serviceId,
      call_log_id: callLogId,
      patient_name: `${data.firstName} ${data.lastName}`,
      patient_phone: data.phone,
      patient_email: data.email,
      patient_notes: data.notes ?? null,
      appointment_date: data.date,
      appointment_time: data.time,
      practitioner_name: data.practitioner,
      duration_minutes: service.duration_minutes,
      amount_cents: service.price_cents,
      currency: service.currency,
      payment_status: 'pending',
      status: 'pending',
      source: 'ai_booking_page',
    })
    .select('id')
    .single()

  if (bookingError || !booking) {
    console.error('[checkout] Failed to create booking:', bookingError?.message)
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
  }

  // Create a lead record so this person appears in the dashboard call logs
  await supabase.from('call_logs').insert({
    client_id: data.tenantId,
    tenant_id: data.tenantId,
    external_call_id: `booking-${booking.id}`,
    is_lead: true,
    is_booked: true,
    caller_name: `${data.firstName} ${data.lastName}`,
    caller_phone: data.phone,
    call_type: 'booking',
    direction: 'inbound',
    duration_seconds: 0,
    agent_provider: 'booking_page',
    lead_source: 'booking_page',
    semantic_title: `Booked: ${service.name}`,
    potential_revenue: (service.price_cents ?? 0) / 100,
    booked_value: (service.price_cents ?? 0) / 100,
    raw_payload: { bookingId: booking.id, serviceId: data.serviceId, ref: data.ref ?? null },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  const stripe = getStripe()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.servifylabs.com'
  const isFree = service.price_cents === 0 && !service.price_varies
  const isFreeOrVaries = service.price_cents === 0 || service.price_varies
  const platformFeePercent = Number(tenant.platform_fee_percent ?? 5)
  const connectedAccountId = (tenant.stripe_connect_onboarded && tenant.stripe_connect_account_id)
    ? (tenant.stripe_connect_account_id as string)
    : null

  // Free consultations ($0, not price_varies) → skip Stripe, save booking only
  if (isFree) {
    console.info(JSON.stringify({
      level: 'booking_notification',
      to: 'info@liveyounger.ca',
      subject: `New Free Booking — ${data.firstName} ${data.lastName} — ${service.name}`,
      bookingId: booking.id,
    }))
    return NextResponse.json({ bookingId: booking.id, skipPayment: true })
  }

  try {
    if (isFreeOrVaries) {
      // price_varies (e.g. Botox) → setup mode to save card for $50 no-show fee
      const customer = await stripe.customers.create({
        name: `${data.firstName} ${data.lastName}`,
        email: data.email,
        phone: data.phone,
        metadata: { bookingId: booking.id, tenantId: data.tenantId },
      })

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'setup',
        customer: customer.id,
        success_url: `${baseUrl}/book/live-younger/confirmed?booking=${booking.id}`,
        cancel_url: `${baseUrl}/book/live-younger`,
        metadata: { bookingId: booking.id, tenantId: data.tenantId },
      })

      await supabase.from('bookings')
        .update({ stripe_customer_id: customer.id, stripe_session_id: session.id })
        .eq('id', booking.id)

      return NextResponse.json({ checkoutUrl: session.url, bookingId: booking.id })
    } else {
      // Paid service — payment mode
      // If clinic has connected account: destination charge (fee split)
      // If not yet connected: charge platform account directly (temporary)
      const paymentIntentData: Stripe.Checkout.SessionCreateParams.PaymentIntentData = {
        setup_future_usage: 'off_session',
        metadata: { bookingId: booking.id },
        ...(connectedAccountId ? {
          application_fee_amount: Math.round(service.price_cents * (platformFeePercent / 100)),
          transfer_data: { destination: connectedAccountId },
        } : {}),
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        customer_email: data.email,
        line_items: [{
          price_data: {
            currency: service.currency,
            product_data: { name: service.name },
            unit_amount: service.price_cents,
          },
          quantity: 1,
        }],
        payment_intent_data: paymentIntentData,
        success_url: `${baseUrl}/book/live-younger/confirmed?booking=${booking.id}`,
        cancel_url: `${baseUrl}/book/live-younger`,
        metadata: { bookingId: booking.id, tenantId: data.tenantId },
      })

      await supabase.from('bookings')
        .update({ stripe_session_id: session.id })
        .eq('id', booking.id)

      return NextResponse.json({ checkoutUrl: session.url, bookingId: booking.id })
    }
  } catch (err) {
    console.error('[checkout] Stripe error:', err)
    return NextResponse.json({ error: 'Payment setup failed. Please try again.' }, { status: 500 })
  }
}
