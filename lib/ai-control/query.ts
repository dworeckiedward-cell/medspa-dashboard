/**
 * AI System Control — Read Operations
 *
 * Server-only. Uses service-role Supabase client.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { deriveEffectiveStatus } from './effective-status'
import { DEFAULT_AI_CONTROL_STATE } from './types'
import type { AiControlState, AiControlWatchlistRow } from './types'

// ── Column list (for select) ────────────────────────────────────────────────

const AI_CONTROL_COLUMNS = [
  'ai_enabled',
  'ai_operating_mode',
  'ai_fallback_mode',
  'ai_pause_reason',
  'ai_pause_note',
  'ai_auto_resume_at',
  'ai_control_updated_at',
  'ai_control_updated_by',
] as const

const AI_CONTROL_SELECT = AI_CONTROL_COLUMNS.join(', ')

// ── Mapper ──────────────────────────────────────────────────────────────────

/** Map a DB row (with nullable AI columns) to an AiControlState. */
function mapControlState(row: Record<string, unknown>): AiControlState {
  return {
    ai_enabled: row.ai_enabled != null ? Boolean(row.ai_enabled) : DEFAULT_AI_CONTROL_STATE.ai_enabled,
    ai_operating_mode: (row.ai_operating_mode as AiControlState['ai_operating_mode']) ?? DEFAULT_AI_CONTROL_STATE.ai_operating_mode,
    ai_fallback_mode: (row.ai_fallback_mode as AiControlState['ai_fallback_mode']) ?? DEFAULT_AI_CONTROL_STATE.ai_fallback_mode,
    ai_pause_reason: (row.ai_pause_reason as AiControlState['ai_pause_reason']) ?? null,
    ai_pause_note: (row.ai_pause_note as string) ?? null,
    ai_auto_resume_at: (row.ai_auto_resume_at as string) ?? null,
    ai_control_updated_at: (row.ai_control_updated_at as string) ?? null,
    ai_control_updated_by: (row.ai_control_updated_by as string) ?? null,
  }
}

// ── Tenant-scoped query ─────────────────────────────────────────────────────

/**
 * Get the AI control state for a specific tenant.
 * Returns defaults if the columns haven't been populated yet.
 */
export async function getAiControlState(clientId: string): Promise<AiControlState> {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('clients')
    .select(AI_CONTROL_SELECT)
    .eq('id', clientId)
    .single()

  if (error || !data) {
    // Graceful fallback — migration may not be applied yet
    return { ...DEFAULT_AI_CONTROL_STATE }
  }

  return mapControlState(data as unknown as Record<string, unknown>)
}

// ── Ops cross-tenant query ──────────────────────────────────────────────────

/**
 * Get AI control states for all active clients (ops watchlist).
 * Returns rows sorted by effective status severity, then client name.
 */
export async function listAllAiControlStates(): Promise<AiControlWatchlistRow[]> {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('clients')
    .select(`id, name, slug, ${AI_CONTROL_SELECT}`)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error || !data) return []

  const rows: AiControlWatchlistRow[] = (data as unknown as Record<string, unknown>[]).map((row) => {
    const controlState = mapControlState(row)
    return {
      clientId: row.id as string,
      clientName: row.name as string,
      clientSlug: row.slug as string,
      controlState,
      effectiveStatus: deriveEffectiveStatus(controlState),
    }
  })

  // Sort: non-active statuses first (paused, maintenance, partial), then active
  const statusPriority: Record<string, number> = {
    maintenance: 0,
    paused: 1,
    auto_resume_soon: 2,
    partial: 3,
    active: 4,
  }

  rows.sort((a, b) => {
    const aPri = statusPriority[a.effectiveStatus] ?? 5
    const bPri = statusPriority[b.effectiveStatus] ?? 5
    if (aPri !== bPri) return aPri - bPri
    return a.clientName.localeCompare(b.clientName)
  })

  return rows
}
