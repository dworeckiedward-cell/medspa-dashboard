'use client'

import { useState } from 'react'
import { AlertTriangle, AlertCircle, Info, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { OpsAlert, OpsAlertSeverity } from '@/lib/ops/alerts'

interface OpsAlertsPanelProps {
  alerts: OpsAlert[]
}

const SEVERITY_CONFIG: Record<OpsAlertSeverity, {
  icon: React.ElementType
  dotClass: string
  textClass: string
  borderClass: string
}> = {
  critical: {
    icon: AlertTriangle,
    dotClass: 'bg-rose-500',
    textClass: 'text-rose-600 dark:text-rose-400',
    borderClass: 'border-rose-200 dark:border-rose-900/40',
  },
  warning: {
    icon: AlertCircle,
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-600 dark:text-amber-400',
    borderClass: 'border-amber-200 dark:border-amber-900/40',
  },
  info: {
    icon: Info,
    dotClass: 'bg-blue-500',
    textClass: 'text-blue-600 dark:text-blue-400',
    borderClass: 'border-blue-200 dark:border-blue-900/40',
  },
}

const INITIAL_VISIBLE = 8

export function OpsAlertsPanel({ alerts }: OpsAlertsPanelProps) {
  const [expanded, setExpanded] = useState(false)

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length
  const warningCount = alerts.filter((a) => a.severity === 'warning').length
  const infoCount = alerts.filter((a) => a.severity === 'info').length

  const visible = expanded ? alerts : alerts.slice(0, INITIAL_VISIBLE)
  const hasMore = alerts.length > INITIAL_VISIBLE

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[var(--brand-muted)]" />
            Cross-Tenant Alerts
          </CardTitle>
          <div className="flex items-center gap-2 text-xs">
            {criticalCount > 0 && (
              <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                {criticalCount}
              </span>
            )}
            {warningCount > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {warningCount}
              </span>
            )}
            {infoCount > 0 && (
              <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                {infoCount}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30">
              <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[var(--brand-text)]">All systems healthy</p>
            <p className="text-xs text-[var(--brand-muted)]">No alerts across any tenant</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-[var(--brand-border)]">
              {visible.map((alert) => (
                <AlertRow key={alert.id} alert={alert} />
              ))}
            </div>
            {hasMore && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="w-full px-4 py-2.5 text-xs font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] flex items-center justify-center gap-1 border-t border-[var(--brand-border)] transition-colors"
              >
                {expanded ? (
                  <>Show less <ChevronUp className="h-3 w-3" /></>
                ) : (
                  <>Show {alerts.length - INITIAL_VISIBLE} more <ChevronDown className="h-3 w-3" /></>
                )}
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function AlertRow({ alert }: { alert: OpsAlert }) {
  const config = SEVERITY_CONFIG[alert.severity]

  return (
    <div className={cn('flex items-start gap-3 px-4 py-3 hover:bg-[var(--brand-surface)]/50 transition-colors')}>
      <span className={cn('mt-0.5 h-2 w-2 shrink-0 rounded-full', config.dotClass)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--brand-text)]">
            {alert.clientName}
          </span>
          <span className={cn('text-[10px] font-medium uppercase', config.textClass)}>
            {alert.severity}
          </span>
        </div>
        <p className="text-xs font-medium text-[var(--brand-text)] mt-0.5">
          {alert.title}
        </p>
        <p className="text-[11px] text-[var(--brand-muted)] mt-0.5 leading-relaxed">
          {alert.description}
        </p>
      </div>
      {alert.actionHref && (
        <a
          href={alert.actionHref}
          className="shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 transition-colors"
        >
          {alert.actionLabel ?? 'View'}
          <ArrowRight className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}
