import { headers } from 'next/headers'
import type { Client } from '@/types/database'
import { getTenantBySlug } from '@/lib/tenant/get-tenant-config'
import { getAuthenticatedUser } from '@/lib/supabase/auth-server'

// ─── Contract ───────────────────────────────────────────────────────────────

/**
 * How the tenant was resolved.
 *
 *  'authenticated' — Supabase Auth session → user_tenants lookup
 *  'demo'          — x-tenant-slug middleware header / ?tenant= query param
 *  'none'          — nothing worked; tenant will be null
 */
export type AccessMode = 'authenticated' | 'demo' | 'none'

export interface TenantAccessResult {
  tenant: Client | null
  accessMode: AccessMode

  /** Present when a verified Supabase session exists (regardless of tenant mapping). */
  userId?: string | null

  /** Slug used to resolve the tenant (useful for error messages / debug). */
  tenantSlug?: string | null

  /**
   * True when the authenticated user has MORE than one tenant and must choose.
   * When true: tenant = null, availableTenants = all options.
   * UI should redirect to /dashboard/select-tenant.
   */
  needsTenantSelection?: boolean

  /**
   * Populated only when needsTenantSelection = true.
   * The select-tenant page uses this list to render workspace options.
   */
  availableTenants?: Client[]
}

// ─── Resolver ───────────────────────────────────────────────────────────────

/**
 * Central tenant resolver for all dashboard routes.
 * Call with no arguments from Server Components — reads headers() and cookies()
 * from the current request context internally.
 *
 * Resolution priority:
 *
 *   A. Supabase Auth session (cookie) → user_tenants → tenant
 *      Three sub-cases:
 *        A1. 1 tenant   → return it directly
 *        A2. >1 tenants → tenant = null, needsTenantSelection = true
 *        A3. 0 tenants  → tenant = null, no_workspace UX
 *      Fails safe: any error falls through to path B.
 *
 *   B. Middleware-injected slug (demo / dev / subdomain)
 *      Reads x-tenant-slug header set by Next.js middleware.
 *      Current production path.
 *
 *   C. None
 *      Returns { tenant: null, accessMode: 'none' }.
 *
 * Consumers should handle:
 *   needsTenantSelection === true  → redirect('/dashboard/select-tenant')
 *   !tenant && accessMode === 'authenticated' → <TenantNotFound reason="no_workspace" />
 *   !tenant                        → <TenantNotFound reason="not_found" />
 */
export async function resolveTenantAccess(): Promise<TenantAccessResult> {
  // ── A. Authenticated path (Supabase Auth + user_tenants) ─────────────────
  const authResult = await getAuthenticatedUser()

  if (authResult !== null) {
    const { userId, tenants } = authResult

    // A1. Exactly one tenant — happy path
    if (tenants.length === 1) {
      return {
        tenant: tenants[0],
        accessMode: 'authenticated',
        userId,
        tenantSlug: tenants[0].slug,
        needsTenantSelection: false,
      }
    }

    // A2. Multiple tenants — user must pick one
    if (tenants.length > 1) {
      return {
        tenant: null,
        accessMode: 'authenticated',
        userId,
        tenantSlug: null,
        needsTenantSelection: true,
        availableTenants: tenants,
      }
    }

    // A3. Zero tenants — authenticated but no workspace assigned yet
    return {
      tenant: null,
      accessMode: 'authenticated',
      userId,
      tenantSlug: null,
      needsTenantSelection: false,
    }
  }

  // ── B. Demo / middleware-injected slug ────────────────────────────────────
  const headersList = headers()
  const slug = headersList.get('x-tenant-slug') ?? ''

  if (!slug) {
    return { tenant: null, accessMode: 'none', tenantSlug: null }
  }

  const tenant = await getTenantBySlug(slug)
  return {
    tenant,
    accessMode: 'demo',
    tenantSlug: slug,
  }
}
