import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { extractTenantSlugFromRequest } from '@/lib/tenant/resolve-tenant'

/**
 * Next.js Edge Middleware — runs on every request before page rendering.
 *
 * Responsibilities:
 *  1. Refresh Supabase auth tokens (critical for server-side auth)
 *  2. Resolve tenant slug from hostname/query/header
 *  3. Inject x-tenant-slug request header for server components
 *
 * The Supabase token refresh MUST happen here because Server Components
 * cannot write cookies. Without this, expired JWTs cause
 * getAuthenticatedUser() to return null even for logged-in users.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip static assets and _next internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2)$/)
  ) {
    return NextResponse.next()
  }

  // ── 1. Supabase auth token refresh ──────────────────────────────────────
  // Track any cookies Supabase refreshes so we can forward them to the browser.
  const refreshedCookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = []

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }>) {
          // Set refreshed tokens on the request (for downstream server components)
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          // Track for setting on the response (for the browser)
          refreshedCookies.length = 0
          refreshedCookies.push(...cookiesToSet)
        },
      },
    })

    // This refreshes the session if the JWT is expired.
    // The refreshed tokens are written to cookies via setAll above.
    await supabase.auth.getUser()
  }

  // ── 2. Tenant slug resolution ──────────────────────────────────────────
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'yourdomain.com'

  const resolved = extractTenantSlugFromRequest(
    request.nextUrl.hostname,
    request.nextUrl.searchParams,
    request.headers,
    appDomain,
  )

  // ── 3. Build response with custom request headers ──────────────────────
  // Read headers AFTER Supabase modified request.cookies (which updates
  // the Cookie header internally), so downstream gets both auth + tenant.
  const requestHeaders = new Headers(request.headers)

  if (resolved) {
    requestHeaders.set('x-tenant-slug', resolved.slug)
    requestHeaders.set('x-tenant-source', resolved.source)
  } else {
    requestHeaders.delete('x-tenant-slug')
    requestHeaders.delete('x-tenant-source')
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  // Forward refreshed auth cookies to the browser
  for (const { name, value, options } of refreshedCookies) {
    response.cookies.set(name, value, options)
  }

  // Persist the selected tenant to a cookie so subsequent navigations
  // (e.g. /dashboard/support) can resolve the tenant without ?tenant= param.
  if (resolved?.source === 'query_param') {
    response.cookies.set('selected_tenant', resolved.slug, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8, // 8 hours
    })
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
