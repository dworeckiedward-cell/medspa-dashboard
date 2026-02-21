'use client'

import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Unplug,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { IntegrationHealthSummary } from '@/lib/types/domain'
import { cn } from '@/lib/utils'

interface IntegrationsHealthCardProps {
  health: IntegrationHealthSummary
}

function StatBlock({
  label,
  value,
  icon: Icon,
  valueClass,
}: {
  label: string
  value: string | number
  icon: typeof Activity
  valueClass?: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-3 py-2">
      <Icon className="h-4 w-4 text-[var(--brand-muted)] mb-0.5" />
      <span className={cn('text-lg font-semibold tabular-nums', valueClass ?? 'text-[var(--brand-text)]')}>
        {value}
      </span>
      <span className="text-[10px] text-[var(--brand-muted)] text-center leading-tight">
        {label}
      </span>
    </div>
  )
}

export function IntegrationsHealthCard({ health }: IntegrationsHealthCardProps) {
  const failureRateLabel = health.failureRate24h !== null ? `${health.failureRate24h}%` : '—'
  const failureRateClass =
    health.failureRate24h === null
      ? 'text-[var(--brand-muted)]'
      : health.failureRate24h <= 5
        ? 'text-emerald-600 dark:text-emerald-400'
        : health.failureRate24h <= 20
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-rose-600 dark:text-rose-400'

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-[var(--brand-muted)]" />
          Integration Health
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {health.totalIntegrations === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
            <Unplug className="h-6 w-6 text-[var(--brand-muted)] opacity-40" />
            <p className="text-xs text-[var(--brand-muted)]">No integrations configured</p>
          </div>
        ) : (
          <div className="grid grid-cols-5 divide-x divide-[var(--brand-border)] rounded-lg border border-[var(--brand-border)]">
            <StatBlock
              label="Total"
              value={health.totalIntegrations}
              icon={Unplug}
            />
            <StatBlock
              label="Active"
              value={health.activeIntegrations}
              icon={CheckCircle2}
              valueClass="text-emerald-600 dark:text-emerald-400"
            />
            <StatBlock
              label="Failing"
              value={health.failingIntegrations}
              icon={XCircle}
              valueClass={health.failingIntegrations > 0 ? 'text-rose-600 dark:text-rose-400' : undefined}
            />
            <StatBlock
              label="24h events"
              value={health.deliveries24h}
              icon={Activity}
            />
            <StatBlock
              label="Fail rate"
              value={failureRateLabel}
              icon={AlertTriangle}
              valueClass={failureRateClass}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
