'use client'

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, AlertCircle, Info, ArrowRight, ChevronDown, ChevronUp, X } from 'lucide-react'
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
const DISMISS_STORAGE_KEY = 'servify:ops-dismissed-alerts'
const COLLAPSE_STORAGE_KEY = 'servify:ops-alerts-collapsed'

function getDismissedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as { ids: string[]; ts: number }
    // Expire after 24h so dismissed alerts reappear if still relevant
    if (Date.now() - parsed.ts > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(DISMISS_STORAGE_KEY)
      return new Set()
    }
    return new Set(parsed.ids)
  } catch {
    return new Set()
  }
}

function saveDismissedIds(ids: Set<string>) {
  try {
    localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify({
      ids: Array.from(ids),
      ts: Date.now(),
    }))
  } catch {
    // localStorage unavailable
  }
}

export function OpsAlertsPanel({ alerts }: OpsAlertsPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState(false)

  // Load dismissed + collapsed state from localStorage on mount
  useEffect(() => {
    setDismissedIds(getDismissedIds())
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true')
    } catch {}
  }, [])

  const handleDismiss = useCallback((alertId: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev)
      next.add(alertId)
      saveDismissedIds(next)
      return next
    })
  }, [])

  const handleToggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next)) } catch {}
      return next
    })
  }, [])

  // Filter out dismissed alerts
  const activeAlerts = alerts.filter((a) => !dismissedIds.has(a.id))

  const criticalCount = activeAlerts.filter((a) => a.severity === 'critical').length
  const warningCount = activeAlerts.filter((a) => a.severity === 'warning').length
  const infoCount = activeAlerts.filter((a) => a.severity === 'info').length

  const visible = expanded ? activeAlerts : activeAlerts.slice(0, INITIAL_VISIBLE)
  const hasMore = activeAlerts.length > INITIAL_VISIBLE

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleToggleCollapse}
            className="flex items-center gap-2 text-left"
          >
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[var(--brand-muted)]" />
              Cross-Tenant Alerts
            </CardTitle>
            {collapsed ? (
              <ChevronDown className="h-3.5 w-3.5 text-[var(--brand-muted)]" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5 text-[var(--brand-muted)]" />
            )}
          </button>
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

      {!collapsed && (
        <CardContent className="p-0">
          {activeAlerts.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-4 justify-center">
              <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <p className="text-sm font-medium text-[var(--brand-text)]">All systems healthy</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-[var(--brand-border)]">
                {visible.map((alert) => (
                  <AlertRow key={alert.id} alert={alert} onDismiss={handleDismiss} />
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
                    <>Show {activeAlerts.length - INITIAL_VISIBLE} more <ChevronDown className="h-3 w-3" /></>
                  )}
                </button>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  )
}

function AlertRow({ alert, onDismiss }: { alert: OpsAlert; onDismiss: (id: string) => void }) {
  const config = SEVERITY_CONFIG[alert.severity]

  return (
    <div className={cn('flex items-start gap-3 px-4 py-3 hover:bg-[var(--brand-surface)]/50 transition-colors group')}>
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
      <div className="flex items-center gap-1 shrink-0">
        {alert.actionHref && (
          <a
            href={alert.actionHref}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 transition-colors"
          >
            {alert.actionLabel ?? 'View'}
            <ArrowRight className="h-3 w-3" />
          </a>
        )}
        <button
          type="button"
          onClick={() => onDismiss(alert.id)}
          className="opacity-0 group-hover:opacity-100 inline-flex items-center justify-center h-6 w-6 rounded-md text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-border)]/50 transition-all"
          aria-label="Dismiss alert"
          title="Dismiss (24h)"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
