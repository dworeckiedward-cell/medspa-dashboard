/**
 * Onboarding Query — server-side read for onboarding state.
 *
 * Reads from `client_onboarding_state` table. Returns null if:
 * - no row exists for this tenant
 * - table doesn't exist (migration not applied)
 * - any Supabase error occurs
 *
 * The wizard component should fall back to localStorage when this returns null.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { OnboardingStep, OnboardingState } from './onboarding-state'

// ── DB row shape ─────────────────────────────────────────────────────────────

interface OnboardingRow {
  id: string
  client_id: string
  current_step: string
  completed_steps: string[]  // jsonb array
  payload: Record<string, unknown>
  is_completed: boolean
  completed_at: string | null
  dismissed_at: string | null
  created_at: string
  updated_at: string
}

// ── Query ────────────────────────────────────────────────────────────────────

/**
 * Fetch onboarding state for a tenant from the database.
 * Returns null if no row or table doesn't exist.
 */
export async function getOnboardingStateFromDb(
  tenantId: string,
): Promise<OnboardingState | null> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase
      .from('client_onboarding_state')
      .select('*')
      .eq('client_id', tenantId)
      .maybeSingle()

    if (error || !data) return null

    const row = data as OnboardingRow

    return {
      completedSteps: (row.completed_steps ?? []) as OnboardingStep[],
      isComplete: row.is_completed,
      currentStep: row.current_step as OnboardingStep,
      skippedAt: row.dismissed_at ?? undefined,
    }
  } catch {
    // Table might not exist if migration not applied
    return null
  }
}
