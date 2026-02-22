'use client'

import { useState } from 'react'
import { Lightbulb, ArrowRight, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { RecommendedAction } from '@/lib/dashboard/recommended-actions'

const DISMISS_KEY = 'servify:dismiss:recommended-actions'

interface RecommendedActionsCardProps {
  actions: RecommendedAction[]
}

export function RecommendedActionsCard({ actions }: RecommendedActionsCardProps) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(DISMISS_KEY) === 'true'
  })

  if (actions.length === 0 || dismissed) return null

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem(DISMISS_KEY, 'true')
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-1.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--brand-text)]">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
          Recommended Actions
        </div>
        <button
          onClick={handleDismiss}
          className="rounded-md p-0.5 text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-border)]/50 transition-colors"
          aria-label="Dismiss recommended actions"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-1 px-4 pb-3">
        {actions.map((action) => (
          <a
            key={action.id}
            href={action.href}
            className="flex items-center gap-2.5 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-2 hover:border-[var(--brand-primary)]/30 hover:bg-[var(--brand-primary)]/[0.02] transition-colors group"
          >
            <p className="text-xs font-medium text-[var(--brand-text)] group-hover:text-[var(--brand-primary)] transition-colors truncate flex-1">
              {action.title}
            </p>
            <ArrowRight className="h-3 w-3 shrink-0 text-[var(--brand-muted)] group-hover:text-[var(--brand-primary)] transition-colors" />
          </a>
        ))}
      </div>
    </Card>
  )
}
