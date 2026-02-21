'use client'

/**
 * OnboardingWizard — multi-step setup flow for new tenants.
 *
 * Each step shows relevant configuration with clear CTAs.
 * Progress is persisted to the server (DB) with localStorage fallback.
 * Users can skip the wizard entirely or complete steps in any order.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Palette,
  Bot,
  Tag,
  Plug,
  BarChart3,
  Rocket,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  CheckCircle2,
  Circle,
  ExternalLink,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { buildDashboardHref } from '@/lib/dashboard/link'
import {
  getOnboardingState,
  completeStep as completeStepLocal,
  skipOnboarding as skipOnboardingLocal,
  saveOnboardingState,
  getCompletionPercent,
  ONBOARDING_STEPS,
  type OnboardingStep,
  type OnboardingState,
} from '@/lib/dashboard/onboarding-state'

// ── Props ────────────────────────────────────────────────────────────────────

interface OnboardingWizardProps {
  tenantId: string
  tenantSlug?: string | null
  tenantName?: string
}

// ── Step icons ───────────────────────────────────────────────────────────────

const STEP_ICONS: Record<OnboardingStep, React.ElementType> = {
  branding: Palette,
  ai_settings: Bot,
  services: Tag,
  integrations: Plug,
  reporting: BarChart3,
  launch: Rocket,
}

// ── Server persistence helpers ───────────────────────────────────────────────

async function fetchServerState(): Promise<OnboardingState | null> {
  try {
    const res = await fetch('/api/onboarding', { cache: 'no-store' })
    if (!res.ok) return null
    const json = await res.json()
    return json.state ?? null
  } catch {
    return null
  }
}

async function persistToServer(
  action: 'complete_step' | 'dismiss' | 'upsert',
  payload: { step?: OnboardingStep; state?: OnboardingState },
): Promise<boolean> {
  try {
    const res = await fetch('/api/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    })
    if (!res.ok) return false
    const json = await res.json()
    return json.persisted === true
  } catch {
    return false
  }
}

// ── Step content panels ──────────────────────────────────────────────────────

function BrandingStep({ tenantSlug }: { tenantSlug?: string | null }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--brand-text)]">
        Your clinic&apos;s brand identity is already set up from your account configuration.
        You can customize the theme and accent color at any time.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href={buildDashboardHref('/dashboard/settings', tenantSlug)}>
          <Button variant="outline" size="sm">
            Customize theme
            <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </div>
    </div>
  )
}

function AiSettingsStep() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--brand-text)]">
        Configure your AI receptionist&apos;s behavior — business hours, fallback phone number,
        and supported languages.
      </p>
      <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-3">
        <p className="text-xs text-[var(--brand-muted)]">
          AI settings are managed through your Servify admin panel. Contact your account manager
          to update these settings.
        </p>
      </div>
    </div>
  )
}

function ServicesStep({ tenantSlug }: { tenantSlug?: string | null }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--brand-text)]">
        Add your top services so the dashboard can attribute revenue to specific treatments.
        This powers the ROI reports and booking proof table.
      </p>
      <Link href={buildDashboardHref('/dashboard/settings', tenantSlug)}>
        <Button variant="brand" size="sm">
          <Tag className="h-3.5 w-3.5" />
          Add services
        </Button>
      </Link>
    </div>
  )
}

function IntegrationsStep({ tenantSlug }: { tenantSlug?: string | null }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--brand-text)]">
        Connect your CRM, booking system, or custom webhook to sync call data
        and appointments automatically.
      </p>
      <Link href={buildDashboardHref('/dashboard/integrations', tenantSlug)}>
        <Button variant="brand" size="sm">
          <Plug className="h-3.5 w-3.5" />
          Set up integrations
        </Button>
      </Link>
    </div>
  )
}

function ReportingStep({ tenantSlug }: { tenantSlug?: string | null }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--brand-text)]">
        Review your reporting configuration. Visit the Reports page to see
        executive summaries, ROI calculations, and booking proof.
      </p>
      <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--brand-muted)]">Receptionist hourly rate</span>
          <span className="font-medium text-[var(--brand-text)]">$22/hr (default)</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--brand-muted)]">Subscription cost</span>
          <span className="font-medium text-[var(--brand-text)]">$999/mo (default)</span>
        </div>
        <p className="text-[10px] text-[var(--brand-muted)]">
          These defaults are used in ROI calculations. Custom values coming soon.
        </p>
      </div>
      <Link href={buildDashboardHref('/dashboard/reports', tenantSlug)}>
        <Button variant="outline" size="sm">
          <BarChart3 className="h-3.5 w-3.5" />
          View reports
        </Button>
      </Link>
    </div>
  )
}

// ── Client-Ready Checklist (Launch step) ─────────────────────────────────────

interface ChecklistItem {
  label: string
  step: OnboardingStep
  href: string
}

const CLIENT_CHECKLIST: ChecklistItem[] = [
  { label: 'Branding & theme configured', step: 'branding', href: '/dashboard/settings' },
  { label: 'AI receptionist settings reviewed', step: 'ai_settings', href: '/dashboard/settings' },
  { label: 'Services & pricing added', step: 'services', href: '/dashboard/settings' },
  { label: 'CRM/booking integration connected', step: 'integrations', href: '/dashboard/integrations' },
  { label: 'Reporting setup confirmed', step: 'reporting', href: '/dashboard/reports' },
]

function LaunchStep({
  state,
  tenantName,
  tenantSlug,
}: {
  state: OnboardingState
  tenantName?: string
  tenantSlug?: string | null
}) {
  const percent = getCompletionPercent(state)
  const allComplete = CLIENT_CHECKLIST.every((item) => state.completedSteps.includes(item.step))

  return (
    <div className="space-y-4">
      {allComplete ? (
        <div className="text-center py-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40 mx-auto mb-3">
            <Check className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-sm font-semibold text-[var(--brand-text)]">
            {tenantName ?? 'Your clinic'} is ready!
          </p>
          <p className="text-xs text-[var(--brand-muted)] mt-1">
            All setup steps are complete. Your AI receptionist is live.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-[var(--brand-text)]">
            Client-Ready Checklist
          </p>
          <p className="text-xs text-[var(--brand-muted)]">
            {percent}% complete — finish remaining items before going live.
          </p>
          <div className="space-y-1">
            {CLIENT_CHECKLIST.map((item) => {
              const done = state.completedSteps.includes(item.step)
              return (
                <Link
                  key={item.step}
                  href={buildDashboardHref(item.href, tenantSlug)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors',
                    done
                      ? 'bg-emerald-50 dark:bg-emerald-950/20'
                      : 'bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-950/30',
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0" />
                  )}
                  <span
                    className={cn(
                      'text-xs',
                      done
                        ? 'text-emerald-700 dark:text-emerald-300 line-through'
                        : 'text-amber-800 dark:text-amber-300',
                    )}
                  >
                    {item.label}
                  </span>
                  {!done && <ExternalLink className="h-3 w-3 ml-auto text-amber-500 shrink-0" />}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

const STEP_CONTENT: Record<
  OnboardingStep,
  React.ComponentType<{ tenantSlug?: string | null; state: OnboardingState; tenantName?: string }>
> = {
  branding: ({ tenantSlug }) => <BrandingStep tenantSlug={tenantSlug} />,
  ai_settings: () => <AiSettingsStep />,
  services: ({ tenantSlug }) => <ServicesStep tenantSlug={tenantSlug} />,
  integrations: ({ tenantSlug }) => <IntegrationsStep tenantSlug={tenantSlug} />,
  reporting: ({ tenantSlug }) => <ReportingStep tenantSlug={tenantSlug} />,
  launch: ({ state, tenantName, tenantSlug }) => (
    <LaunchStep state={state} tenantName={tenantName} tenantSlug={tenantSlug} />
  ),
}

// ── Wizard ───────────────────────────────────────────────────────────────────

export function OnboardingWizard({ tenantId, tenantSlug, tenantName }: OnboardingWizardProps) {
  const [state, setState] = useState<OnboardingState | null>(null)
  const [activeStep, setActiveStep] = useState<OnboardingStep>('branding')
  const [dismissed, setDismissed] = useState(false)
  const serverAvailable = useRef(false)

  // Hydrate: try server first, fall back to localStorage
  useEffect(() => {
    let cancelled = false

    async function init() {
      // 1. Try server
      const serverState = await fetchServerState()
      if (cancelled) return

      if (serverState) {
        serverAvailable.current = true
        setState(serverState)
        setActiveStep(serverState.currentStep)
        if (serverState.isComplete || serverState.skippedAt) setDismissed(true)
        // Sync to localStorage so it stays as fallback
        saveOnboardingState(tenantId, serverState)
        return
      }

      // 2. Fall back to localStorage
      const localState = getOnboardingState(tenantId)
      setState(localState)
      setActiveStep(localState.currentStep)
      if (localState.isComplete || localState.skippedAt) setDismissed(true)
    }

    init()
    return () => { cancelled = true }
  }, [tenantId])

  const handleComplete = useCallback(
    async (step: OnboardingStep) => {
      // Optimistic localStorage update
      const updated = completeStepLocal(tenantId, step)
      setState(updated)

      // Auto-advance to next step
      const currentIdx = ONBOARDING_STEPS.findIndex((s) => s.key === step)
      if (currentIdx < ONBOARDING_STEPS.length - 1) {
        setActiveStep(ONBOARDING_STEPS[currentIdx + 1].key)
      }

      // Persist to server (best-effort, non-blocking)
      persistToServer('complete_step', { step })
    },
    [tenantId],
  )

  const handleSkip = useCallback(async () => {
    skipOnboardingLocal(tenantId)
    setDismissed(true)
    // Persist to server (best-effort)
    persistToServer('dismiss', {})
  }, [tenantId])

  // Don't render until hydrated or if dismissed
  if (!state || dismissed) return null

  const activeStepMeta = ONBOARDING_STEPS.find((s) => s.key === activeStep)!
  const activeIdx = ONBOARDING_STEPS.findIndex((s) => s.key === activeStep)
  const percent = getCompletionPercent(state)
  const StepContent = STEP_CONTENT[activeStep]

  return (
    <Card className="relative overflow-hidden">
      {/* Progress bar */}
      <div className="h-1 bg-[var(--brand-border)]">
        <div
          className="h-full bg-[var(--brand-primary)] transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--brand-text)] flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--brand-accent)]" />
              Get Started with Servify
            </h3>
            <p className="text-[11px] text-[var(--brand-muted)] mt-0.5">
              {percent}% complete — {ONBOARDING_STEPS.length - state.completedSteps.length} steps remaining
            </p>
          </div>
          <button
            onClick={handleSkip}
            className="shrink-0 text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors p-1"
            aria-label="Dismiss setup wizard"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex gap-1 mb-5">
          {ONBOARDING_STEPS.map((step) => {
            const isCompleted = state.completedSteps.includes(step.key)
            const isActive = step.key === activeStep
            const Icon = STEP_ICONS[step.key]

            return (
              <button
                key={step.key}
                onClick={() => setActiveStep(step.key)}
                className={cn(
                  'flex-1 flex flex-col items-center gap-1 rounded-lg py-2 transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]',
                  isActive && 'bg-[var(--user-accent-soft)]',
                  !isActive && 'hover:bg-[var(--brand-bg)]',
                )}
                aria-label={`${step.title}${isCompleted ? ' (completed)' : ''}`}
              >
                <div className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                  isCompleted && 'bg-emerald-100 dark:bg-emerald-950/40',
                  isActive && !isCompleted && 'bg-[var(--user-accent)]/10',
                  !isActive && !isCompleted && 'bg-[var(--brand-border)]/60',
                )}>
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Icon className={cn(
                      'h-3.5 w-3.5',
                      isActive ? 'text-[var(--user-accent)]' : 'text-[var(--brand-muted)]',
                    )} />
                  )}
                </div>
                <span className={cn(
                  'text-[9px] font-medium leading-tight',
                  isActive ? 'text-[var(--user-accent)]' : 'text-[var(--brand-muted)]',
                  isCompleted && 'text-emerald-600 dark:text-emerald-400',
                )}>
                  {step.title}
                </span>
              </button>
            )
          })}
        </div>

        {/* Active step content */}
        <div className="rounded-lg border border-[var(--brand-border)] p-4 mb-4">
          <h4 className="text-sm font-medium text-[var(--brand-text)] mb-1">
            {activeStepMeta.number}. {activeStepMeta.title}
          </h4>
          <p className="text-[11px] text-[var(--brand-muted)] mb-3">
            {activeStepMeta.description}
          </p>
          <StepContent tenantSlug={tenantSlug} state={state} tenantName={tenantName} />
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            disabled={activeIdx === 0}
            onClick={() => setActiveStep(ONBOARDING_STEPS[activeIdx - 1].key)}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back
          </Button>

          <div className="flex gap-2">
            {activeStep !== 'launch' && !state.completedSteps.includes(activeStep) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (activeIdx < ONBOARDING_STEPS.length - 1) {
                    setActiveStep(ONBOARDING_STEPS[activeIdx + 1].key)
                  }
                }}
              >
                Skip for now
              </Button>
            )}

            {activeStep !== 'launch' ? (
              <Button
                variant="brand"
                size="sm"
                onClick={() => handleComplete(activeStep)}
              >
                {state.completedSteps.includes(activeStep) ? 'Next' : 'Mark complete'}
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                variant="brand"
                size="sm"
                onClick={() => {
                  handleComplete('launch')
                  setDismissed(true)
                }}
              >
                <Rocket className="h-3.5 w-3.5" />
                Finish setup
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
