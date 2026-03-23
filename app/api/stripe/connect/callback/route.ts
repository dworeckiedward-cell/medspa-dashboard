import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/server'

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId')
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.servifylabs.com'

  if (!tenantId) return NextResponse.redirect(`${baseUrl}/dashboard/settings`)

  const supabase = createSupabaseServerClient()
  const { data: tenant } = await supabase
    .from('clients')
    .select('stripe_connect_account_id')
    .eq('id', tenantId)
    .maybeSingle()

  if (tenant?.stripe_connect_account_id) {
    try {
      const stripe = getStripe()
      const account = await stripe.accounts.retrieve(tenant.stripe_connect_account_id as string)
      const onboarded = !!(account.details_submitted && account.charges_enabled)
      await supabase
        .from('clients')
        .update({ stripe_connect_onboarded: onboarded })
        .eq('id', tenantId)
    } catch (err) {
      console.error('[stripe-connect-callback]', err)
    }
  }

  return NextResponse.redirect(`${baseUrl}/dashboard/settings?stripe_connected=1`)
}
