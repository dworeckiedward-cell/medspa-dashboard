/**
 * Build a dashboard-internal href that preserves the ?tenant= query param.
 *
 * In localhost dev the tenant is resolved from ?tenant=slug (query_param source).
 * Without this helper, client-side navigation via <Link> drops the query param
 * and the middleware loses tenant context on the next request.
 *
 * In production subdomain routing ?tenant= is redundant but harmless — the
 * middleware resolves the slug from the query param BEFORE the subdomain check.
 *
 * Hash fragments are preserved after the query string:
 *   buildDashboardHref('/dashboard#calls', 'luxe') → '/dashboard?tenant=luxe#calls'
 */
export function buildDashboardHref(
  path: string,
  tenantSlug: string | null | undefined,
): string {
  if (!tenantSlug) return path

  const hashIdx = path.indexOf('#')
  const base = hashIdx === -1 ? path : path.slice(0, hashIdx)
  const hash = hashIdx === -1 ? '' : path.slice(hashIdx)
  const sep = base.includes('?') ? '&' : '?'

  return `${base}${sep}tenant=${encodeURIComponent(tenantSlug)}${hash}`
}
