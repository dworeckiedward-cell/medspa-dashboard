import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens } from '@/lib/jane/oauth'

/**
 * GET /api/jane/callback?code=X&state=Y
 *
 * Jane OAuth2 callback. Exchanges authorization code for tokens
 * and stores them in the jane_integrations table.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const error = request.nextUrl.searchParams.get('error')

  if (error) {
    console.error('[jane-oauth] Authorization error:', error)
    return NextResponse.redirect(new URL('/dashboard/settings?jane=error', request.nextUrl.origin))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/dashboard/settings?jane=missing_params', request.nextUrl.origin))
  }

  // Extract tenantId from state (format: "tenantId:uuid")
  const tenantId = state.split(':')[0]
  if (!tenantId) {
    return NextResponse.redirect(new URL('/dashboard/settings?jane=invalid_state', request.nextUrl.origin))
  }

  const supabase = createSupabaseServerClient()

  // Retrieve stored PKCE verifier + validate state
  const { data: integration } = await supabase
    .from('jane_integrations')
    .select('pkce_verifier, oauth_state, clinic_url')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!integration || integration.oauth_state !== state) {
    console.error('[jane-oauth] State mismatch or integration not found')
    return NextResponse.redirect(new URL('/dashboard/settings?jane=state_mismatch', request.nextUrl.origin))
  }

  if (!integration.pkce_verifier) {
    console.error('[jane-oauth] No PKCE verifier found')
    return NextResponse.redirect(new URL('/dashboard/settings?jane=no_verifier', request.nextUrl.origin))
  }

  const origin = request.nextUrl.origin
  const redirectUri = `${origin}/api/jane/callback`

  const tokens = await exchangeCodeForTokens({
    code,
    redirectUri,
    codeVerifier: integration.pkce_verifier,
  })

  if (!tokens) {
    await supabase
      .from('jane_integrations')
      .update({ status: 'error', updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)

    return NextResponse.redirect(new URL('/dashboard/settings?jane=token_error', request.nextUrl.origin))
  }

  // Store tokens
  await supabase
    .from('jane_integrations')
    .update({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_expires_at: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
      status: 'connected',
      oauth_state: null,
      pkce_verifier: null,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)

  return NextResponse.redirect(new URL('/dashboard/settings?jane=connected', request.nextUrl.origin))
}
