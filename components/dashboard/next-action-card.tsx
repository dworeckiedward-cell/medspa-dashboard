'use client'

/**
 * NextActionCard — shows the next recommended action when setup is incomplete.
 *
 * Reads onboarding state from localStorage (fast, no flicker).
 * Auto-hides when all steps are complete or wizard was dismissed.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight, Sparkles, Tag, Plug, BarChart3, Palette, Bot, Rocket } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { buildDashboardHref } from '@/lib/dashboard/link'
import {
  getOnboardingState,
  getCompletionPercent,
  ONBOARDING_STEPS,
  type OnboardingStep,
} from '@/lib/dashboard/onboarding-state'

interface NextActionCardProps {
  tenantId: string
  tenantSlug?: string | null
}

const STEP_ACTIONS: Record<OnboardingStep, { label: string; href: string; icon: React.ElementType; description: string }> = {
  branding: {
    label: 'Configure branding',
    href: '/dashboard/settings',
    icon: Palette,
    description: 'Set your clinic theme and accent color for a branded experience.',
  },
  ai_settings: {
    label: 'Review AI settings',
    href: '/dashboard/settings',
    icon: Bot,
    description: 'Verify business hours and fallback behavior for your AI receptionist.',
  },
  services: {
    label: 'Add services & pricing',
    href: '/dashboard/settings',
    icon: Tag,
    description: 'Add your top services to enable revenue attribution and ROI tracking.',
  },
  integrations: {
    label: 'Connect integrations',
    href: '/dashboard/integrations',
    icon: Plug,
    description: 'Link your CRM or booking system for automatic data sync.',
  },
  reporting: {
    label: 'Set up reporting',
    href: '/dashboard/reports',
    icon: BarChart3,
    description: 'Review ROI parameters and executive report configuration.',
  },
  launch: {
    label: 'Finalize setup',
    href: '/dashboard/onboarding',
    icon: Rocket,
    description: 'Complete the client-ready checklist and go live.',
  },
}

export function NextActionCard({ tenantId, tenantSlug }: NextActionCardProps) {
  const [nextStep, setNextStep] = useState<OnboardingStep | null>(null)
  const [percent, setPercent] = useState(0)

  useEffect(() => {
    const state = getOnboardingState(tenantId)
    // Hide if complete or skipped
    if (state.isComplete || state.skippedAt) {
      setNextStep(null)
      return
    }

    const incomplete = ONBOARDING_STEPS.find((s) => !state.completedSteps.includes(s.key))
    setNextStep(incomplete?.key ?? null)
    setPercent(getCompletionPercent(state))
  }, [tenantId])

  if (!nextStep) return null

  const action = STEP_ACTIONS[nextStep]
  const Icon = action.icon

  return (
    <Card className="border-[var(--brand-primary)]/20 bg-[var(--brand-primary)]/[0.03]">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'var(--brand-primary)', color: 'white' }}
          >
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-xs font-semibold text-[var(--brand-text)]">Next recommended action</p>
              <span className="text-[10px] text-[var(--brand-muted)] tabular-nums">{percent}% setup complete</span>
            </div>
            <p className="text-xs text-[var(--brand-muted)] mb-2">{action.description}</p>
            <Link
              href={buildDashboardHref(action.href, tenantSlug)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--brand-primary)] hover:underline"
            >
              <Icon className="h-3.5 w-3.5" />
              {action.label}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
