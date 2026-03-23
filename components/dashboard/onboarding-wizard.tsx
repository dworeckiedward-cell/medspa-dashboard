'use client'

/**
 * OnboardingWizard — Setup Summary & Go-Live flow for new tenants.
 *
 * Reflects a done-for-you model: Servify configures the system, the client
 * reviews their setup summary, optionally updates logo/services, and goes live.
 *
 * Step content is read-only / summary-driven. Technical setup (AI config,
 * integrations, webhooks) is shown as "Configured by Servify" — not as client tasks.
 *
 * Progress is persisted to the server (DB) with localStorage fallback.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Palette,
  ShieldCheck,
  Tag,
  BarChart3,
  Rocket,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  ImageIcon,
  Plug,
  Bot,
  FileBarChart,
  Phone,
  CalendarCheck,
  DollarSign,
  Loader2,
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
  CLIENT_VISIBLE_STEPS,
  type OnboardingStep,
  type OnboardingState,
} from '@/lib/dashboard/onboarding-state'

// ── Props ────────────────────────────────────────────────────────────────────

interface OnboardingWizardProps {
  tenantId: string
  tenantSlug?: string | null
  tenantName?: string
  tenantLogoUrl?: string | null
  tenantBrandColor?: string | null
}

// ── Step icons (for client-visible steps) ────────────────────────────────────

const STEP_ICONS: Record<OnboardingStep, React.ElementType> = {
  branding: Palette,
  ai_settings: ShieldCheck,
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

// ── Step 1: Welcome & Brand ──────────────────────────────────────────────────

function WelcomeBrandStep({
  tenantSlug,
  tenantName,
  tenantLogoUrl,
  tenantBrandColor,
}: {
  tenantSlug?: string | null
  tenantName?: string
  tenantLogoUrl?: string | null
  tenantBrandColor?: string | null
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--brand-text)]">
        Welcome to your Servify dashboard! We&apos;ve configured your clinic&apos;s brand identity.
        You can update your logo or customize the accent color anytime.
      </p>

      {/* Brand preview */}
      <div className="flex items-center gap-4 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-3">
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl overflow-hidden',
            !tenantLogoUrl && 'text-white text-lg font-bold',
          )}
          style={!tenantLogoUrl ? { background: tenantBrandColor ?? '#2563EB' } : undefined}
        >
          {tenantLogoUrl ? (
            <img src={tenantLogoUrl} alt="Logo" className="h-full w-full object-contain" />
          ) : (
            (tenantName ?? 'C').charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--brand-text)]">{tenantName ?? 'Your Clinic'}</p>
          <p className="text-[10px] text-[var(--brand-muted)]">
            {tenantLogoUrl ? 'Logo configured' : 'Using clinic initial — add a logo in Settings'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={buildDashboardHref('/dashboard/settings', tenantSlug)}>
          <Button variant="outline" size="sm">
            <ImageIcon className="h-3 w-3" />
            Update logo
          </Button>
        </Link>
        <Link href={buildDashboardHref('/dashboard/settings', tenantSlug)}>
          <Button variant="outline" size="sm">
            <Palette className="h-3 w-3" />
            Customize theme
          </Button>
        </Link>
      </div>
    </div>
  )
}

// ── Step 2: What's Configured ────────────────────────────────────────────────

function ConfiguredSummaryStep() {
  const items = [
    {
      icon: Bot,
      label: 'AI Receptionist',
      status: 'Configured by Servify',
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    },
    {
      icon: Plug,
      label: 'Booking & CRM Integration',
      status: 'Configured by Servify',
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    },
    {
      icon: FileBarChart,
      label: 'Reporting & Analytics',
      status: 'Enabled',
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    },
    {
      icon: Phone,
      label: 'Call Handling',
      status: 'Active',
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    },
  ]

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--brand-text)]">
        Servify has configured the core systems for your clinic. Here&apos;s a summary
        of what&apos;s set up and ready.
      </p>
      <div className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.label}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5',
                item.bg,
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', item.color)} />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-[var(--brand-text)]">{item.label}</span>
              </div>
              <span className={cn('text-[11px] font-medium', item.color)}>
                {item.status}
              </span>
            </div>
          )
        })}
      </div>
      <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-3">
        <p className="text-xs text-[var(--brand-muted)]">
          Need changes to any of these settings?{' '}
          <a
            href="mailto:team@servifylabs.com"
            className="font-medium text-[var(--brand-text)] underline underline-offset-2 hover:text-[var(--user-accent)] transition-colors"
          >
            Contact Servify
          </a>
        </p>
      </div>
    </div>
  )
}

// ── Step 3: Services Review ──────────────────────────────────────────────────

interface ServicePreview {
  id: string
  name: string
  category: string | null
  priceCents: number | null
  currency: string
}

function ServicesReviewStep({ tenantSlug }: { tenantSlug?: string | null }) {
  const [services, setServices] = useState<ServicePreview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/services')
        if (res.ok) {
          const json = await res.json()
          setServices(
            (json.services ?? [])
              .filter((s: { isActive?: boolean }) => s.isActive !== false)
              .slice(0, 10),
          )
        }
      } catch {
        // Silent — will show empty state
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-muted)]" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {services.length > 0 ? (
        <>
          <p className="text-sm text-[var(--brand-text)]">
            We&apos;ve preconfigured your services. Review and update if needed.
          </p>
          <div className="rounded-lg border border-[var(--brand-border)] divide-y divide-[var(--brand-border)] overflow-hidden">
            {services.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-medium text-[var(--brand-text)]">{s.name}</span>
                  {s.category && (
                    <span className="text-[10px] text-[var(--brand-muted)] ml-2">{s.category}</span>
                  )}
                </div>
                <span className="text-xs tabular-nums text-[var(--brand-muted)]">
                  {s.priceCents != null
                    ? new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: (s.currency || 'usd').toUpperCase(),
                        maximumFractionDigits: 0,
                      }).format(s.priceCents / 100)
                    : 'Quote'}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-4">
          <Tag className="h-6 w-6 text-[var(--brand-muted)] mx-auto mb-2 opacity-50" />
          <p className="text-sm text-[var(--brand-text)]">No services configured yet</p>
          <p className="text-xs text-[var(--brand-muted)] mt-0.5">
            Add your services to enable revenue attribution and performance tracking.
          </p>
        </div>
      )}
      <Link href={buildDashboardHref('/dashboard/settings', tenantSlug)}>
        <Button variant="outline" size="sm">
          <Tag className="h-3.5 w-3.5" />
          {services.length > 0 ? 'Edit services' : 'Add services'}
          <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
      </Link>
    </div>
  )
}

// ── Step 5: Reporting Overview ───────────────────────────────────────────────

function ReportingOverviewStep({ tenantSlug }: { tenantSlug?: string | null }) {
  const metrics = [
    { icon: Phone, label: 'Call volume & disposition', description: 'Track every inbound and outbound call' },
    { icon: CalendarCheck, label: 'Booking rate & conversion', description: 'See how many calls convert to appointments' },
    { icon: DollarSign, label: 'Revenue attribution', description: 'Attribute potential revenue to services and calls' },
    { icon: BarChart3, label: 'ROI proof', description: 'Executive summary comparing AI vs traditional receptionist costs' },
  ]

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--brand-text)]">
        Your dashboard tracks key performance metrics automatically. Here&apos;s what you&apos;ll see:
      </p>
      <div className="space-y-2">
        {metrics.map((m) => {
          const Icon = m.icon
          return (
            <div key={m.label} className="flex items-start gap-2.5 py-1">
              <Icon className="h-3.5 w-3.5 text-[var(--brand-muted)] mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-[var(--brand-text)]">{m.label}</p>
                <p className="text-[10px] text-[var(--brand-muted)]">{m.description}</p>
              </div>
            </div>
          )
        })}
      </div>
      <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-3 space-y-1.5">
        <p className="text-xs font-medium text-[var(--brand-text)]">ROI Assumptions</p>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--brand-muted)]">Receptionist hourly rate</span>
          <span className="font-medium text-[var(--brand-text)]">$22/hr (default)</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--brand-muted)]">Subscription cost</span>
          <span className="font-medium text-[var(--brand-text)]">$999/mo (default)</span>
        </div>
        <p className="text-[10px] text-[var(--brand-muted)]">
          Configured by Servify. Need changes?{' '}
          <a
            href="mailto:team@servifylabs.com"
            className="font-medium underline underline-offset-2 hover:text-[var(--brand-text)]"
          >
            Contact us
          </a>
        </p>
      </div>
      <Link href={buildDashboardHref('/dashboard/reports', tenantSlug)}>
        <Button variant="outline" size="sm">
          <BarChart3 className="h-3.5 w-3.5" />
          Preview reports
        </Button>
      </Link>
    </div>
  )
}

// ── Step 6: Go Live ──────────────────────────────────────────────────────────

interface ReadinessItem {
  label: string
  done: boolean
}

function GoLiveStep({
  state,
  tenantName,
  tenantSlug,
}: {
  state: OnboardingState
  tenantName?: string
  tenantSlug?: string | null
}) {
  const readiness: ReadinessItem[] = [
    { label: 'Branding reviewed', done: state.completedSteps.includes('branding') },
    { label: 'System configuration reviewed', done: state.completedSteps.includes('ai_settings') },
    { label: 'Services reviewed', done: state.completedSteps.includes('services') },
    { label: 'Reporting overview seen', done: state.completedSteps.includes('reporting') },
  ]

  const allReady = readiness.every((r) => r.done)

  return (
    <div className="space-y-4">
      {allReady ? (
        <div className="text-center py-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40 mx-auto mb-3">
            <Check className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-sm font-semibold text-[var(--brand-text)]">
            {tenantName ?? 'Your clinic'} is launch ready!
          </p>
          <p className="text-xs text-[var(--brand-muted)] mt-1">
            Your AI receptionist is live and your dashboard is ready. Enter your dashboard to explore.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-[var(--brand-text)]">
            Setup Summary
          </p>
          <p className="text-xs text-[var(--brand-muted)]">
            Review the items below before entering your dashboard.
          </p>
          <div className="space-y-1">
            {readiness.map((item) => (
              <div
                key={item.label}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2',
                  item.done
                    ? 'bg-emerald-50 dark:bg-emerald-950/20'
                    : 'bg-[var(--brand-bg)]',
                )}
              >
                <CheckCircle2
                  className={cn(
                    'h-4 w-4 shrink-0',
                    item.done
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-[var(--brand-border)]',
                  )}
                />
                <span
                  className={cn(
                    'text-xs',
                    item.done
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-[var(--brand-muted)]',
                  )}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step content registry ────────────────────────────────────────────────────

const STEP_CONTENT: Record<
  OnboardingStep,
  React.ComponentType<{
    tenantSlug?: string | null
    state: OnboardingState
    tenantName?: string
    tenantLogoUrl?: string | null
    tenantBrandColor?: string | null
  }>
> = {
  branding: ({ tenantSlug, tenantName, tenantLogoUrl, tenantBrandColor }) => (
    <WelcomeBrandStep
      tenantSlug={tenantSlug}
      tenantName={tenantName}
      tenantLogoUrl={tenantLogoUrl}
      tenantBrandColor={tenantBrandColor}
    />
  ),
  ai_settings: () => <ConfiguredSummaryStep />,
  services: ({ tenantSlug }) => <ServicesReviewStep tenantSlug={tenantSlug} />,
  integrations: () => <ConfiguredSummaryStep />,
  reporting: ({ tenantSlug }) => <ReportingOverviewStep tenantSlug={tenantSlug} />,
  launch: ({ state, tenantName, tenantSlug }) => (
    <GoLiveStep state={state} tenantName={tenantName} tenantSlug={tenantSlug} />
  ),
}

// ── Wizard ───────────────────────────────────────────────────────────────────

export function OnboardingWizard({
  tenantId,
  tenantSlug,
  tenantName,
  tenantLogoUrl,
  tenantBrandColor,
}: OnboardingWizardProps) {
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
        // Auto-complete integrations (managed by Servify)
        if (!serverState.completedSteps.includes('integrations')) {
          serverState.completedSteps.push('integrations')
        }
        setState(serverState)
        // Navigate to first visible uncompleted step
        const firstUncompleted = CLIENT_VISIBLE_STEPS.find(
          (s) => !serverState.completedSteps.includes(s.key),
        )
        setActiveStep(firstUncompleted?.key ?? serverState.currentStep)
        if (serverState.isComplete || serverState.skippedAt) setDismissed(true)
        saveOnboardingState(tenantId, serverState)
        return
      }

      // 2. Fall back to localStorage
      const localState = getOnboardingState(tenantId)
      // Auto-complete integrations (managed by Servify)
      if (!localState.completedSteps.includes('integrations')) {
        localState.completedSteps.push('integrations')
        saveOnboardingState(tenantId, localState)
      }
      setState(localState)
      const firstUncompleted = CLIENT_VISIBLE_STEPS.find(
        (s) => !localState.completedSteps.includes(s.key),
      )
      setActiveStep(firstUncompleted?.key ?? localState.currentStep)
      if (localState.isComplete || localState.skippedAt) setDismissed(true)
    }

    init()
    return () => {
      cancelled = true
    }
  }, [tenantId])

  const handleComplete = useCallback(
    async (step: OnboardingStep) => {
      // Optimistic localStorage update
      const updated = completeStepLocal(tenantId, step)
      setState(updated)

      // Auto-advance to next visible step
      const visibleIdx = CLIENT_VISIBLE_STEPS.findIndex((s) => s.key === step)
      if (visibleIdx < CLIENT_VISIBLE_STEPS.length - 1) {
        setActiveStep(CLIENT_VISIBLE_STEPS[visibleIdx + 1].key)
      }

      // Persist to server (best-effort, non-blocking)
      persistToServer('complete_step', { step })
    },
    [tenantId],
  )

  const handleSkip = useCallback(async () => {
    skipOnboardingLocal(tenantId)
    setDismissed(true)
    persistToServer('dismiss', {})
  }, [tenantId])

  // Don't render until hydrated or if dismissed
  if (!state || dismissed) return null

  const visibleSteps = CLIENT_VISIBLE_STEPS
  const activeStepMeta = ONBOARDING_STEPS.find((s) => s.key === activeStep)!
  const visibleIdx = visibleSteps.findIndex((s) => s.key === activeStep)
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
              Setup Summary
            </h3>
            <p className="text-[11px] text-[var(--brand-muted)] mt-0.5">
              {percent}% complete — review your setup before going live
            </p>
          </div>
          <button
            onClick={handleSkip}
            className="shrink-0 text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors p-1"
            aria-label="Dismiss setup summary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step indicators (client-visible only — excludes integrations) */}
        <div className="flex gap-1 mb-5">
          {visibleSteps.map((step) => {
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
                <div
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                    isCompleted && 'bg-emerald-100 dark:bg-emerald-950/40',
                    isActive && !isCompleted && 'bg-[var(--user-accent)]/10',
                    !isActive && !isCompleted && 'bg-[var(--brand-border)]/60',
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Icon
                      className={cn(
                        'h-3.5 w-3.5',
                        isActive ? 'text-[var(--user-accent)]' : 'text-[var(--brand-muted)]',
                      )}
                    />
                  )}
                </div>
                <span
                  className={cn(
                    'text-[9px] font-medium leading-tight',
                    isActive ? 'text-[var(--user-accent)]' : 'text-[var(--brand-muted)]',
                    isCompleted && 'text-emerald-600 dark:text-emerald-400',
                  )}
                >
                  {step.title}
                </span>
              </button>
            )
          })}
        </div>

        {/* Active step content */}
        <div className="rounded-lg border border-[var(--brand-border)] p-4 mb-4">
          <h4 className="text-sm font-medium text-[var(--brand-text)] mb-1">
            {activeStepMeta.title}
          </h4>
          <p className="text-[11px] text-[var(--brand-muted)] mb-3">
            {activeStepMeta.description}
          </p>
          <StepContent
            tenantSlug={tenantSlug}
            state={state}
            tenantName={tenantName}
            tenantLogoUrl={tenantLogoUrl}
            tenantBrandColor={tenantBrandColor}
          />
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            disabled={visibleIdx <= 0}
            onClick={() => {
              if (visibleIdx > 0) {
                setActiveStep(visibleSteps[visibleIdx - 1].key)
              }
            }}
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
                  if (visibleIdx < visibleSteps.length - 1) {
                    setActiveStep(visibleSteps[visibleIdx + 1].key)
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
                {state.completedSteps.includes(activeStep) ? 'Next' : 'Looks good'}
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
                Enter Dashboard
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
