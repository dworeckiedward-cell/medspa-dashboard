/**
 * Branding mutations — server-side only.
 *
 * Updates tenant branding fields (logo_url). Uses service-role client.
 * Tenant-scoped — the caller must pass the correct tenantId.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Update the client's logo_url. Pass null to clear.
 */
export async function updateClientLogoUrl(
  tenantId: string,
  logoUrl: string | null,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseServerClient()

  try {
    const { error } = await supabase
      .from('tenants')
      .update({
        logo_url: logoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId)

    if (error) {
      console.error('[branding] updateClientLogoUrl error:', error.message)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch {
    return { success: false, error: 'Unexpected error updating logo' }
  }
}
