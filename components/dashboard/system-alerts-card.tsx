'use client'

/**
 * SystemAlertsCard — premium tenant-facing alerts summary.
 *
 * Shows top 5 open alerts for the current tenant with:
 * - Severity badge + title + impact text
 * - Relative timestamp ("detected 2h ago")
 * - Recommended action CTA
 * - Premium empty state when no alerts
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
  Clock,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

export function SystemAlertsCard() {
  const [alerts, setAlerts] = useState<TenantAlert[]>([])
  const [loading, setLoading] = useState(true)

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

  function formatAge(iso: string): string {
    const ms = Date.now() - Date.parse(iso)
    const min = Math.floor(ms / 60_000)
    const hr = Math.floor(ms / 3_600_000)
    const day = Math.floor(ms / 86_400_000)
    if (min < 1) return 'just now'
    if (min < 60) return `${min}m ago`
    if (hr < 24) return `${hr}h ago`
    return `${day}d ago`
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--brand-muted)]" />
        </CardContent>
      </Card>
    )
  }

  // Premium empty state
  if (alerts.length === 0) {
    return (
      <Card className="border-emerald-200/40 dark:border-emerald-900/20">
        <CardContent className="flex items-center gap-4 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--brand-text)]">
              No active alerts
            </p>
            <p className="text-xs text-[var(--brand-muted)] mt-0.5">
              Your AI reception system is operating within expected ranges.
            </p>
          </div>
        </CardContent>
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
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            System Alerts
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
        {alerts.map((alert) => {
          const cfg = SEVERITY_CONFIG[alert.severity]
          const Icon = cfg.icon
          const action = ACTION_MAP[alert.ruleKey]

          return (
            <div
              key={alert.id}
              className={cn(
                'flex items-start gap-3 rounded-lg px-3 py-2.5',
                cfg.bgClass,
              )}
            >
              <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', cfg.textClass)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[var(--brand-text)]">
                    {alert.title}
                  </p>
                  <span className={cn('text-[10px] font-medium uppercase', cfg.textClass)}>
                    {alert.severity}
                  </span>
                </div>
                <p className="text-xs text-[var(--brand-muted)] mt-0.5">
                  {alert.description}
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-[10px] text-[var(--brand-muted)] flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {formatAge(alert.firstDetectedAt)}
                  </span>
                  {alert.confidence !== 'exact' && (
                    <span className="text-[10px] text-[var(--brand-muted)] italic">
                      {alert.confidence}
                    </span>
                  )}
                </div>
              </div>
              {action && (
                <a
                  href={action.href}
                  className={cn(
                    'shrink-0 flex items-center gap-1 text-xs font-medium transition-colors hover:underline mt-0.5',
                    cfg.textClass,
                  )}
                >
                  {action.label}
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
