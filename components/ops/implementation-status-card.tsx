'use client'

/**
 * ImplementationStatusCard — internal ops scaffold for tracking
 * new client implementation progress.
 *
 * Read-only status display. Future: wire to DB for persistent tracking.
 * Shows implementation checklist items with their status.
 */

import { CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ClientOverview } from '@/lib/ops/query'

interface ImplementationStatusCardProps {
  overview: ClientOverview
}

type ImplStatus = 'done' | 'pending' | 'in_progress' | 'blocked'

interface ImplItem {
  label: string
  status: ImplStatus
}

function deriveImplementationStatus(overview: ClientOverview): ImplItem[] {
  const { client, callStats, integrationsCount, integrationsHealthy } = overview

  return [
    {
      label: 'Branding configured',
      status: client.brand_color ? 'done' : 'pending',
    },
    {
      label: 'Logo uploaded',
      status: client.logo_url ? 'done' : 'pending',
    },
    {
      label: 'AI receptionist linked',
      status: client.retell_agent_id ? 'done' : 'pending',
    },
    {
      label: 'Phone number assigned',
      status: client.retell_phone_number ? 'done' : 'pending',
    },
    {
      label: 'Integrations connected',
      status:
        integrationsCount === 0
          ? 'pending'
          : integrationsHealthy === integrationsCount
            ? 'done'
            : 'in_progress',
    },
    {
      label: 'Services mapped',
      // Heuristic: if there have been calls with booked_value, services are likely mapped
      status: callStats.bookedCalls > 0 ? 'done' : 'pending',
    },
    {
      label: 'First calls received',
      status: callStats.totalCalls > 0 ? 'done' : 'pending',
    },
    {
      label: 'Client login ready',
      // Heuristic: client is always accessible via slug — so mark done if active
      status: client.is_active ? 'done' : 'pending',
    },
  ]
}

const STATUS_CONFIG: Record<ImplStatus, { icon: React.ElementType; color: string }> = {
  done: { icon: CheckCircle2, color: 'text-emerald-500' },
  in_progress: { icon: Clock, color: 'text-blue-500' },
  pending: { icon: Circle, color: 'text-[var(--brand-border)]' },
  blocked: { icon: AlertCircle, color: 'text-rose-500' },
}

export function ImplementationStatusCard({ overview }: ImplementationStatusCardProps) {
  const items = deriveImplementationStatus(overview)
  const doneCount = items.filter((i) => i.status === 'done').length
  const percent = Math.round((doneCount / items.length) * 100)

  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--brand-text)]">
            Implementation Status
          </h3>
          <p className="text-[10px] text-[var(--brand-muted)]">
            {doneCount}/{items.length} complete ({percent}%)
          </p>
        </div>
        <span
          className={cn(
            'text-[11px] font-medium px-2 py-0.5 rounded-full',
            percent === 100
              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
              : percent >= 50
                ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400'
                : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400',
          )}
        >
          {percent === 100 ? 'Complete' : percent >= 50 ? 'In Progress' : 'Getting Started'}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-[var(--brand-border)] overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            percent === 100
              ? 'bg-emerald-500'
              : percent >= 50
                ? 'bg-blue-500'
                : 'bg-amber-500',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Checklist */}
      <div className="space-y-1.5">
        {items.map((item) => {
          const cfg = STATUS_CONFIG[item.status]
          const Icon = cfg.icon
          return (
            <div key={item.label} className="flex items-center gap-2 py-0.5">
              <Icon className={cn('h-3.5 w-3.5 shrink-0', cfg.color)} />
              <span
                className={cn(
                  'text-xs',
                  item.status === 'done'
                    ? 'text-[var(--brand-text)]'
                    : 'text-[var(--brand-muted)]',
                )}
              >
                {item.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
