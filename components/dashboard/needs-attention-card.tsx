'use client'

import { AlertTriangle, AlertCircle, Info, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { DashboardException, ExceptionSeverity } from '@/lib/dashboard/exceptions'

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
  if (exceptions.length === 0) return null

  const criticalCount = exceptions.filter((e) => e.severity === 'critical').length
  const warningCount = exceptions.filter((e) => e.severity === 'warning').length

  return (
    <Card className="border-amber-200/60 dark:border-amber-900/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Needs Attention
          </CardTitle>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <span className="rounded-full bg-rose-100 dark:bg-rose-950/40 px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                {criticalCount} critical
              </span>
            )}
            {warningCount > 0 && (
              <span className="rounded-full bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                {warningCount} warning
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-2">
        {exceptions.map((exception) => {
          const config = SEVERITY_CONFIG[exception.severity]
          const Icon = config.icon

          return (
            <div
              key={exception.id}
              className={cn(
                'flex items-start gap-3 rounded-lg px-3 py-2.5',
                config.bgColor,
              )}
            >
              <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', config.textColor)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--brand-text)]">
                  {exception.title}
                </p>
                <p className="text-xs text-[var(--brand-muted)] mt-0.5">
                  {exception.description}
                </p>
              </div>
              {exception.actionHref && (
                <a
                  href={exception.actionHref}
                  className={cn(
                    'shrink-0 flex items-center gap-1 text-xs font-medium transition-colors hover:underline',
                    config.textColor,
                  )}
                >
                  {exception.actionLabel ?? 'View'}
                  <ArrowRight className="h-3 w-3" />
                </a>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
