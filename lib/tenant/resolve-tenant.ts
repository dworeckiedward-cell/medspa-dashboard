import type { ResolvedTenant } from '@/types/database'

/**
 * Extracts the tenant slug from an incoming request.
 * Edge-compatible — no Node.js imports (runs in Next.js middleware).
 *
 * Resolution order (first match wins):
 *  1. x-tenant-slug request header  (dev fallback — set explicitly by caller)
 *  2. ?tenant=<slug> query param     (dev fallback — localhost convenience)
 *  3. Subdomain of NEXT_PUBLIC_APP_DOMAIN (e.g. luxe.yourdomain.com)
 *  4. Subdomain of lvh.me            (wildcard DNS → 127.0.0.1, great for local dev)
 *  5. Subdomain of .localhost        (some browser setups support this)
 *
 * Custom domain matching (e.g. client owns portal.luxe.com) requires a DB lookup
 * and is handled separately in get-tenant-config.ts after the slug is not found.
 *
 * Dev convenience:
 *   - luxe.lvh.me:3000  →  slug = "luxe"
 *   - localhost:3000/dashboard?tenant=luxe  →  slug = "luxe"
 *   - curl -H "x-tenant-slug: luxe" http://localhost:3000/dashboard
 */
export function extractTenantSlugFromRequest(
  hostname: string,
  searchParams: URLSearchParams,
  headers: Headers,
  appDomain: string,
): ResolvedTenant | null {
  // 1. Dev header override (e.g. integration tests, n8n webhook testing)
  const headerSlug = headers.get('x-tenant-slug')
  if (headerSlug) {
    return { slug: headerSlug.trim(), source: 'header' }
  }

  // 2. Query param — localhost dev convenience
  const querySlug = searchParams.get('tenant')
  if (querySlug) {
    return { slug: querySlug.trim(), source: 'query_param' }
  }

  // Strip port for subdomain parsing
  const host = hostname.split(':')[0]

  // 3. Subdomain of configured app domain (prod + staging)
  if (appDomain && host.endsWith(`.${appDomain}`)) {
    const sub = host.slice(0, -(appDomain.length + 1))
    if (sub && !['www', 'app', 'api', 'admin'].includes(sub)) {
      return { slug: sub, source: 'subdomain' }
    }
  }

  // 4. lvh.me wildcard (local dev: luxe.lvh.me → slug = luxe)
  if (host.endsWith('.lvh.me')) {
    const sub = host.slice(0, -'.lvh.me'.length)
    if (sub) return { slug: sub, source: 'subdomain' }
  }

  // 5. .localhost subdomain (some environments)
  if (host.endsWith('.localhost')) {
    const sub = host.slice(0, -'.localhost'.length)
    if (sub) return { slug: sub, source: 'subdomain' }
  }

  return null
}
