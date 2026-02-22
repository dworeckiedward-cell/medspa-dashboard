/**
 * Tenant-aware API URL builder for client-side fetch calls.
 *
 * Problem: Client-side `fetch('/api/...')` loses the `?tenant=` query param
 * that middleware uses to resolve the tenant. This utility appends the tenant
 * slug to API URLs so the middleware can identify the tenant on API routes.
 *
 * Usage:
 *   const url = buildTenantApiUrl('/api/branding', tenantSlug)
 *   // → '/api/branding?tenant=luxe'
 */

export function buildTenantApiUrl(
  path: string,
  tenantSlug: string | null | undefined,
): string {
  if (!tenantSlug) return path
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}tenant=${encodeURIComponent(tenantSlug)}`
}
