import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { extractTenantSlugFromRequest } from '@/lib/tenant/resolve-tenant'

/**
 * Next.js Edge Middleware — runs on every request before page rendering.
 *
 * Responsibilities:
 *  1. Resolve tenant slug from hostname/query/header
 *  2. Inject x-tenant-slug header for consumption by server components
 *  3. Pass through cleanly if no tenant found (pages handle the empty state)
 *
 * Dev convenience:
 *  - luxe.lvh.me:3000     → slug = "luxe"    (set NEXT_PUBLIC_APP_DOMAIN=lvh.me)
 *  - miami.lvh.me:3000    → slug = "miami"
 *  - localhost:3000?tenant=luxe               (query param fallback)
 *  - curl -H "x-tenant-slug: luxe" ...       (header fallback)
 *
 * NOTE: Keep this function lightweight — no DB calls in Edge middleware.
 * Full tenant config (branding, integrations) is fetched in the Root Layout.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip static assets and _next internals entirely
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2)$/)
  ) {
    return NextResponse.next()
  }

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'yourdomain.com'

  const resolved = extractTenantSlugFromRequest(
    request.nextUrl.hostname,
    request.nextUrl.searchParams,
    request.headers,
    appDomain,
  )

  // Build new request headers with tenant context
  const requestHeaders = new Headers(request.headers)

  if (resolved) {
    requestHeaders.set('x-tenant-slug', resolved.slug)
    requestHeaders.set('x-tenant-source', resolved.source)
  } else {
    // Clear any stale values — pages handle missing tenant gracefully
    requestHeaders.delete('x-tenant-slug')
    requestHeaders.delete('x-tenant-source')
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

export const config = {
  // Match all routes except static files already handled above
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
