/**
 * Unit Economics — Write Operations (Ops-Only)
 *
 * Server-only. Uses service-role Supabase client.
 * SECURITY: Only call from ops routes protected by resolveOperatorAccess().
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { CacUpdatePayload, ClientUnitEconomicsRow } from './types'

/**
 * Upsert CAC data for a client.
 * Creates a new row if none exists, updates if it does.
 * Returns the updated row or null on failure.
 */
export async function upsertClientCac(
  clientId: string,
  payload: CacUpdatePayload,
): Promise<ClientUnitEconomicsRow | null> {
  const supabase = createSupabaseServerClient()
  const now = new Date().toISOString()

  const dbRow = {
    client_id: clientId,
    cac_amount: payload.cacAmount,
    cac_currency: payload.cacCurrency ?? 'USD',
    cac_source: payload.cacSource ?? null,
    cac_notes: payload.cacNotes ?? null,
    acquired_at: payload.acquiredAt ?? null,
    updated_at: now,
  }

  try {
    const { data, error } = await supabase
      .from('client_unit_economics')
      .upsert(
        { ...dbRow, created_at: now },
        { onConflict: 'client_id' },
      )
      .select('*')
      .single()

    if (error || !data) {
      console.error('[ops] upsertClientCac error:', error?.message)
      return null
    }

    return data as unknown as ClientUnitEconomicsRow
  } catch (err) {
    console.error('[ops] upsertClientCac catch:', err)
    return null
  }
}

/**
 * Clear CAC data for a client (sets amounts to null).
 */
export async function clearClientCac(
  clientId: string,
): Promise<boolean> {
  const supabase = createSupabaseServerClient()

  try {
    const { error } = await supabase
      .from('client_unit_economics')
      .update({
        cac_amount: null,
        cac_source: null,
        cac_notes: null,
        acquired_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('client_id', clientId)

    return !error
  } catch {
    return false
  }
}
