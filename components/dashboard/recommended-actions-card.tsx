'use client'

import { Lightbulb, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RecommendedAction } from '@/lib/dashboard/recommended-actions'

interface RecommendedActionsCardProps {
  actions: RecommendedAction[]
}

export function RecommendedActionsCard({ actions }: RecommendedActionsCardProps) {
  if (actions.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          Recommended Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-1">
        {actions.map((action) => (
          <a
            key={action.id}
            href={action.href}
            className="flex items-start gap-3 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-4 py-3 hover:border-[var(--brand-primary)]/30 hover:bg-[var(--brand-primary)]/[0.02] transition-colors group"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--brand-text)] group-hover:text-[var(--brand-primary)] transition-colors">
                {action.title}
              </p>
              <p className="text-xs text-[var(--brand-muted)] mt-0.5 leading-relaxed">
                {action.description}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-[var(--brand-muted)] group-hover:text-[var(--brand-primary)] transition-colors" />
          </a>
        ))}
      </CardContent>
    </Card>
  )
}
