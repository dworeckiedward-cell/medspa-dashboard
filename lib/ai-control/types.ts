/**
 * AI System Control — Domain Types
 *
 * Defines the operating modes, fallback strategies, and control state
 * that tenants use to manage their AI receptionist ("Sarah").
 *
 * External systems (Retell, n8n, etc.) must read the authoritative state
 * from the clients table — this module does NOT push to providers.
 */

// ── Operating modes ─────────────────────────────────────────────────────────

/** Master operating mode for the AI system. */
export type AiOperatingMode =
  | 'live'           // Fully active — handles all calls
  | 'paused'         // Temporarily disabled — all calls go to fallback
  | 'outbound_only'  // Only outbound campaigns run; inbound → fallback
  | 'inbound_only'   // Only inbound answered; outbound campaigns halted
  | 'maintenance'    // System maintenance — ops-initiated, tenant-visible

export const AI_OPERATING_MODE_LABELS: Record<AiOperatingMode, string> = {
  live: 'Live',
  paused: 'Paused',
  outbound_only: 'Outbound Only',
  inbound_only: 'Inbound Only',
  maintenance: 'Maintenance',
}

export const AI_OPERATING_MODE_DESCRIPTIONS: Record<AiOperatingMode, string> = {
  live: 'AI receptionist is fully active and handling all calls.',
  paused: 'AI is temporarily disabled. All calls routed to fallback.',
  outbound_only: 'Only outbound campaigns are running. Inbound calls go to fallback.',
  inbound_only: 'Only inbound calls are answered. Outbound campaigns are paused.',
  maintenance: 'System is under maintenance. All calls routed to fallback.',
}

// ── Fallback modes ──────────────────────────────────────────────────────────

/** What happens to calls when AI is paused or unavailable. */
export type AiFallbackMode =
  | 'human_handoff'   // Route to a human receptionist or on-call staff
  | 'voicemail_only'  // Send to voicemail
  | 'capture_only'    // Capture caller info only, no live interaction
  | 'disabled'        // No fallback — calls are simply not answered

export const AI_FALLBACK_MODE_LABELS: Record<AiFallbackMode, string> = {
  human_handoff: 'Human Handoff',
  voicemail_only: 'Voicemail Only',
  capture_only: 'Capture Only',
  disabled: 'Disabled',
}

export const AI_FALLBACK_MODE_DESCRIPTIONS: Record<AiFallbackMode, string> = {
  human_handoff: 'Route unanswered calls to a human receptionist or on-call staff.',
  voicemail_only: 'Send unanswered calls to voicemail.',
  capture_only: 'Capture caller info (name, number) without live interaction.',
  disabled: 'No fallback — calls are not answered when AI is off.',
}

// ── Pause reasons ───────────────────────────────────────────────────────────

/** Categorized reason for pausing the AI system. */
export type AiPauseReason =
  | 'holiday'           // Office closed for holiday
  | 'staff_preference'  // Staff prefers to answer calls manually
  | 'testing'           // Testing changes before going live
  | 'billing_issue'     // Payment issue (ops-initiated)
  | 'other'             // Free-form reason

export const AI_PAUSE_REASON_LABELS: Record<AiPauseReason, string> = {
  holiday: 'Holiday / Office Closed',
  staff_preference: 'Staff Preference',
  testing: 'Testing',
  billing_issue: 'Billing Issue',
  other: 'Other',
}

// ── Control state (matches DB columns) ──────────────────────────────────────

/** The persisted AI control state stored on the clients table. */
export interface AiControlState {
  /** Master on/off toggle. When false, operating_mode is effectively 'paused'. */
  ai_enabled: boolean

  /** Current operating mode. */
  ai_operating_mode: AiOperatingMode

  /** Fallback strategy when AI is paused or unavailable. */
  ai_fallback_mode: AiFallbackMode

  /** Categorized pause reason (null when ai_enabled = true). */
  ai_pause_reason: AiPauseReason | null

  /** Free-form note explaining pause (null when ai_enabled = true). */
  ai_pause_note: string | null

  /** ISO 8601 timestamp for automatic resume (null = no auto-resume). */
  ai_auto_resume_at: string | null

  /** ISO 8601 timestamp of the last control state change. */
  ai_control_updated_at: string | null

  /** Who last changed the control state (user ID or 'ops'). */
  ai_control_updated_by: string | null
}

/** Default AI control state for new tenants or when columns are null. */
export const DEFAULT_AI_CONTROL_STATE: AiControlState = {
  ai_enabled: true,
  ai_operating_mode: 'live',
  ai_fallback_mode: 'voicemail_only',
  ai_pause_reason: null,
  ai_pause_note: null,
  ai_auto_resume_at: null,
  ai_control_updated_at: null,
  ai_control_updated_by: null,
}

// ── Effective status (derived, not stored) ──────────────────────────────────

/**
 * High-level effective status derived from control state.
 * Used for dashboard banners, ops watchlists, and status badges.
 */
export type AiEffectiveStatus =
  | 'active'           // AI is live and handling calls
  | 'paused'           // AI is paused (manually or by mode)
  | 'partial'          // AI is running in a partial mode (inbound_only / outbound_only)
  | 'maintenance'      // System is under maintenance
  | 'auto_resume_soon' // Paused but will auto-resume soon

export const AI_EFFECTIVE_STATUS_LABELS: Record<AiEffectiveStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  partial: 'Partial',
  maintenance: 'Maintenance',
  auto_resume_soon: 'Resuming Soon',
}

/** Color tokens for status badges (Tailwind-compatible). */
export const AI_EFFECTIVE_STATUS_COLORS: Record<AiEffectiveStatus, {
  bg: string
  text: string
  dot: string
}> = {
  active: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  paused: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  partial: { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
  maintenance: { bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
  auto_resume_soon: { bg: 'bg-violet-50 dark:bg-violet-950/30', text: 'text-violet-700 dark:text-violet-400', dot: 'bg-violet-500' },
}

// ── Ops watchlist row (cross-tenant) ────────────────────────────────────────

export interface AiControlWatchlistRow {
  clientId: string
  clientName: string
  clientSlug: string
  controlState: AiControlState
  effectiveStatus: AiEffectiveStatus
}
