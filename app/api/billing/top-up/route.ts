import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/server'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // Validate session + resolve tenant
  const { tenant } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Allow caller to override tenantId for ops use, but only if session tenant matches
  let body: { tenantId?: string } = {}
  try { body = await req.json() } catch { /* no body */ }

  const tenantId = body.tenantId ?? tenant.id
  if (tenantId !== tenant.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createSupabaseServerClient()

  // Get tenant stripe_customer_id if available
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, stripe_customer_id')
    .eq('id', tenantId)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const stripe = getStripe()

  // Build the base URL for success/cancel redirects
  const origin = req.headers.get('origin') ?? 'https://app.servifylabs.com'
  const successUrl = `${origin}/dashboard/settings?topup=success&tenant=${tenant.slug}`
  const cancelUrl = `${origin}/dashboard/settings?topup=cancelled&tenant=${tenant.slug}`

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: 5000, // $50.00
          product_data: {
            name: 'AI Budget Top-Up',
            description: 'Add $50 to your monthly AI call budget',
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      tenantId,
      type: 'ai_budget_topup',
    },
    ...(client.stripe_customer_id
      ? { customer: client.stripe_customer_id }
      : { customer_creation: 'always' }),
    success_url: successUrl,
    cancel_url: cancelUrl,
  })

  return NextResponse.json({ url: session.url })
}
