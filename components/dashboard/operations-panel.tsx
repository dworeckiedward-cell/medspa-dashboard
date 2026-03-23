'use client'

/**
 * OperationsPanel — simplified system status for client dashboard.
 *
 * Shows only client-relevant status: AI Pipeline health.
 * Internal items (Billing, Domain, Webhook, Last Activity) removed — those are OPS-only.
 */

import { useMemo } from 'react'
import { Activity, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { CallLog, Client } from '@/types/database'
import type { BillingSummary } from '@/lib/types/domain'

// ── Types ────────────────────────────────────────────────────────────────────

type StatusLevel = 'healthy' | 'warning' | 'error' | 'unknown'

interface StatusRow {
  label: string
  icon: React.ElementType
  status: StatusLevel
  detail: string
}

interface OperationsPanelProps {
  callLogs: CallLog[]
  tenant: Client
  integrationsCount?: number
  integrationsHealthy?: number
  billing?: BillingSummary | null
}

// ── Status derivation ────────────────────────────────────────────────────────

const STATUS_STYLE: Record<StatusLevel, { dot: string; text: string }> = {
  healthy: { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  warning: { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  error: { dot: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
  unknown: { dot: 'bg-[var(--brand-muted)]', text: 'text-[var(--brand-muted)]' },
}

function deriveAiPipeline(callLogs: CallLog[]): StatusRow {
  if (callLogs.length === 0) {
    return { label: 'AI Pipeline', icon: Activity, status: 'unknown', detail: 'No calls processed yet' }
  }
  const withSummary = callLogs.filter((c) => c.ai_summary || c.summary).length
  const rate = withSummary / callLogs.length
  if (rate >= 0.8) return { label: 'AI Pipeline', icon: Activity, status: 'healthy', detail: `${Math.round(rate * 100)}% calls analyzed` }
  if (rate >= 0.5) return { label: 'AI Pipeline', icon: Activity, status: 'warning', detail: `${Math.round(rate * 100)}% calls analyzed` }
  return { label: 'AI Pipeline', icon: Activity, status: 'warning', detail: 'Low analysis rate' }
}

function deriveIntegrations(count?: number, healthy?: number): StatusRow {
  if (!count || count === 0) {
    return { label: 'Integrations', icon: CheckCircle2, status: 'unknown', detail: 'None configured' }
  }
  if (healthy === count) {
    return { label: 'Integrations', icon: CheckCircle2, status: 'healthy', detail: `${count} connected` }
  }
  return { label: 'Integrations', icon: AlertTriangle, status: 'warning', detail: `${healthy ?? 0}/${count} healthy` }
}

// ── Component ────────────────────────────────────────────────────────────────

export function OperationsPanel({
  callLogs,
  tenant,
  integrationsCount,
  integrationsHealthy,
}: OperationsPanelProps) {
  const statusItems = useMemo<StatusRow[]>(() => [
    deriveAiPipeline(callLogs),
    deriveIntegrations(integrationsCount, integrationsHealthy),
  ], [callLogs, integrationsCount, integrationsHealthy])

  const allHealthy = statusItems.every((i) => i.status === 'healthy')

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
        <div className="space-y-2">
          {statusItems.map((item) => {
            const style = STATUS_STYLE[item.status]
            return (
              <div
                key={item.label}
                className="flex items-center gap-2.5 rounded-lg border border-[var(--brand-border)] p-3"
              >
                <div className={cn('h-2 w-2 rounded-full shrink-0', style.dot)} />
                <div className="min-w-0 flex-1">
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
