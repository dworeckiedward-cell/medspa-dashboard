'use client'

import { useState } from 'react'
import { AlertTriangle, AlertCircle, Info, ArrowRight, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { DashboardException, ExceptionSeverity } from '@/lib/dashboard/exceptions'

const DISMISS_KEY = 'servify:dismiss:needs-attention'

interface NeedsAttentionCardProps {
  exceptions: DashboardException[]
}

const SEVERITY_CONFIG: Record<
  ExceptionSeverity,
  { icon: typeof AlertTriangle; dotColor: string; textColor: string; bgColor: string }
> = {
  critical: {
    icon: AlertCircle,
    dotColor: 'bg-rose-500',
    textColor: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-50 dark:bg-rose-950/20',
  },
  warning: {
    icon: AlertTriangle,
    dotColor: 'bg-amber-500',
    textColor: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/20',
  },
  info: {
    icon: Info,
    dotColor: 'bg-blue-500',
    textColor: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
  },
}

export function NeedsAttentionCard({ exceptions }: NeedsAttentionCardProps) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(DISMISS_KEY) === 'true'
  })

  if (exceptions.length === 0 || dismissed) return null

  const criticalCount = exceptions.filter((e) => e.severity === 'critical').length
  const warningCount = exceptions.filter((e) => e.severity === 'warning').length

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem(DISMISS_KEY, 'true')
  }

  return (
    <Card className="border-amber-200/60 dark:border-amber-900/30">
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-1.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--brand-text)]">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          Needs Attention
        </div>
        <div className="flex items-center gap-1.5">
          {criticalCount > 0 && (
            <span className="rounded-full bg-rose-100 dark:bg-rose-950/40 px-1.5 py-px text-[10px] font-semibold text-rose-600 dark:text-rose-400">
              {criticalCount} critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="rounded-full bg-amber-100 dark:bg-amber-950/40 px-1.5 py-px text-[10px] font-semibold text-amber-600 dark:text-amber-400">
              {warningCount} warning
            </span>
          )}
          <button
            onClick={handleDismiss}
            className="rounded-md p-0.5 text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-border)]/50 transition-colors"
            aria-label="Dismiss needs attention"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="space-y-1 px-4 pb-3">
        {exceptions.map((exception) => {
          const config = SEVERITY_CONFIG[exception.severity]
          const Icon = config.icon

          return (
            <div
              key={exception.id}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2',
                config.bgColor,
              )}
            >
              <Icon className={cn('h-3.5 w-3.5 shrink-0', config.textColor)} />
              <p className="text-xs font-medium text-[var(--brand-text)] truncate flex-1">
                {exception.title}
              </p>
              {exception.actionHref && (
                <a
                  href={exception.actionHref}
                  className={cn(
                    'shrink-0 flex items-center gap-1 text-[11px] font-medium transition-colors hover:underline',
                    config.textColor,
                  )}
                >
                  {exception.actionLabel ?? 'View'}
                  <ArrowRight className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
