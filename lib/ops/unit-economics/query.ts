/**
 * Unit Economics — Read Operations (Ops-Only)
 *
 * Server-only. Uses service-role Supabase client.
 * SECURITY: Only call from ops routes protected by resolveOperatorAccess().
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { listAllClients } from '@/lib/ops/query'
import { buildClientUnitEconomics } from './calc'
import type { ClientUnitEconomicsRow, ClientUnitEconomics } from './types'

// ── Single client CAC row ───────────────────────────────────────────────────

/**
 * Fetch the CAC record for a single client. Returns null if not set.
 */
export async function getClientCacRow(
  clientId: string,
): Promise<ClientUnitEconomicsRow | null> {
  const supabase = createSupabaseServerClient()

  try {
    const { data, error } = await supabase
      .from('client_unit_economics')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle()

    if (error || !data) return null
    return data as unknown as ClientUnitEconomicsRow
  } catch {
    // Table may not exist yet — graceful fallback
    return null
  }
}

// ── All CAC rows (for ops table merge) ──────────────────────────────────────

/**
 * Fetch all CAC records in one query. Returns a Map keyed by client_id.
 */
export async function getAllCacRows(): Promise<Map<string, ClientUnitEconomicsRow>> {
  const supabase = createSupabaseServerClient()
  const map = new Map<string, ClientUnitEconomicsRow>()

  try {
    const { data, error } = await supabase
      .from('client_unit_economics')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error || !data) return map

    for (const row of data as unknown as ClientUnitEconomicsRow[]) {
      map.set(row.client_id, row)
    }
  } catch {
    // Table may not exist yet — return empty map
  }

  return map
}

// ── Full unit economics for all clients (merged) ────────────────────────────

/**
 * Build complete unit economics for all active clients.
 * Merges client data + CAC rows + computed LTV.
 */
export async function getAllClientUnitEconomics(): Promise<ClientUnitEconomics[]> {
  const [clients, cacRows] = await Promise.all([
    listAllClients(),
    getAllCacRows(),
  ])

  return clients.map((client) =>
    buildClientUnitEconomics(client, cacRows.get(client.id) ?? null),
  )
}
