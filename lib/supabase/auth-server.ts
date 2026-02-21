import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from './server'
import type { Client } from '@/types/database'

/**
 * Auth-aware Supabase client for Next.js 14 App Router.
 *
 * Uses @supabase/ssr to read the user session from cookies set by Supabase Auth.
 * The session client (anon key + cookies) verifies the JWT; the service-role
 * client then queries user_tenants without requiring RLS on that table.
 *
 * ── Expected user_tenants schema (migration 003) ────────────────────────────
 *
 *   create table public.user_tenants (
 *     id          uuid primary key default gen_random_uuid(),
 *     user_id     uuid not null references auth.users(id) on delete cascade,
 *     client_id   uuid not null references public.clients(id) on delete cascade,
 *     role        text not null default 'viewer'
 *                   check (role in ('owner', 'admin', 'viewer')),
 *     created_at  timestamptz not null default now(),
 *     unique(user_id, client_id)
 *   );
 *
 * ── Lovable → Next.js auth handoff flow ─────────────────────────────────────
 *
 *   1. User logs in via Lovable (React + Vite) using Supabase magic link / OAuth.
 *   2. Supabase issues session cookies (sb-{projectRef}-auth-token, chunked).
 *   3. User navigates to the Next.js dashboard (same Supabase project = shared cookies).
 *   4. This module reads the cookies, verifies the JWT via supabase.auth.getUser(),
 *      then queries user_tenants to find ALL allowed tenants for this user.
 *   5. resolveTenantAccess() handles 0 / 1 / >1 tenant cases appropriately.
 *
 * ── To activate auth (checklist) ────────────────────────────────────────────
 *
 *   ✓  @supabase/ssr     — already installed (^0.5.0)
 *   □  Run migration     — supabase/migrations/003_user_tenants.sql
 *   □  Wire Lovable UI   — set NEXT_PUBLIC_SUPABASE_URL + ANON_KEY on the Lovable app
 *   □  Shared cookies    — ensure Lovable and this dashboard share the same domain
 *                         (e.g. Lovable on app.example.com, dashboard on *.example.com)
 *                         OR use Supabase's cross-domain auth via token in URL
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

    if (sessionError || !user) return null

    // 2. Fetch ALL tenants for this user via the service-role client.
    //    Service role bypasses RLS — safe because we already verified identity above.
    const serviceClient = createSupabaseServerClient()
    const { data: rows, error: membershipError } = await serviceClient
      .from('user_tenants')
      .select('client_id, clients:client_id(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (membershipError) {
      if (membershipError.message?.includes('does not exist')) {
        // user_tenants table not yet created — authenticated but no tenants
        return { userId: user.id, email: user.email, tenants: [] }
      }
      // Other DB error — fail safe (falls through to demo path)
      console.warn('[auth] user_tenants query error:', membershipError.message)
      return null
    }

    // Map join result to Client[] (PostgREST returns joined rows as unknown)
    const tenants: Client[] = (rows ?? [])
      .map((r) => r.clients as unknown as Client)
      .filter(Boolean)

    return {
      userId: user.id,
      email: user.email ?? null,
      tenants,
    }
  } catch (err) {
    // Should not reach here under normal conditions
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[auth] getAuthenticatedUser unexpected error:', err)
    }
    return null
  }
}
