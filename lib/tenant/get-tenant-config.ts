import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Client } from '@/types/database'

/**
 * Fetch a tenant's full config by their URL slug.
 * Called in the root layout after middleware sets x-tenant-slug header.
 *
 * TODO: Wrap with React `cache()` or `unstable_cache` once Supabase client
 * is stable with those APIs — avoids duplicate fetches per request tree.
 *
 * TODO: Add RLS policy: auth.uid()::text = id::text (once auth is added).
 */
export async function getTenantBySlug(slug: string): Promise<Client | null> {
  if (!slug) return null

  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (error || !data) return null
  return data as Client
}

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
  return data as Client
}

/**
 * Reads the tenant slug from the request headers injected by middleware.
 * Pass the return value of `headers()` from next/headers.
 */
export function getTenantSlugFromHeaders(headersList: { get(name: string): string | null }): string | null {
  return headersList.get('x-tenant-slug') || null
}
