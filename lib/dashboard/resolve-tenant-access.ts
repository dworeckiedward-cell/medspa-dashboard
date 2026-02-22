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
 *      Sub-cases:
 *        A1. 1 tenant     → return it directly
 *        A2. >1 tenants + slug in URL/header that matches one → return that tenant
 *        A3. >1 tenants + no slug                             → needsTenantSelection
 *        A4. 0 tenants   → tenant = null, no_workspace UX
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
  // Read middleware-injected slug early — needed for both auth and demo paths.
  const headersList = headers()
  const slug = headersList.get('x-tenant-slug') ?? ''

  // ── A. Authenticated path (Supabase Auth + user_tenants) ─────────────────
  const authResult = await getAuthenticatedUser()

  console.log('[tenant-access] Auth result:', authResult ? {
    userId: authResult.userId,
    email: authResult.email,
    tenantCount: authResult.tenants.length,
    tenantSlugs: authResult.tenants.map((t) => t.slug),
  } : null, '| slug from header:', slug || '(none)')

  if (authResult !== null) {
    const { userId, tenants } = authResult

    // A1. Exactly one tenant — happy path
    if (tenants.length === 1) {
      console.log('[tenant-access] A1: Single tenant →', tenants[0].slug)
      return {
        tenant: tenants[0],
        accessMode: 'authenticated',
        userId,
        tenantSlug: tenants[0].slug,
        needsTenantSelection: false,
      }
    }

    // A2/A3. Multiple tenants
    if (tenants.length > 1) {
      // If a slug was provided (via ?tenant= query param or subdomain),
      // check if it matches one of the user's assigned tenants.
      // This allows direct access via URL without going through the picker.
      if (slug) {
        const matched = tenants.find(
          (t) => t.slug.toLowerCase() === slug.toLowerCase(),
        )
        if (matched) {
          console.log('[tenant-access] A2: Multi-tenant, slug matched →', matched.slug)
          return {
            tenant: matched,
            accessMode: 'authenticated',
            userId,
            tenantSlug: matched.slug,
            needsTenantSelection: false,
          }
        }
        console.log('[tenant-access] A2: Slug', slug, 'did not match any assigned tenant')
      }

      // No slug or slug didn't match — user must pick one
      console.log('[tenant-access] A3: Multi-tenant, no match → picker')
      return {
        tenant: null,
        accessMode: 'authenticated',
        userId,
        tenantSlug: null,
        needsTenantSelection: true,
        availableTenants: tenants,
      }
    }

    // A4. Zero tenants — authenticated but no workspace assigned yet
    console.log('[tenant-access] A4: Authenticated but 0 tenants')
    return {
      tenant: null,
      accessMode: 'authenticated',
      userId,
      tenantSlug: null,
      needsTenantSelection: false,
    }
  }

  // ── B. Demo / middleware-injected slug ────────────────────────────────────
  if (!slug) {
    console.log('[tenant-access] B: No auth, no slug → none')
    return { tenant: null, accessMode: 'none', tenantSlug: null }
  }

  const tenant = await getTenantBySlug(slug)
  console.log('[tenant-access] B: Demo slug →', slug, tenant ? 'found' : 'NOT FOUND')
  return {
    tenant,
    accessMode: 'demo',
    tenantSlug: slug,
  }
}
