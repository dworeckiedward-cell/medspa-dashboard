/**
 * Unit Economics — Read Operations (Ops-Only)
 *
 * Server-only. Uses service-role Supabase client.
 * SECURITY: Only call from ops routes protected by resolveOperatorAccess().
 *
 * ── PRODUCTION COLUMN MAPPING ────────────────────────────────────────────────
 * Table: client_unit_economics
 * PK:    tenant_id
 * Cols:  cac_usd, ltv_usd, ltv_mode, acquisition_source, acquired_date,
 *        notes, acquired_at, updated_at
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { listAllClients } from '@/lib/ops/query'
import { buildClientUnitEconomics } from './calc'
import type { UnitEconomicsRow, ClientUnitEconomicsRow, ClientUnitEconomics } from './types'

// ── Normalize raw DB row → UnitEconomicsRow ─────────────────────────────────
// Handles both production (tenant_id, cac_usd) and legacy (client_id, cac_amount)
// column names for resilience during migration transitions.

function normalizeRow(raw: Record<string, unknown>): UnitEconomicsRow {
  return {
    tenant_id: (raw.tenant_id ?? raw.client_id) as string,
    cac_usd: (raw.cac_usd ?? raw.cac_amount ?? null) as number | null,
    ltv_usd: (raw.ltv_usd ?? null) as number | null,
    ltv_mode: (raw.ltv_mode ?? 'auto') as string,
    acquisition_source: (raw.acquisition_source ?? raw.cac_source ?? null) as string | null,
    acquired_date: (raw.acquired_date ?? null) as string | null,
    notes: (raw.notes ?? raw.cac_notes ?? null) as string | null,
    acquired_at: (raw.acquired_at ?? null) as string | null,
    updated_at: raw.updated_at as string,
  }
}

/** Convert UnitEconomicsRow → legacy ClientUnitEconomicsRow shape for calc.ts */
function toLegacyRow(row: UnitEconomicsRow): ClientUnitEconomicsRow {
  return {
    id: row.tenant_id,
    client_id: row.tenant_id,
    cac_amount: row.cac_usd,
    cac_currency: 'USD',
    cac_source: row.acquisition_source as ClientUnitEconomicsRow['cac_source'],
    cac_notes: row.notes,
    acquired_at: row.acquired_at ?? row.acquired_date,
    created_at: row.updated_at,
    updated_at: row.updated_at,
  }
}

// ── Single tenant row ───────────────────────────────────────────────────────

/**
 * Fetch the unit economics row for a single tenant. Returns null if not set.
 */
export async function getUnitEconomicsRow(
  tenantId: string,
): Promise<UnitEconomicsRow | null> {
  const supabase = createSupabaseServerClient()

  try {
    const { data, error } = await supabase
      .from('client_unit_economics')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (error || !data) return null
    return normalizeRow(data as Record<string, unknown>)
  } catch {
    // Table may not exist yet — graceful fallback
    return null
  }
}

/**
 * @deprecated Use getUnitEconomicsRow instead. Kept for backward compatibility.
 */
export async function getClientCacRow(
  clientId: string,
): Promise<ClientUnitEconomicsRow | null> {
  const row = await getUnitEconomicsRow(clientId)
  if (!row) return null
  return toLegacyRow(row)
}

// ── All rows (for ops table merge) ──────────────────────────────────────────

/**
 * Fetch all unit economics records. Returns a Map keyed by tenant_id.
 */
export async function getAllUnitEconomicsRows(): Promise<Map<string, UnitEconomicsRow>> {
  const supabase = createSupabaseServerClient()
  const map = new Map<string, UnitEconomicsRow>()

  try {
    const { data, error } = await supabase
      .from('client_unit_economics')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error || !data) return map

    for (const raw of data) {
      const row = normalizeRow(raw as Record<string, unknown>)
      map.set(row.tenant_id, row)
    }
  } catch {
    // Table may not exist yet — return empty map
  }

  return map
}

/** @deprecated Use getAllUnitEconomicsRows */
export async function getAllCacRows(): Promise<Map<string, ClientUnitEconomicsRow>> {
  const rows = await getAllUnitEconomicsRows()
  const map = new Map<string, ClientUnitEconomicsRow>()
  rows.forEach((row, id) => {
    map.set(id, toLegacyRow(row))
  })
  return map
}

// ── Full unit economics for all clients (merged) ────────────────────────────

/**
 * Build complete unit economics for all active clients.
 * Merges client data + unit economics rows + computed LTV.
 */
export async function getAllClientUnitEconomics(): Promise<ClientUnitEconomics[]> {
  const supabase = createSupabaseServerClient()
  const [clients, ueRows, { data: profiles }] = await Promise.all([
    listAllClients(),
    getAllUnitEconomicsRows(),
    supabase.from('client_financial_profiles').select('client_id, retainer_amount'),
  ])

  const retainerMap = new Map<string, number>()
  ;(profiles ?? []).forEach((p: { client_id: string; retainer_amount: number | null }) => {
    if (p.retainer_amount != null) retainerMap.set(p.client_id, p.retainer_amount)
  })

  return clients.map((client) => {
    const ueRow = ueRows.get(client.id) ?? null
    const legacyRow = ueRow ? toLegacyRow(ueRow) : null
    return buildClientUnitEconomics(client, legacyRow, ueRow, retainerMap.get(client.id))
  })
}
