import { NextRequest, NextResponse } from 'next/server'
import { getTenantBySlug } from '@/lib/tenant/get-tenant-config'
import { extractTenantSlugFromRequest } from '@/lib/tenant/resolve-tenant'

/**
 * GET /api/tenant/debug
 *
 * Returns resolved tenant context — useful for debugging middleware + tenant resolution.
 * ONLY available in development (NODE_ENV !== 'production').
 *
 * Usage:
 *   curl http://luxe.lvh.me:3000/api/tenant/debug
 *   curl "http://localhost:3000/api/tenant/debug?tenant=luxe"
 *   curl -H "x-tenant-slug: miami" http://localhost:3000/api/tenant/debug
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'yourdomain.com'

  const resolved = extractTenantSlugFromRequest(
    request.nextUrl.hostname,
    request.nextUrl.searchParams,
    request.headers,
    appDomain,
  )

  // Also check the x-tenant-slug header set by middleware
  const middlewareSlug = request.headers.get('x-tenant-slug')
  const middlewareSource = request.headers.get('x-tenant-source')

  let tenantConfig = null
  const slugToLookup = middlewareSlug || resolved?.slug
  if (slugToLookup) {
    tenantConfig = await getTenantBySlug(slugToLookup)
    // Mask sensitive fields
    if (tenantConfig) {
      tenantConfig = {
        ...tenantConfig,
        n8n_api_key_ref: tenantConfig.n8n_api_key_ref ? '[ref]' : null,
        stripe_customer_id: tenantConfig.stripe_customer_id ? '[masked]' : null,
        stripe_subscription_id: tenantConfig.stripe_subscription_id ? '[masked]' : null,
      }
    }
  }

  return NextResponse.json({
    resolution: {
      middleware_slug: middlewareSlug,
      middleware_source: middlewareSource,
      fresh_resolution: resolved,
      app_domain: appDomain,
    },
    tenant: tenantConfig,
    request: {
      hostname: request.nextUrl.hostname,
      host: request.headers.get('host'),
      query_tenant: request.nextUrl.searchParams.get('tenant'),
    },
  })
}
