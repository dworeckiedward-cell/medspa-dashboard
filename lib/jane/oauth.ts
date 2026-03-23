/**
 * Jane App OAuth2 + PKCE flow helpers.
 */

import crypto from 'crypto'

const JANE_IAM_URL = process.env.JANE_IAM_URL ?? 'https://id.janeapp.com'
const JANE_CLIENT_ID = process.env.JANE_CLIENT_ID ?? ''
const JANE_REALM = process.env.JANE_REALM ?? 'jane'

const SCOPES = [
  'appointments:read',
  'appointments:create',
  'treatments:read',
  'staff_members:read',
  'disciplines:read',
  'patients:read',
  'patients:create',
  'locations:read',
].join(' ')

function base64url(buffer: Buffer): string {
  return buffer.toString('base64url')
}

export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = base64url(crypto.randomBytes(32))
  const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest())
  return { codeVerifier, codeChallenge }
}

export function buildAuthorizationUrl(params: {
  redirectUri: string
  codeChallenge: string
  state: string
  resource: string  // e.g. https://liveyounger.janeapp.com
}): string {
  const url = new URL(`${JANE_IAM_URL}/realms/${JANE_REALM}/protocol/openid-connect/auth`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', JANE_CLIENT_ID)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('scope', SCOPES)
  url.searchParams.set('code_challenge', params.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', params.state)
  url.searchParams.set('resource', params.resource)
  return url.toString()
}

export async function exchangeCodeForTokens(params: {
  code: string
  redirectUri: string
  codeVerifier: string
}): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
} | null> {
  try {
    const res = await fetch(`${JANE_IAM_URL}/realms/${JANE_REALM}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: params.code,
        redirect_uri: params.redirectUri,
        client_id: JANE_CLIENT_ID,
        client_secret: process.env.JANE_CLIENT_SECRET ?? '',
        code_verifier: params.codeVerifier,
      }),
    })

    if (!res.ok) {
      console.error('[jane-oauth] Token exchange failed:', res.status, await res.text())
      return null
    }

    const data = await res.json()
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in ?? 300,
    }
  } catch (err) {
    console.error('[jane-oauth] Token exchange error:', err)
    return null
  }
}
