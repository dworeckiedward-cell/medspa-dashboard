import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/server'

export async function POST(req: NextRequest) {
  const { tenantId } = await req.json() as { tenantId?: string }
  if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 })

  const supabase = createSupabaseServerClient()

  const { data: tenant } = await supabase
    .from('clients')
    .select('id, name, stripe_connect_account_id')
    .eq('id', tenantId)
    .maybeSingle()

  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const stripe = getStripe()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.servifylabs.com'

  let accountId = tenant.stripe_connect_account_id as string | null

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
    })
    accountId = account.id
    await supabase
      .from('clients')
      .update({ stripe_connect_account_id: accountId })
      .eq('id', tenantId)
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/dashboard/settings?stripe_refresh=1`,
    return_url: `${baseUrl}/api/stripe/connect/callback?tenantId=${tenantId}`,
    type: 'account_onboarding',
  })

  return NextResponse.json({ url: accountLink.url })
}
