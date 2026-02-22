'use client'

import { useState, useEffect } from 'react'
import { Power, AlertTriangle, Clock, Zap, Wrench, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildTenantApiUrl } from '@/lib/dashboard/tenant-api'
import { deriveEffectiveStatus, formatAutoResume } from '@/lib/ai-control/effective-status'
import {
  AI_OPERATING_MODE_LABELS,
  AI_FALLBACK_MODE_LABELS,
  DEFAULT_AI_CONTROL_STATE,
} from '@/lib/ai-control/types'
import type { AiControlState, AiEffectiveStatus } from '@/lib/ai-control/types'

// ── Props ───────────────────────────────────────────────────────────────────

interface AiSystemStatusBannerProps {
  tenantSlug: string
}

// ── Banner config per status ────────────────────────────────────────────────

const BANNER_CONFIG: Record<AiEffectiveStatus, {
  icon: React.ElementType
  bgClass: string
  textClass: string
  borderClass: string
  getMessage: (state: AiControlState) => string
} | null> = {
  active: null, // No banner when active
  paused: {
    icon: AlertTriangle,
    bgClass: 'bg-amber-50 dark:bg-amber-950/20',
    textClass: 'text-amber-800 dark:text-amber-300',
    borderClass: 'border-amber-200 dark:border-amber-900/40',
    getMessage: (state) => {
      const fallback = AI_FALLBACK_MODE_LABELS[state.ai_fallback_mode]
      return `AI receptionist is paused. Calls are being handled via: ${fallback}.`
    },
  },
  partial: {
    icon: Zap,
    bgClass: 'bg-blue-50 dark:bg-blue-950/20',
    textClass: 'text-blue-800 dark:text-blue-300',
    borderClass: 'border-blue-200 dark:border-blue-900/40',
    getMessage: (state) => {
      const mode = AI_OPERATING_MODE_LABELS[state.ai_operating_mode]
      return `AI is running in ${mode} mode. Some call types may not be handled.`
    },
  },
  maintenance: {
    icon: Wrench,
    bgClass: 'bg-orange-50 dark:bg-orange-950/20',
    textClass: 'text-orange-800 dark:text-orange-300',
    borderClass: 'border-orange-200 dark:border-orange-900/40',
    getMessage: () => 'AI system is under maintenance. Calls are routed to fallback.',
  },
  auto_resume_soon: {
    icon: Clock,
    bgClass: 'bg-violet-50 dark:bg-violet-950/20',
    textClass: 'text-violet-800 dark:text-violet-300',
    borderClass: 'border-violet-200 dark:border-violet-900/40',
    getMessage: (state) => {
      const resumeText = formatAutoResume(state.ai_auto_resume_at)
      return `AI is paused and will auto-resume ${resumeText ?? 'soon'}.`
    },
  },
}

// ── Component ───────────────────────────────────────────────────────────────

export function AiSystemStatusBanner({ tenantSlug }: AiSystemStatusBannerProps) {
  const [state, setState] = useState<AiControlState | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const url = buildTenantApiUrl('/api/ai-control', tenantSlug)
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.ai_enabled !== undefined) {
          setState({
            ai_enabled: data.ai_enabled,
            ai_operating_mode: data.ai_operating_mode,
            ai_fallback_mode: data.ai_fallback_mode,
            ai_pause_reason: data.ai_pause_reason,
            ai_pause_note: data.ai_pause_note,
            ai_auto_resume_at: data.ai_auto_resume_at,
            ai_control_updated_at: data.ai_control_updated_at,
            ai_control_updated_by: data.ai_control_updated_by,
          })
        }
      })
      .catch(() => {
        // Graceful — don't show banner on fetch failure
      })
  }, [tenantSlug])

  if (!state || dismissed) return null

  const effectiveStatus = deriveEffectiveStatus(state)
  const config = BANNER_CONFIG[effectiveStatus]

  // Don't show banner when AI is fully active
  if (!config) return null

  const Icon = config.icon
  const message = config.getMessage(state)

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-lg border px-4 py-2.5 animate-fade-in',
      config.bgClass,
      config.borderClass,
    )}>
      <Icon className={cn('h-4 w-4 shrink-0', config.textClass)} />
      <p className={cn('text-xs font-medium flex-1', config.textClass)}>
        {message}
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className={cn('shrink-0 rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors', config.textClass)}
        aria-label="Dismiss banner"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
