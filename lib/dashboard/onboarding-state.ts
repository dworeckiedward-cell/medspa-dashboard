/**
 * Onboarding State — localStorage-backed scaffold.
 *
 * Tracks wizard step completion per-tenant. Future-ready for DB persistence.
 *
 * TODO: Replace localStorage with a `client_onboarding` table when ready:
 *   CREATE TABLE client_onboarding (
 *     client_id UUID PRIMARY KEY REFERENCES clients(id),
 *     completed_steps TEXT[] DEFAULT '{}',
 *     is_complete BOOLEAN DEFAULT FALSE,
 *     updated_at TIMESTAMPTZ DEFAULT NOW()
 *   );
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type OnboardingStep =
  | 'branding'
  | 'ai_settings'
  | 'services'
  | 'integrations'
  | 'reporting'
  | 'launch'

export interface OnboardingState {
  completedSteps: OnboardingStep[]
  isComplete: boolean
  currentStep: OnboardingStep
  skippedAt?: string // ISO timestamp if wizard was dismissed
}

export interface OnboardingStepMeta {
  key: OnboardingStep
  title: string
  description: string
  /** Number starting from 1 */
  number: number
}

export const ONBOARDING_STEPS: OnboardingStepMeta[] = [
  {
    key: 'branding',
    number: 1,
    title: 'Branding',
    description: 'Set your clinic name, logo, and accent color',
  },
  {
    key: 'ai_settings',
    number: 2,
    title: 'AI Settings',
    description: 'Configure business hours and fallback phone',
  },
  {
    key: 'services',
    number: 3,
    title: 'Services & Pricing',
    description: 'Add your top services for revenue attribution',
  },
  {
    key: 'integrations',
    number: 4,
    title: 'Integrations',
    description: 'Connect your CRM or booking system',
  },
  {
    key: 'reporting',
    number: 5,
    title: 'Reporting Setup',
    description: 'Set receptionist rate and subscription cost for ROI',
  },
  {
    key: 'launch',
    number: 6,
    title: 'Launch',
    description: 'Review your setup and go live',
  },
]

// ── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'servify-onboarding'

function getStorageKey(tenantId: string): string {
  return `${STORAGE_KEY}-${tenantId}`
}

export function getOnboardingState(tenantId: string): OnboardingState {
  if (typeof window === 'undefined') {
    return { completedSteps: [], isComplete: false, currentStep: 'branding' }
  }

  try {
    const raw = localStorage.getItem(getStorageKey(tenantId))
    if (!raw) return { completedSteps: [], isComplete: false, currentStep: 'branding' }
    const parsed = JSON.parse(raw) as OnboardingState
    return parsed
  } catch {
    return { completedSteps: [], isComplete: false, currentStep: 'branding' }
  }
}

export function saveOnboardingState(tenantId: string, state: OnboardingState): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(getStorageKey(tenantId), JSON.stringify(state))
}

export function completeStep(tenantId: string, step: OnboardingStep): OnboardingState {
  const state = getOnboardingState(tenantId)
  if (!state.completedSteps.includes(step)) {
    state.completedSteps.push(step)
  }

  // Advance to next uncompleted step
  const nextStep = ONBOARDING_STEPS.find((s) => !state.completedSteps.includes(s.key))
  state.currentStep = nextStep?.key ?? 'launch'
  state.isComplete = state.completedSteps.length >= ONBOARDING_STEPS.length

  saveOnboardingState(tenantId, state)
  return state
}

export function skipOnboarding(tenantId: string): void {
  const state = getOnboardingState(tenantId)
  state.skippedAt = new Date().toISOString()
  saveOnboardingState(tenantId, state)
}

export function resetOnboarding(tenantId: string): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(getStorageKey(tenantId))
}

export function getCompletionPercent(state: OnboardingState): number {
  return Math.round((state.completedSteps.length / ONBOARDING_STEPS.length) * 100)
}
