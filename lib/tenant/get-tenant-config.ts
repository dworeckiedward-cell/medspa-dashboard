import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Client } from '@/types/database'

/**
 * Fetch a tenant's full config by their URL slug.
 * Called in the root layout after middleware sets x-tenant-slug header.
 *
 * Reads base config from `tenants` table, then enriches with branding
 * fields (logo_url, brand_color, accent_color) from `clients` table.
 * This avoids the "column not found" error on `tenants` which doesn't
 * have branding columns.
 *
 * Wrapped with React cache() to deduplicate calls within a single render.
 * Both app/layout.tsx and resolveTenantAccess() call this with the same slug
 * per request — cache() ensures only one DB round-trip.
 */
export const getTenantBySlug = cache(async (slug: string): Promise<Client | null> => {
  if (!slug) return null

  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (error || !data) return null

  return enrichWithBranding(supabase, data)
})

/**
 * Fetch tenant by fully-custom domain (e.g. portal.luxeclinic.com).
 * Called as a fallback when slug-based resolution yields no match.
 */
export async function getTenantByCustomDomain(domain: string): Promise<Client | null> {
  if (!domain) return null

  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('custom_domain', domain)
    .eq('is_active', true)
    .single()

  if (error || !data) return null

  return enrichWithBranding(supabase, data)
}

/**
 * Reads the tenant slug from the request headers injected by middleware.
 * Pass the return value of `headers()` from next/headers.
 */
export function getTenantSlugFromHeaders(headersList: { get(name: string): string | null }): string | null {
  return headersList.get('x-tenant-slug') || null
}

// ── Internal: merge branding from clients table ──────────────────────────────

/**
 * Enrich a tenant row (from `tenants` table) with branding fields
 * from the `clients` table, matched by slug (the reliable cross-table key).
 * Falls back gracefully if no clients row exists.
 *
 * Lookup is by slug (not id) because clients.id may differ from tenants.id
 * depending on how the clinic was provisioned.
 */
async function enrichWithBranding(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  tenant: Record<string, unknown>,
): Promise<Client> {
  try {
    const slug = tenant.slug as string
    if (!slug) return tenant as unknown as Client

    // Query base branding columns (guaranteed to exist since migration 001).
    // client_type is optional (added in migration 025) — query it separately
    // to avoid PostgREST errors that would block logo_url from loading.
    const { data: branding } = await supabase
      .from('clients')
      .select('logo_url, brand_color, accent_color, currency, updated_at, features')
      .eq('slug', slug)
      .maybeSingle()

    if (branding) {
      // Try to fetch client_type separately (may not exist in older schemas)
      let clientType: 'clinic' | 'outbound' | null = null
      const { data: typeRow } = await supabase
        .from('clients')
        .select('client_type')
        .eq('slug', slug)
        .maybeSingle()
      if (typeRow) {
        clientType = ((typeRow as Record<string, unknown>).client_type ?? null) as 'clinic' | 'outbound' | null
      }

      return {
        ...tenant,
        logo_url: branding.logo_url ?? null,
        brand_color: branding.brand_color ?? null,
        accent_color: branding.accent_color ?? null,
        currency: branding.currency ?? (tenant.currency as string | undefined) ?? 'USD',
        // Prefer clients.updated_at so cacheBustLogo reflects logo upload timestamps
        updated_at: branding.updated_at ?? (tenant.updated_at as string | undefined) ?? new Date().toISOString(),
        client_type: clientType,
        features: (branding as Record<string, unknown>).features ?? null,
      } as Client
    }
  } catch {
    // Graceful — branding columns just won't be populated
  }

  return tenant as unknown as Client
}

/**
 * Bulk-enrich an array of tenant rows with branding from `clients`.
 * Exported for use by auth-server and ops queries.
 *
 * Lookup is by slug (not id) because clients.id may differ from tenants.id.
 */
export async function enrichTenantsWithBranding(
  tenantRows: Record<string, unknown>[],
): Promise<Client[]> {
  if (tenantRows.length === 0) return []

  const supabase = createSupabaseServerClient()
  const slugs = tenantRows.map((t) => t.slug as string).filter(Boolean)

  try {
    // Query base branding columns (guaranteed to exist since migration 001).
    const { data: brandingRows } = await supabase
      .from('clients')
      .select('slug, logo_url, brand_color, accent_color, currency, updated_at, features')
      .in('slug', slugs)

    // Try to fetch client_type separately (may not exist in older schemas)
    let typeMap = new Map<string, string | null>()
    const { data: typeRows } = await supabase
      .from('clients')
      .select('slug, client_type')
      .in('slug', slugs)
    if (typeRows) {
      typeMap = new Map(typeRows.map((r) => [r.slug as string, (r as Record<string, unknown>).client_type as string | null]))
    }

    if (brandingRows && brandingRows.length > 0) {
      const brandingMap = new Map(
        brandingRows.map((b) => [b.slug as string, b]),
      )

      return tenantRows.map((t) => {
        const branding = brandingMap.get(t.slug as string) as Record<string, unknown> | undefined
        return {
          ...t,
          logo_url: (branding?.logo_url ?? (t.logo_url as string | null)) ?? null,
          brand_color: (branding?.brand_color ?? (t.brand_color as string | null)) ?? null,
          accent_color: (branding?.accent_color ?? (t.accent_color as string | null)) ?? null,
          currency: (branding?.currency ?? (t.currency as string | undefined)) ?? 'USD',
          // Prefer clients.updated_at so cacheBustLogo reflects logo upload timestamps
          updated_at: (branding?.updated_at ?? (t.updated_at as string | undefined)) ?? new Date().toISOString(),
          client_type: (typeMap.get(t.slug as string) ?? null) as 'clinic' | 'outbound' | null,
          features: (branding?.features ?? null) as Record<string, unknown> | null,
        } as Client
      })
    }
  } catch {
    // Graceful — return without branding
  }

  return tenantRows as unknown as Client[]
}
