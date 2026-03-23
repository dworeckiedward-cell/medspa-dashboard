import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/server'
import { JaneClient } from '@/lib/jane/client'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = headers().get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret || !sig) {
    return NextResponse.json({ error: 'Missing webhook config' }, { status: 400 })
  }

  const stripe = getStripe()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error('[stripe-webhook] Signature failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    if (session.metadata?.type === 'ai_budget_topup') {
      await handleAiBudgetTopUp(session).catch(err =>
        console.error('[stripe-webhook] handleAiBudgetTopUp error:', err)
      )
    } else {
      await handleCheckoutCompleted(session).catch(err =>
        console.error('[stripe-webhook] handleCheckoutCompleted error:', err)
      )
    }
  }

  return NextResponse.json({ received: true })
}

async function handleAiBudgetTopUp(session: Stripe.Checkout.Session) {
  const tenantId = session.metadata?.tenantId
  if (!tenantId) return

  const supabase = createSupabaseServerClient()

  // Increment monthly_ai_budget_cents by $50 = 5000 cents
  const { data: client } = await supabase
    .from('clients')
    .select('monthly_ai_budget_cents')
    .eq('id', tenantId)
    .single()

  const currentBudget = (client as { monthly_ai_budget_cents?: number } | null)?.monthly_ai_budget_cents ?? 10000
  const newBudget = currentBudget + 5000

  await supabase
    .from('clients')
    .update({ monthly_ai_budget_cents: newBudget, updated_at: new Date().toISOString() })
    .eq('id', tenantId)

  // Also persist stripe_customer_id if not yet stored
  if (session.customer && typeof session.customer === 'string') {
    await supabase
      .from('clients')
      .update({ stripe_customer_id: session.customer })
      .eq('id', tenantId)
      .is('stripe_customer_id', null)
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const bookingId = session.metadata?.bookingId
  if (!bookingId) return

  const supabase = createSupabaseServerClient()
  const stripe = getStripe()

  const update: Record<string, unknown> = {
    stripe_session_id: session.id,
    stripe_customer_id: session.customer as string | null,
    updated_at: new Date().toISOString(),
  }

  if (session.mode === 'payment') {
    update.payment_status = 'paid'
    update.stripe_payment_intent_id = session.payment_intent as string

    if (session.payment_intent) {
      try {
        const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string)
        if (pi.payment_method) update.stripe_payment_method_id = pi.payment_method as string
      } catch { /* non-fatal */ }
    }
  } else if (session.mode === 'setup') {
    update.payment_status = 'card_saved'
    if (session.setup_intent) {
      try {
        const si = await stripe.setupIntents.retrieve(session.setup_intent as string)
        if (si.payment_method) update.stripe_payment_method_id = si.payment_method as string
      } catch { /* non-fatal */ }
    }
  }

  const { data: booking } = await supabase
    .from('bookings')
    .update(update)
    .eq('id', bookingId)
    .select('tenant_id, patient_name, patient_phone, patient_email, service_id, appointment_date, appointment_time')
    .single()

  if (!booking) return

  // Create Jane appointment (non-fatal)
  try {
    const jane = new JaneClient(booking.tenant_id)
    const nameParts = (booking.patient_name as string ?? '').split(' ')
    const firstName = nameParts[0] ?? ''
    const lastName = nameParts.slice(1).join(' ') ?? ''

    let patient = await jane.findPatient(booking.patient_phone as string)
    if (!patient) {
      patient = await jane.createPatient(firstName, lastName, booking.patient_phone ?? '', booking.patient_email ?? '')
    }
    if (patient) {
      await jane.createAppointment(
        patient.id,
        booking.service_id ?? '',
        '',
        booking.appointment_date,
        booking.appointment_time,
      )
    }
  } catch (err) {
    console.error('[stripe-webhook] Jane error (non-fatal):', err)
  }
}
