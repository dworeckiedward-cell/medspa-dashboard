'use client'

/**
 * SystemAlertsCard — premium tenant-facing alerts summary.
 *
 * Shows top 5 open alerts for the current tenant with:
 * - Severity badge + title + recommended action CTA
 * - Premium empty state when no alerts (dismissible)
 *
 * Fetches from /api/alerts client-side (non-blocking).
 */

import { useState, useEffect } from 'react'
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  ArrowRight,
  Loader2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import type { TenantAlert, AlertSeverity } from '@/lib/alerts/types'

const SEVERITY_CONFIG: Record<AlertSeverity, {
  icon: React.ElementType
  dotClass: string
  textClass: string
  bgClass: string
  borderClass: string
}> = {
  critical: {
    icon: AlertCircle,
    dotClass: 'bg-rose-500',
    textClass: 'text-rose-600 dark:text-rose-400',
    bgClass: 'bg-rose-50 dark:bg-rose-950/20',
    borderClass: 'border-rose-200 dark:border-rose-900/40',
  },
  warning: {
    icon: AlertTriangle,
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-50 dark:bg-amber-950/20',
    borderClass: 'border-amber-200 dark:border-amber-900/40',
  },
  info: {
    icon: Info,
    dotClass: 'bg-blue-500',
    textClass: 'text-blue-600 dark:text-blue-400',
    bgClass: 'bg-blue-50 dark:bg-blue-950/20',
    borderClass: 'border-blue-200 dark:border-blue-900/40',
  },
}

// Map rule keys to actionable CTAs
const ACTION_MAP: Record<string, { label: string; href: string }> = {
  integration_disconnected: { label: 'Review integrations', href: '/dashboard/integrations' },
  all_integrations_down: { label: 'Fix integrations', href: '/dashboard/integrations' },
  delivery_failures_spike: { label: 'Check delivery logs', href: '/dashboard/integrations' },
  no_recent_calls: { label: 'Check AI receptionist', href: '/dashboard' },
  missed_call_rate_high: { label: 'Review call logs', href: '/dashboard' },
  booking_rate_drop: { label: 'View reports', href: '/dashboard/reports' },
  no_bookings_from_calls: { label: 'View reports', href: '/dashboard/reports' },
  usage_80_percent: { label: 'View billing', href: '/dashboard/settings' },
  usage_over_limit: { label: 'View billing', href: '/dashboard/settings' },
  pipeline_backlog: { label: 'View call logs', href: '/dashboard' },
  data_stale: { label: 'Check status', href: '/dashboard' },
  follow_up_backlog: { label: 'Review follow-ups', href: '/dashboard' },
}

const DISMISS_EMPTY_KEY = 'servify:dismiss:system-alerts-empty'

export function SystemAlertsCard() {
  const [alerts, setAlerts] = useState<TenantAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [emptyDismissed, setEmptyDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(DISMISS_EMPTY_KEY) === 'true'
  })

  useEffect(() => {
    async function fetchAlerts() {
      try {
        const res = await fetch('/api/alerts')
        if (!res.ok) {
          setLoading(false)
          return
        }
        const data = await res.json()
        setAlerts((data.alerts ?? []).slice(0, 5))
      } catch {
        // silent — card is non-critical
      } finally {
        setLoading(false)
      }
    }

    fetchAlerts()
  }, [])

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--brand-muted)]" />
        </div>
      </Card>
    )
  }

  // Compact empty state
  if (alerts.length === 0) {
    if (emptyDismissed) return null

    const handleDismissEmpty = () => {
      setEmptyDismissed(true)
      localStorage.setItem(DISMISS_EMPTY_KEY, 'true')
    }

    return (
      <Card className="border-emerald-200/40 dark:border-emerald-900/20">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[var(--brand-text)]">
              No active alerts
            </p>
            <p className="text-[11px] text-[var(--brand-muted)]">
              AI reception operating normally.
            </p>
          </div>
          <button
            onClick={handleDismissEmpty}
            className="shrink-0 rounded-md p-0.5 text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-border)]/50 transition-colors"
            aria-label="Dismiss alerts status"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </Card>
    )
  }

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length
  const warningCount = alerts.filter((a) => a.severity === 'warning').length

  // Determine card border color based on worst severity
  const cardBorderClass = criticalCount > 0
    ? 'border-rose-200/60 dark:border-rose-900/30'
    : warningCount > 0
      ? 'border-amber-200/60 dark:border-amber-900/30'
      : ''

  return (
    <Card className={cardBorderClass}>
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-1.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--brand-text)]">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          System Alerts
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
        </div>
      </div>
      <div className="space-y-1 px-4 pb-3">
        {alerts.map((alert) => {
          const cfg = SEVERITY_CONFIG[alert.severity]
          const Icon = cfg.icon
          const action = ACTION_MAP[alert.ruleKey]

          return (
            <div
              key={alert.id}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2',
                cfg.bgClass,
              )}
            >
              <Icon className={cn('h-3.5 w-3.5 shrink-0', cfg.textClass)} />
              <p className="text-xs font-medium text-[var(--brand-text)] truncate flex-1">
                {alert.title}
              </p>
              {action && (
                <a
                  href={action.href}
                  className={cn(
                    'shrink-0 flex items-center gap-1 text-[11px] font-medium transition-colors hover:underline',
                    cfg.textClass,
                  )}
                >
                  {action.label}
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
