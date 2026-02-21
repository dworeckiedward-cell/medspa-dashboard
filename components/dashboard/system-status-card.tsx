'use client'

/**
 * SystemStatusCard — executive "is everything working?" glance view.
 *
 * Shows compact health indicators for:
 *  - AI Pipeline (based on recent call processing)
 *  - Integrations (reuses health summary)
 *  - Billing (reuses billing data)
 *  - Last Activity (most recent call timestamp)
 */

import { useMemo } from 'react'
import { Activity, Plug, CreditCard, Clock, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { CallLog } from '@/types/database'
import type { BillingSummary } from '@/lib/types/domain'

// ── Types ────────────────────────────────────────────────────────────────────

type StatusLevel = 'healthy' | 'warning' | 'error' | 'unknown'

interface StatusItem {
  label: string
  icon: React.ElementType
  status: StatusLevel
  detail: string
}

interface SystemStatusCardProps {
  callLogs: CallLog[]
  integrationsCount?: number
  integrationsHealthy?: number
  billing?: BillingSummary | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<StatusLevel, { dot: string; text: string; icon: React.ElementType }> = {
  healthy: { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', icon: CheckCircle2 },
  warning: { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', icon: AlertTriangle },
  error: { dot: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400', icon: XCircle },
  unknown: { dot: 'bg-[var(--brand-muted)]', text: 'text-[var(--brand-muted)]', icon: Clock },
}

function deriveAiPipelineStatus(callLogs: CallLog[]): StatusItem {
  if (callLogs.length === 0) {
    return { label: 'AI Pipeline', icon: Activity, status: 'unknown', detail: 'No calls processed yet' }
  }

  // Check if we have recent calls (within last 24h)
  const now = Date.now()
  const recentCalls = callLogs.filter((c) => now - Date.parse(c.created_at) < 86_400_000)
  const withSummary = callLogs.filter((c) => c.ai_summary || c.summary).length
  const summaryRate = callLogs.length > 0 ? withSummary / callLogs.length : 0

  if (summaryRate >= 0.8) {
    return {
      label: 'AI Pipeline',
      icon: Activity,
      status: 'healthy',
      detail: `${Math.round(summaryRate * 100)}% of calls summarized`,
    }
  }
  if (summaryRate >= 0.5) {
    return {
      label: 'AI Pipeline',
      icon: Activity,
      status: 'warning',
      detail: `${Math.round(summaryRate * 100)}% summarized — some backlog`,
    }
  }
  return {
    label: 'AI Pipeline',
    icon: Activity,
    status: recentCalls.length > 0 ? 'warning' : 'unknown',
    detail: recentCalls.length > 0 ? 'Low summary rate' : 'No recent activity',
  }
}

function deriveIntegrationsStatus(count: number, healthy: number): StatusItem {
  if (count === 0) {
    return { label: 'Integrations', icon: Plug, status: 'unknown', detail: 'No integrations configured' }
  }
  if (healthy === count) {
    return { label: 'Integrations', icon: Plug, status: 'healthy', detail: `${count} connected, all healthy` }
  }
  const unhealthy = count - healthy
  return {
    label: 'Integrations',
    icon: Plug,
    status: unhealthy > count / 2 ? 'error' : 'warning',
    detail: `${unhealthy} of ${count} need attention`,
  }
}

function deriveBillingStatus(billing: BillingSummary | null | undefined): StatusItem {
  if (!billing) {
    return { label: 'Billing', icon: CreditCard, status: 'unknown', detail: 'Not configured' }
  }
  if (billing.status === 'active' || billing.status === 'trialing') {
    return { label: 'Billing', icon: CreditCard, status: 'healthy', detail: `${billing.planName} — ${billing.status}` }
  }
  if (billing.status === 'past_due') {
    return { label: 'Billing', icon: CreditCard, status: 'error', detail: 'Payment past due' }
  }
  return { label: 'Billing', icon: CreditCard, status: 'warning', detail: billing.status }
}

function deriveLastActivity(callLogs: CallLog[]): StatusItem {
  if (callLogs.length === 0) {
    return { label: 'Last Activity', icon: Clock, status: 'unknown', detail: 'No calls received' }
  }
  const sorted = [...callLogs].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  const latest = sorted[0]
  const ago = formatDistanceToNow(parseISO(latest.created_at), { addSuffix: true })
  const hoursSince = (Date.now() - Date.parse(latest.created_at)) / 3_600_000

  return {
    label: 'Last Activity',
    icon: Clock,
    status: hoursSince < 24 ? 'healthy' : hoursSince < 72 ? 'warning' : 'error',
    detail: ago,
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function SystemStatusCard({
  callLogs,
  integrationsCount = 0,
  integrationsHealthy = 0,
  billing,
}: SystemStatusCardProps) {
  const items = useMemo<StatusItem[]>(() => [
    deriveAiPipelineStatus(callLogs),
    deriveIntegrationsStatus(integrationsCount, integrationsHealthy),
    deriveBillingStatus(billing),
    deriveLastActivity(callLogs),
  ], [callLogs, integrationsCount, integrationsHealthy, billing])

  const allHealthy = items.every((i) => i.status === 'healthy')

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4 text-[var(--brand-muted)]" />
          System Status
          {allHealthy && (
            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40 rounded px-1.5 py-0.5 ml-auto">
              All systems operational
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {items.map((item) => {
            const style = STATUS_STYLE[item.status]
            return (
              <div
                key={item.label}
                className="flex items-start gap-2.5 rounded-lg border border-[var(--brand-border)] p-3"
              >
                <div className="relative mt-0.5">
                  <div className={cn('h-2 w-2 rounded-full', style.dot)} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-[var(--brand-text)] leading-tight">
                    {item.label}
                  </p>
                  <p className={cn('text-[10px] mt-0.5 leading-tight truncate', style.text)}>
                    {item.detail}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
