/**
 * Tenant Summary Store — read/write AI executive summaries
 * in the `tenants.branding` JSON column.
 *
 * Storage path: tenants.branding.ai_modules.summary.<rangeDays>
 *
 * Merges minimally — never overwrites unrelated branding fields.
 * No schema changes required.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { SummaryOutput } from '@/lib/ai/provider'

// ── Types ────────────────────────────────────────────────────────────────────

export interface StoredSummary {
  generated_at: string
  model: string
  hash: string
  data: SummaryOutput
}

/** Shape of branding.ai_modules.summary — keyed by range string */
type SummaryMap = Record<string, StoredSummary>

interface AiModulesBlock {
  summary?: SummaryMap
}

type BrandingJson = Record<string, unknown> & {
  ai_modules?: AiModulesBlock
}

// ── Read ─────────────────────────────────────────────────────────────────────

/**
 * Read a cached tenant summary for a given range from tenants.branding.
 * Returns null if not found or branding is empty.
 */
export async function readTenantSummary(
  tenantId: string,
  rangeDays: number,
): Promise<StoredSummary | null> {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('tenants')
    .select('branding')
    .eq('id', tenantId)
    .maybeSingle()

  if (error || !data) return null

  const branding = data.branding as BrandingJson | null
  if (!branding) return null

  const entry = branding.ai_modules?.summary?.[String(rangeDays)]
  if (!entry || !entry.data || !entry.generated_at) return null

  return entry
}

// ── Write ────────────────────────────────────────────────────────────────────

/**
 * Write (merge) a tenant summary for a given range into tenants.branding.
 * Preserves all other branding fields.
 */
export async function writeTenantSummary(
  tenantId: string,
  rangeDays: number,
  payload: {
    data: SummaryOutput
    model: string
    hash: string
    generated_at: string
  },
): Promise<void> {
  const supabase = createSupabaseServerClient()

  // 1. Read current branding
  const { data: row } = await supabase
    .from('tenants')
    .select('branding')
    .eq('id', tenantId)
    .maybeSingle()

  const currentBranding: BrandingJson = (row?.branding as BrandingJson) ?? {}

  // 2. Deep-merge minimally
  const currentAiModules: AiModulesBlock = currentBranding.ai_modules ?? {}
  const currentSummaries: SummaryMap = currentAiModules.summary ?? {}

  const nextBranding: BrandingJson = {
    ...currentBranding,
    ai_modules: {
      ...currentAiModules,
      summary: {
        ...currentSummaries,
        [String(rangeDays)]: payload,
      },
    },
  }

  // 3. Write back
  const { error } = await supabase
    .from('tenants')
    .update({ branding: nextBranding })
    .eq('id', tenantId)

  if (error) {
    console.error(`[tenant-summary-store] Write failed for ${tenantId}:`, error.message)
    throw new Error(`Failed to persist tenant summary: ${error.message}`)
  }
}
