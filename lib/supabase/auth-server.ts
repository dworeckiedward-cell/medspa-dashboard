import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from './server'
import { enrichTenantsWithBranding } from '@/lib/tenant/get-tenant-config'
import type { Client } from '@/types/database'

/**
 * Auth-aware Supabase client for Next.js 14 App Router.
 *
 * Uses @supabase/ssr to read the user session from cookies set by:
 *   - createBrowserClient (lib/supabase/client.ts) — stores session in cookies
 *   - middleware.ts — refreshes expired tokens before server components run
 *
 * The session client (anon key + cookies) verifies the JWT; the service-role
 * client then queries user_tenants without requiring RLS on that table.
 */

// ── Session client (anon key + cookies — respects RLS) ──────────────────────

function createSupabaseSessionClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        // setAll is called when Supabase rotates the session token.
        // In Server Components cookies() is read-only — ignore the error.
        // Token refresh is handled by middleware.ts instead.
        setAll(cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2]),
            )
          } catch {
            // Expected in Server Components — middleware handles refresh
          }
        },
      },
    },
  )
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface AuthenticatedUserResult {
  userId: string
  email?: string | null
  /**
   * All tenants this user is mapped to in user_tenants.
   * Empty array = authenticated but no workspace assigned.
   * Length > 1 = multi-tenant user; resolver will surface needsTenantSelection.
   */
  tenants: Client[]
}

/**
 * Attempts to resolve the authenticated user and ALL their allowed tenants.
 *
 * Returns null if:
 *   - No valid Supabase session cookie exists (not logged in)
 *   - Session verification fails (expired / tampered JWT)
 *   - Any unexpected error (always fails safe → resolveTenantAccess falls through to demo)
 *
 * Returns { userId, email, tenants: [] } if:
 *   - Valid session but no rows in user_tenants, or table doesn't exist yet
 *
 * Returns { userId, email, tenants: [t1, ...] } if:
 *   - Valid session + one or more user_tenants rows found
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUserResult | null> {
  try {
    // 1. Verify the JWT stored in the Supabase auth cookie
    const sessionClient = createSupabaseSessionClient()
    const {
      data: { user },
      error: sessionError,
    } = await sessionClient.auth.getUser()

    if (sessionError || !user) {
      console.log('[auth] No session:', sessionError?.message ?? 'no user')
      return null
    }

    console.log('[auth] Session found:', user.id, user.email)

    // 2. Fetch ALL tenants for this user via the service-role client.
    //    Service role bypasses RLS — safe because we already verified identity above.
    //    Uses 2-step queries (memberships → tenants) to avoid PostgREST
    //    relational join issues with schema cache.
    const serviceClient = createSupabaseServerClient()

    // Step 2a: Get membership rows (user_tenants)
    const { data: memberships, error: membershipError } = await serviceClient
      .from('user_tenants')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (membershipError) {
      if (membershipError.message?.includes('does not exist')) {
        console.log('[auth] user_tenants table not found — returning 0 tenants')
        return { userId: user.id, email: user.email, tenants: [] }
      }
      console.warn('[auth] user_tenants query error:', membershipError.message)
      return null
    }

    const tenantIds = (memberships ?? []).map((m) => m.tenant_id).filter(Boolean)
    console.log('[auth] Membership rows:', memberships?.length ?? 0, '| tenant_ids:', tenantIds)

    if (tenantIds.length === 0) {
      console.log('[auth] No tenant memberships for user', user.id)
      return { userId: user.id, email: user.email ?? null, tenants: [] }
    }

    // Step 2b: Fetch actual tenant records by IDs
    const { data: tenantRows, error: tenantError } = await serviceClient
      .from('tenants')
      .select('*')
      .in('id', tenantIds)

    if (tenantError) {
      console.warn('[auth] tenants query error:', tenantError.message)
      return null
    }

    // Enrich with branding from clients table (logo_url, brand_color, accent_color)
    const enrichedRows = await enrichTenantsWithBranding(tenantRows ?? [])

    // Merge: preserve membership ordering (created_at ascending from step 2a)
    const tenantMap = new Map(enrichedRows.map((t) => [t.id, t]))
    const tenants: Client[] = tenantIds
      .map((id) => tenantMap.get(id) as Client | undefined)
      .filter((t): t is Client => t != null)

    console.log('[auth] Resolved:', tenants.length, 'tenant(s) for user', user.id,
      '| slugs:', tenants.map((t) => t.slug))

    return {
      userId: user.id,
      email: user.email ?? null,
      tenants,
    }
  } catch (err) {
    console.warn('[auth] getAuthenticatedUser unexpected error:', err)
    return null
  }
}
