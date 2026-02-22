/**
 * AI System Control — Effective Status Derivation
 *
 * Pure function that computes the high-level effective status
 * from the persisted control state. No IO, no side effects.
 */

import type { AiControlState, AiEffectiveStatus } from './types'

/**
 * Derive the effective status from the AI control state.
 *
 * Decision tree:
 *   1. ai_enabled = false → 'paused'
 *   2. ai_operating_mode = 'maintenance' → 'maintenance'
 *   3. ai_operating_mode = 'paused' → check auto_resume → 'auto_resume_soon' | 'paused'
 *   4. ai_operating_mode ∈ {inbound_only, outbound_only} → 'partial'
 *   5. ai_operating_mode = 'live' → 'active'
 */
export function deriveEffectiveStatus(state: AiControlState): AiEffectiveStatus {
  // Master toggle off → always paused
  if (!state.ai_enabled) {
    if (state.ai_auto_resume_at && isAutoResumeSoon(state.ai_auto_resume_at)) {
      return 'auto_resume_soon'
    }
    return 'paused'
  }

  switch (state.ai_operating_mode) {
    case 'maintenance':
      return 'maintenance'

    case 'paused':
      if (state.ai_auto_resume_at && isAutoResumeSoon(state.ai_auto_resume_at)) {
        return 'auto_resume_soon'
      }
      return 'paused'

    case 'inbound_only':
    case 'outbound_only':
      return 'partial'

    case 'live':
    default:
      return 'active'
  }
}

/**
 * Check if auto-resume is scheduled within the next 24 hours.
 * Returns false if the timestamp is in the past.
 */
function isAutoResumeSoon(isoTimestamp: string): boolean {
  const resumeAt = new Date(isoTimestamp).getTime()
  const now = Date.now()
  const twentyFourHours = 24 * 60 * 60 * 1000

  return resumeAt > now && resumeAt - now <= twentyFourHours
}

/**
 * Format the auto-resume timestamp for display.
 * Returns a human-readable relative or absolute time string.
 */
export function formatAutoResume(isoTimestamp: string | null): string | null {
  if (!isoTimestamp) return null

  const resumeAt = new Date(isoTimestamp)
  const now = new Date()
  const diffMs = resumeAt.getTime() - now.getTime()

  if (diffMs <= 0) return 'Overdue'

  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMinutes / 60)

  if (diffMinutes < 60) return `in ${diffMinutes}m`
  if (diffHours < 24) return `in ${diffHours}h ${diffMinutes % 60}m`

  return resumeAt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
