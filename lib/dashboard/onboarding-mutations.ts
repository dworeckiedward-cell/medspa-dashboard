/**
 * Onboarding Mutations — server-side writes for onboarding state.
 *
 * All writes are tenant-scoped. If the table doesn't exist
 * (migration not applied), mutations return false and the
 * wizard falls back to localStorage.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { OnboardingStep, OnboardingState } from './onboarding-state'
import { ONBOARDING_STEPS } from './onboarding-state'

// ── Upsert onboarding state ─────────────────────────────────────────────────

/**
 * Upsert the full onboarding state for a tenant.
 * Uses `client_id` as the conflict key (unique).
 * Returns true on success, false on any error.
 */
export async function upsertOnboardingState(
  tenantId: string,
  state: OnboardingState,
): Promise<boolean> {
  try {
    const supabase = createSupabaseServerClient()
    const { error } = await supabase
      .from('client_onboarding_state')
      .upsert(
        {
          client_id: tenantId,
          current_step: state.currentStep,
          completed_steps: state.completedSteps,
          is_completed: state.isComplete,
          completed_at: state.isComplete ? new Date().toISOString() : null,
          dismissed_at: state.skippedAt ?? null,
        },
        { onConflict: 'client_id' },
      )

    return !error
  } catch {
    return false
  }
}

// ── Complete a single step ──────────────────────────────────────────────────

/**
 * Mark a step as completed server-side. Reads current state, appends step,
 * advances currentStep, and writes back.
 * Returns the updated state or null on failure.
 */
export async function completeStepOnServer(
  tenantId: string,
  step: OnboardingStep,
): Promise<OnboardingState | null> {
  try {
    const supabase = createSupabaseServerClient()

    // Read current
    const { data } = await supabase
      .from('client_onboarding_state')
      .select('completed_steps, current_step')
      .eq('client_id', tenantId)
      .maybeSingle()

    const completedSteps: OnboardingStep[] = (data?.completed_steps as OnboardingStep[] ?? [])
    if (!completedSteps.includes(step)) {
      completedSteps.push(step)
    }

    const nextStep = ONBOARDING_STEPS.find((s) => !completedSteps.includes(s.key))
    const currentStep = nextStep?.key ?? 'launch'
    const isComplete = completedSteps.length >= ONBOARDING_STEPS.length

    const newState: OnboardingState = {
      completedSteps,
      currentStep,
      isComplete,
    }

    const ok = await upsertOnboardingState(tenantId, newState)
    return ok ? newState : null
  } catch {
    return null
  }
}

// ── Dismiss/skip ────────────────────────────────────────────────────────────

/**
 * Mark the wizard as dismissed for a tenant.
 */
export async function dismissOnboardingOnServer(tenantId: string): Promise<boolean> {
  try {
    const supabase = createSupabaseServerClient()
    const { error } = await supabase
      .from('client_onboarding_state')
      .upsert(
        {
          client_id: tenantId,
          current_step: 'branding',
          completed_steps: [],
          is_completed: false,
          dismissed_at: new Date().toISOString(),
        },
        { onConflict: 'client_id' },
      )

    return !error
  } catch {
    return false
  }
}
