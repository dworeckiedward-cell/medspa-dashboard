/**
 * AI System Control — Write Operations
 *
 * Server-only. Uses service-role Supabase client.
 * All mutations update the clients table directly.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { AiControlState, AiOperatingMode, AiFallbackMode, AiPauseReason } from './types'

// ── Update payload ──────────────────────────────────────────────────────────

/** Partial update — only includes fields the caller wants to change. */
export interface AiControlUpdate {
  ai_enabled?: boolean
  ai_operating_mode?: AiOperatingMode
  ai_fallback_mode?: AiFallbackMode
  ai_pause_reason?: AiPauseReason | null
  ai_pause_note?: string | null
  ai_auto_resume_at?: string | null
}

// ── Mutation ────────────────────────────────────────────────────────────────

/**
 * Update the AI control state for a tenant.
 *
 * - Merges the partial update with the current state
 * - Stamps ai_control_updated_at and ai_control_updated_by
 * - Returns the full updated state
 *
 * Does NOT push to external providers (Retell, n8n, etc.).
 * External systems must poll or webhook-subscribe to read the authoritative state.
 */
export async function updateAiControlState(
  clientId: string,
  update: AiControlUpdate,
  updatedBy: string,
): Promise<AiControlState | null> {
  const supabase = createSupabaseServerClient()
  const now = new Date().toISOString()

  // Build the DB update payload
  const dbUpdate: Record<string, unknown> = {
    ai_control_updated_at: now,
    ai_control_updated_by: updatedBy,
    updated_at: now,
  }

  if (update.ai_enabled !== undefined) dbUpdate.ai_enabled = update.ai_enabled
  if (update.ai_operating_mode !== undefined) dbUpdate.ai_operating_mode = update.ai_operating_mode
  if (update.ai_fallback_mode !== undefined) dbUpdate.ai_fallback_mode = update.ai_fallback_mode
  if (update.ai_pause_reason !== undefined) dbUpdate.ai_pause_reason = update.ai_pause_reason
  if (update.ai_pause_note !== undefined) dbUpdate.ai_pause_note = update.ai_pause_note
  if (update.ai_auto_resume_at !== undefined) dbUpdate.ai_auto_resume_at = update.ai_auto_resume_at

  // When enabling, clear pause-related fields
  if (update.ai_enabled === true) {
    dbUpdate.ai_pause_reason = null
    dbUpdate.ai_pause_note = null
    dbUpdate.ai_auto_resume_at = null
    if (!update.ai_operating_mode) {
      dbUpdate.ai_operating_mode = 'live'
    }
  }

  const { data, error } = await supabase
    .from('clients')
    .update(dbUpdate)
    .eq('id', clientId)
    .select('ai_enabled, ai_operating_mode, ai_fallback_mode, ai_pause_reason, ai_pause_note, ai_auto_resume_at, ai_control_updated_at, ai_control_updated_by')
    .single()

  if (error || !data) return null

  const row = data as Record<string, unknown>
  return {
    ai_enabled: Boolean(row.ai_enabled),
    ai_operating_mode: (row.ai_operating_mode as AiControlState['ai_operating_mode']) ?? 'live',
    ai_fallback_mode: (row.ai_fallback_mode as AiControlState['ai_fallback_mode']) ?? 'voicemail_only',
    ai_pause_reason: (row.ai_pause_reason as AiControlState['ai_pause_reason']) ?? null,
    ai_pause_note: (row.ai_pause_note as string) ?? null,
    ai_auto_resume_at: (row.ai_auto_resume_at as string) ?? null,
    ai_control_updated_at: (row.ai_control_updated_at as string) ?? null,
    ai_control_updated_by: (row.ai_control_updated_by as string) ?? null,
  }
}
