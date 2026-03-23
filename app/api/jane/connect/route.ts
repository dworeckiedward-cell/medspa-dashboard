import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { generatePKCE, buildAuthorizationUrl } from '@/lib/jane/oauth'

/**
 * GET /api/jane/connect?tenantId=X
 *
 * Initiates Jane OAuth2 + PKCE flow.
 * Stores PKCE verifier + state in jane_integrations table,
 * then redirects the user to Jane's authorization page.
 */
export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenantId')
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId required' }, { status: 400 })
  }

  if (!process.env.JANE_CLIENT_ID) {
    return NextResponse.json({ error: 'Jane integration not configured' }, { status: 503 })
  }

  const supabase = createSupabaseServerClient()

  // Verify tenant exists
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, slug')
    .eq('id', tenantId)
    .eq('is_active', true)
    .maybeSingle()

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const { codeVerifier, codeChallenge } = generatePKCE()
  const state = `${tenantId}:${crypto.randomUUID()}`
  const origin = request.nextUrl.origin
  const redirectUri = `${origin}/api/jane/callback`
  const clinicUrl = process.env.JANE_CLINIC_URL ?? `https://${tenant.slug}.janeapp.com`

  // Upsert integration record with PKCE state
  await supabase
    .from('jane_integrations')
    .upsert({
      tenant_id: tenantId,
      clinic_url: clinicUrl,
      status: 'pending',
      oauth_state: state,
      pkce_verifier: codeVerifier,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' })

  const authUrl = buildAuthorizationUrl({
    redirectUri,
    codeChallenge,
    state,
    resource: clinicUrl,
  })

  return NextResponse.redirect(authUrl)
}
