import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getAuthenticatedUser } from '@/lib/supabase/auth-server'

/**
 * GET /api/auth/debug
 *
 * Dev-only endpoint for diagnosing the Supabase auth + tenant resolution stack.
 * Useful when wiring the Lovable login flow to verify:
 *   - that auth cookies are being set and forwarded correctly
 *   - that user_tenants rows exist for the logged-in user
 *   - that the middleware demo fallback is working
 *
 * NEVER available in production — returns 403.
 * NEVER returns the service role key, JWTs, or raw session data.
 *
 * Usage:
 *   curl http://localhost:3000/api/auth/debug
 *   curl "http://localhost:3000/api/auth/debug?tenant=luxe"
 *   open http://luxe.lvh.me:3000/api/auth/debug
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  // ── Auth path ──────────────────────────────────────────────────────────────
  const authResult = await getAuthenticatedUser()

  // ── Demo / middleware path ─────────────────────────────────────────────────
  const headersList = headers()
  const middlewareSlug = headersList.get('x-tenant-slug') ?? null
  const middlewareSource = headersList.get('x-tenant-source') ?? null

  // ── Build safe response (no secrets) ──────────────────────────────────────
  const response = {
    auth: {
      sessionDetected: authResult !== null,
      userId: authResult?.userId ?? null,
      email: authResult?.email ?? null,
      tenantCount: authResult?.tenants.length ?? 0,
      tenants: authResult?.tenants.map((t) => ({
        slug: t.slug,
        name: t.name,
        id: t.id,
      })) ?? [],
    },
    demo: {
      middlewareSlugPresent: middlewareSlug !== null,
      slug: middlewareSlug,
      source: middlewareSource,
    },
    resolution: (() => {
      if (authResult !== null) {
        if (authResult.tenants.length === 1) {
          return { path: 'A1', description: 'authenticated — single tenant', tenant: authResult.tenants[0].slug }
        }
        if (authResult.tenants.length > 1) {
          return { path: 'A2', description: 'authenticated — multi-tenant (selection needed)', tenant: null }
        }
        return { path: 'A3', description: 'authenticated — no workspace assigned', tenant: null }
      }
      if (middlewareSlug) {
        return { path: 'B', description: 'demo / middleware slug', tenant: middlewareSlug }
      }
      return { path: 'C', description: 'no auth + no slug → none', tenant: null }
    })(),
    hints: [
      !authResult && !middlewareSlug
        ? 'No session and no middleware slug. Visit via ?tenant=slug or a subdomain.'
        : null,
      authResult && authResult.tenants.length === 0
        ? 'Authenticated but no user_tenants row. Run migration 003 and insert a row.'
        : null,
      authResult && authResult.tenants.length > 1
        ? 'Multi-tenant user. Dashboard will redirect to /dashboard/select-tenant.'
        : null,
    ].filter(Boolean),
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
