/**
 * Branding mutations — server-side only.
 *
 * Updates client branding fields (logo_url, brand_color, accent_color).
 * Uses service-role client. Writes to both `clients` and `tenants` tables
 * to ensure the logo_url is available regardless of which table is queried.
 * Tenant-scoped — the caller must pass the correct clientId.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Update the client's logo_url. Pass null to clear.
 * Writes to both `clients` and `tenants` tables for consistency.
 */
export async function updateClientLogoUrl(
  clientId: string,
  logoUrl: string | null,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseServerClient()
  const now = new Date().toISOString()

  try {
    // Update clients table (primary branding store)
    const { error } = await supabase
      .from('clients')
      .update({
        logo_url: logoUrl,
        updated_at: now,
      })
      .eq('id', clientId)

    if (error) {
      console.error('[branding] updateClientLogoUrl clients error:', error.message)
      return { success: false, error: error.message }
    }

    // Also update tenants table (same underlying table in most setups,
    // but ensures logo_url is returned by getTenantBySlug SELECT *)
    const { error: tenantError } = await supabase
      .from('tenants')
      .update({
        logo_url: logoUrl,
        updated_at: now,
      })
      .eq('id', clientId)

    if (tenantError) {
      // Non-fatal — clients table is the source of truth
      console.warn('[branding] updateClientLogoUrl tenants error:', tenantError.message)
    }

    return { success: true }
  } catch {
    return { success: false, error: 'Unexpected error updating logo' }
  }
}

/**
 * Update the client's brand_color and/or accent_color.
 */
export async function updateClientBrandColors(
  clientId: string,
  colors: { brand_color?: string; accent_color?: string },
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseServerClient()

  try {
    const { error } = await supabase
      .from('clients')
      .update({
        ...colors,
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId)

    if (error) {
      console.error('[branding] updateClientBrandColors error:', error.message)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch {
    return { success: false, error: 'Unexpected error updating brand colors' }
  }
}
