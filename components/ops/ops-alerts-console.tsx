'use client'

/**
 * OpsAlertsConsole — full page client component for /ops/alerts.
 *
 * Combines KPI strip + alerts table with lifecycle action handlers.
 */

import { useState } from 'react'
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Users,
  Clock,
  Eye,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { OpsAlertsTable } from './ops-alerts-table'
import type { AlertWithClient, AlertsSummary } from '@/lib/alerts/types'

interface OpsAlertsConsoleProps {
  alerts: AlertWithClient[]
  summary: AlertsSummary
  operatorEmail: string | null
}

export function OpsAlertsConsole({
  alerts: initialAlerts,
  summary,
  operatorEmail,
}: OpsAlertsConsoleProps) {
  const [alerts, setAlerts] = useState(initialAlerts)

  async function handleAction(
    alertId: string,
    action: 'acknowledge' | 'resolve' | 'reopen',
  ) {
    // Optimistic update
    setAlerts((prev) =>
      prev.map((a) => {
        if (a.id !== alertId) return a
        const now = new Date().toISOString()
        switch (action) {
          case 'acknowledge':
            return { ...a, status: 'acknowledged' as const, acknowledgedAt: now, acknowledgedBy: operatorEmail }
          case 'resolve':
            return { ...a, status: 'resolved' as const, resolvedAt: now, resolvedBy: operatorEmail }
          case 'reopen':
            return { ...a, status: 'open' as const, resolvedAt: null, resolvedBy: null }
        }
      }),
    )

    // API call (fire-and-forget for persisted alerts)
    try {
      await fetch(`/api/ops/alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
    } catch {
      // API may fail for derived alerts — optimistic state still applies
    }
  }

  const kpis = [
    {
      label: 'Open Alerts',
      value: summary.totalOpen,
      icon: AlertTriangle,
      color: summary.totalOpen > 0 ? 'text-rose-500' : 'text-emerald-500',
    },
    {
      label: 'Critical',
      value: summary.critical,
      icon: AlertCircle,
      color: summary.critical > 0 ? 'text-rose-500' : 'text-[var(--brand-muted)]',
    },
    {
      label: 'Warning',
      value: summary.warning,
      icon: AlertTriangle,
      color: summary.warning > 0 ? 'text-amber-500' : 'text-[var(--brand-muted)]',
    },
    {
      label: 'Affected Tenants',
      value: summary.affectedTenants,
      icon: Users,
      color: summary.affectedTenants > 0 ? 'text-violet-500' : 'text-[var(--brand-muted)]',
    },
    {
      label: 'Unresolved >24h',
      value: summary.unresolvedOver24h,
      icon: Clock,
      color: summary.unresolvedOver24h > 0 ? 'text-orange-500' : 'text-[var(--brand-muted)]',
    },
    {
      label: 'Acknowledged',
      value: summary.acknowledgedPending,
      icon: Eye,
      color: 'text-blue-500',
    },
    {
      label: 'Resolved Today',
      value: summary.resolvedToday,
      icon: CheckCircle2,
      color: 'text-emerald-500',
    },
  ]

  return (
    <div className="min-h-screen bg-[var(--brand-bg)]">
      {/* Header */}
      <header className="border-b border-[var(--brand-border)] bg-[var(--brand-surface)] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="/ops"
              className="rounded-md p-1 text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
              title="Back to console"
            >
              <ArrowLeft className="h-4 w-4" />
            </a>
            <div>
              <h1 className="text-lg font-semibold text-[var(--brand-text)] tracking-tight">
                Alerts Console
              </h1>
              <p className="text-xs text-[var(--brand-muted)] mt-0.5">
                Cross-tenant reliability monitoring
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--brand-muted)]">
              {operatorEmail ?? 'Operator'}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 font-medium">
              Ops
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {kpis.map((kpi) => {
            const Icon = kpi.icon
            return (
              <div
                key={kpi.label}
                className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-3"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className={cn('h-3.5 w-3.5', kpi.color)} />
                  <span className="text-[10px] font-medium text-[var(--brand-muted)] uppercase tracking-wider">
                    {kpi.label}
                  </span>
                </div>
                <p className="text-xl font-bold text-[var(--brand-text)]">{kpi.value}</p>
              </div>
            )
          })}
        </div>

        {/* Alerts table */}
        <OpsAlertsTable alerts={alerts} onAction={handleAction} />
      </div>
    </div>
  )
}
