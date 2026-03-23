import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/server'

export async function POST(req: NextRequest) {
  const { bookingId } = await req.json() as { bookingId?: string }
  if (!bookingId) return NextResponse.json({ error: 'bookingId required' }, { status: 400 })

  const supabase = createSupabaseServerClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, tenant_id, patient_name, stripe_customer_id, stripe_payment_method_id, no_show_fee_cents, no_show_charged')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (booking.no_show_charged) return NextResponse.json({ error: 'No-show fee already charged' }, { status: 409 })
  if (!booking.stripe_payment_method_id) return NextResponse.json({ error: 'No saved payment method' }, { status: 400 })

  const { data: tenant } = await supabase
    .from('clients')
    .select('stripe_connect_account_id, platform_fee_percent')
    .eq('id', booking.tenant_id)
    .maybeSingle()

  if (!tenant?.stripe_connect_account_id) return NextResponse.json({ error: 'Clinic has no Stripe account' }, { status: 400 })

  const feeAmount = (booking.no_show_fee_cents as number) ?? 5000
  const platformFeePercent = Number(tenant.platform_fee_percent ?? 5)
  const appFee = Math.round(feeAmount * (platformFeePercent / 100))

  try {
    const stripe = getStripe()
    const pi = await stripe.paymentIntents.create({
      amount: feeAmount,
      currency: 'cad',
      customer: booking.stripe_customer_id as string,
      payment_method: booking.stripe_payment_method_id as string,
      off_session: true,
      confirm: true,
      description: `No-show fee — booking ${bookingId}`,
      application_fee_amount: appFee,
      transfer_data: { destination: tenant.stripe_connect_account_id as string },
      metadata: { bookingId, type: 'no_show_fee' },
    })

    await supabase
      .from('bookings')
      .update({ no_show_charged: true, stripe_payment_intent_id: pi.id, updated_at: new Date().toISOString() })
      .eq('id', bookingId)

    return NextResponse.json({ ok: true, paymentIntentId: pi.id })
  } catch (err) {
    console.error('[charge-noshow] Failed:', err)
    return NextResponse.json({ error: 'Payment failed', detail: String(err) }, { status: 502 })
  }
}
