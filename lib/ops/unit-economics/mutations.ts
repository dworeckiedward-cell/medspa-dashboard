/**
 * Unit Economics — Write Operations (Ops-Only)
 *
 * Server-only. Uses service-role Supabase client.
 * SECURITY: Only call from ops routes protected by resolveOperatorAccess().
 *
 * ── PRODUCTION COLUMN MAPPING ────────────────────────────────────────────────
 * Table: client_unit_economics
 * PK:    tenant_id (uuid, FK → tenants.id)
 * Cols:  cac_usd, ltv_usd, ltv_mode, acquisition_source, acquired_date,
 *        notes, acquired_at, updated_at
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { UnitEconomicsRow, UnitEconomicsUpsertPayload } from './types'

export interface UpsertResult {
  data: UnitEconomicsRow | null
  error: string | null
}

/**
 * Upsert unit economics for a tenant.
 * Creates a new row if none exists, updates if it does.
 * Returns { data, error } so the caller can surface real errors.
 */
export async function upsertUnitEconomics(
  tenantId: string,
  payload: UnitEconomicsUpsertPayload,
): Promise<UpsertResult> {
  const supabase = createSupabaseServerClient()
  const now = new Date().toISOString()

  // Build DB row — only include fields that are explicitly provided
  const dbRow: Record<string, unknown> = {
    tenant_id: tenantId,
    updated_at: now,
  }

  if (payload.cacUsd !== undefined) dbRow.cac_usd = payload.cacUsd
  if (payload.ltvUsd !== undefined) dbRow.ltv_usd = payload.ltvUsd
  if (payload.ltvMode !== undefined) dbRow.ltv_mode = payload.ltvMode
  if (payload.acquisitionSource !== undefined) dbRow.acquisition_source = payload.acquisitionSource
  if (payload.acquiredDate !== undefined) dbRow.acquired_date = payload.acquiredDate
  if (payload.notes !== undefined) dbRow.notes = payload.notes

  try {
    const { data, error } = await supabase
      .from('client_unit_economics')
      .upsert(dbRow, { onConflict: 'tenant_id' })
      .select('*')
      .single()

    if (error) {
      console.error('[ops] upsertUnitEconomics error:', error.message, error.details, error.hint)
      return { data: null, error: error.message }
    }

    if (!data) {
      return { data: null, error: 'Upsert returned no data' }
    }

    return { data: data as unknown as UnitEconomicsRow, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[ops] upsertUnitEconomics catch:', msg)
    return { data: null, error: msg }
  }
}

/**
 * Clear unit economics for a tenant (sets values to null).
 */
export async function clearUnitEconomics(tenantId: string): Promise<boolean> {
  const supabase = createSupabaseServerClient()

  try {
    const { error } = await supabase
      .from('client_unit_economics')
      .update({
        cac_usd: null,
        acquisition_source: null,
        acquired_date: null,
        notes: null,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)

    return !error
  } catch {
    return false
  }
}

// ── Legacy exports (backward compatibility) ─────────────────────────────────

export interface UpsertCacResult {
  data: UnitEconomicsRow | null
  error: string | null
}

/** @deprecated Use upsertUnitEconomics instead */
export async function upsertClientCac(
  clientId: string,
  payload: { cacAmount: number | null; cacSource?: string | null; cacNotes?: string | null; acquiredAt?: string | null },
): Promise<UpsertCacResult> {
  return upsertUnitEconomics(clientId, {
    cacUsd: payload.cacAmount,
    acquisitionSource: payload.cacSource ?? null,
    notes: payload.cacNotes ?? null,
    acquiredDate: payload.acquiredAt ? payload.acquiredAt.split('T')[0] : null,
  })
}

/** @deprecated Use clearUnitEconomics instead */
export async function clearClientCac(clientId: string): Promise<boolean> {
  return clearUnitEconomics(clientId)
}
