'use client'

/**
 * OpsAlertsTable — full-featured alerts table for the operator console.
 *
 * Features:
 * - Severity/status/source/tenant filters
 * - Sort by severity, age, detected time
 * - Lifecycle actions (acknowledge, resolve)
 * - Search by tenant name or alert title
 * - Confidence badges
 * - Responsive design
 */

import { useState, useMemo } from 'react'
import {
  Search,
  Filter,
  CheckCircle2,
  Eye,
  RotateCcw,
  ExternalLink,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SeverityBadge } from '@/components/alerts/severity-badge'
import { AlertStatusBadge } from '@/components/alerts/alert-status-badge'
import type { AlertWithClient, AlertSeverity, AlertStatus, AlertSource } from '@/lib/alerts/types'

interface OpsAlertsTableProps {
  alerts: AlertWithClient[]
  onAction?: (alertId: string, action: 'acknowledge' | 'resolve' | 'reopen') => void
}

type SortKey = 'severity' | 'age' | 'detected'
type SortDir = 'asc' | 'desc'

const SOURCE_LABELS: Record<AlertSource, string> = {
  integrations: 'Integrations',
  delivery_logs: 'Delivery',
  calls: 'Calls',
  summaries_pipeline: 'Pipeline',
  usage_allowance: 'Usage',
  manual: 'Manual',
}

const CONFIDENCE_STYLES: Record<string, { label: string; className: string }> = {
  exact: { label: 'Exact', className: 'text-emerald-600 dark:text-emerald-400' },
  derived: { label: 'Derived', className: 'text-amber-600 dark:text-amber-400' },
  estimated: { label: 'Est.', className: 'text-slate-500 dark:text-slate-400' },
}

export function OpsAlertsTable({ alerts, onAction }: OpsAlertsTableProps) {
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'all'>('all')
  const [sourceFilter, setSourceFilter] = useState<AlertSource | 'all'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('severity')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let result = [...alerts]

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (a) =>
          a.clientName.toLowerCase().includes(q) ||
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q),
      )
    }

    // Filters
    if (severityFilter !== 'all') {
      result = result.filter((a) => a.severity === severityFilter)
    }
    if (statusFilter !== 'all') {
      result = result.filter((a) => a.status === statusFilter)
    }
    if (sourceFilter !== 'all') {
      result = result.filter((a) => a.source === sourceFilter)
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'severity': {
          const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 }
          cmp = order[a.severity] - order[b.severity]
          break
        }
        case 'age':
          cmp = Date.parse(a.firstDetectedAt) - Date.parse(b.firstDetectedAt)
          break
        case 'detected':
          cmp = Date.parse(b.lastDetectedAt) - Date.parse(a.lastDetectedAt)
          break
      }
      return sortDir === 'desc' ? -cmp : cmp
    })

    return result
  }, [alerts, search, severityFilter, statusFilter, sourceFilter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function formatAge(iso: string): string {
    const ms = Date.now() - Date.parse(iso)
    const min = Math.floor(ms / 60_000)
    const hr = Math.floor(ms / 3_600_000)
    const day = Math.floor(ms / 86_400_000)
    if (min < 60) return `${min}m`
    if (hr < 24) return `${hr}h`
    return `${day}d`
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--brand-muted)]" />
          <input
            type="text"
            placeholder="Search tenant or alert..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] pl-8 pr-3 py-1.5 text-xs text-[var(--brand-text)] placeholder:text-[var(--brand-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--user-accent)]"
          />
        </div>

        {/* Severity */}
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as AlertSeverity | 'all')}
          className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-2 py-1.5 text-xs text-[var(--brand-text)]"
        >
          <option value="all">All severity</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AlertStatus | 'all')}
          className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-2 py-1.5 text-xs text-[var(--brand-text)]"
        >
          <option value="all">All status</option>
          <option value="open">Open</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
          <option value="muted">Muted</option>
        </select>

        {/* Source */}
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as AlertSource | 'all')}
          className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-2 py-1.5 text-xs text-[var(--brand-text)]"
        >
          <option value="all">All sources</option>
          <option value="integrations">Integrations</option>
          <option value="delivery_logs">Delivery</option>
          <option value="calls">Calls</option>
          <option value="summaries_pipeline">Pipeline</option>
          <option value="usage_allowance">Usage</option>
        </select>

        <span className="text-[10px] text-[var(--brand-muted)]">
          {filtered.length} alert{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[80px_1fr_1fr_80px_80px_70px_100px] gap-2 px-4 py-2 text-[10px] font-medium text-[var(--brand-muted)] uppercase tracking-wider border-b border-[var(--brand-border)] bg-[var(--brand-bg)]">
          <button onClick={() => toggleSort('severity')} className="flex items-center gap-1 hover:text-[var(--brand-text)]">
            Severity
            {sortKey === 'severity' && (sortDir === 'desc' ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronUp className="h-2.5 w-2.5" />)}
          </button>
          <span>Tenant / Alert</span>
          <span>Description</span>
          <span>Source</span>
          <span>Status</span>
          <button onClick={() => toggleSort('age')} className="flex items-center gap-1 hover:text-[var(--brand-text)]">
            Age
            {sortKey === 'age' && (sortDir === 'desc' ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronUp className="h-2.5 w-2.5" />)}
          </button>
          <span>Actions</span>
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-[var(--brand-text)]">No matching alerts</p>
            <p className="text-xs text-[var(--brand-muted)]">
              {alerts.length === 0
                ? 'All systems operating within expected ranges'
                : 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--brand-border)]">
            {filtered.map((alert) => {
              const isExpanded = expandedId === alert.id
              const conf = CONFIDENCE_STYLES[alert.confidence] ?? CONFIDENCE_STYLES.derived

              return (
                <div key={alert.id}>
                  <div
                    className="grid grid-cols-[80px_1fr_1fr_80px_80px_70px_100px] gap-2 px-4 py-2.5 items-center hover:bg-[var(--brand-bg)]/50 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                  >
                    <div>
                      <SeverityBadge severity={alert.severity} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-[var(--brand-text)] truncate block">
                        {alert.clientName}
                      </span>
                      <span className="text-[11px] text-[var(--brand-muted)] truncate block">
                        {alert.title}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] text-[var(--brand-muted)] line-clamp-2">
                        {alert.description}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--brand-muted)]">
                        {SOURCE_LABELS[alert.source] ?? alert.source}
                      </span>
                    </div>
                    <div>
                      <AlertStatusBadge status={alert.status} />
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-[var(--brand-muted)]" />
                      <span className="text-[10px] text-[var(--brand-muted)]">
                        {formatAge(alert.firstDetectedAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {alert.status === 'open' && onAction && (
                        <button
                          onClick={() => onAction(alert.id, 'acknowledge')}
                          title="Acknowledge"
                          className="rounded p-1 text-[var(--brand-muted)] hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {(alert.status === 'open' || alert.status === 'acknowledged') && onAction && (
                        <button
                          onClick={() => onAction(alert.id, 'resolve')}
                          title="Resolve"
                          className="rounded p-1 text-[var(--brand-muted)] hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {alert.status === 'resolved' && onAction && (
                        <button
                          onClick={() => onAction(alert.id, 'reopen')}
                          title="Reopen"
                          className="rounded p-1 text-[var(--brand-muted)] hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <a
                        href={`/dashboard?tenant=${alert.clientSlug}`}
                        title="Open tenant"
                        className="rounded p-1 text-[var(--brand-muted)] hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950/20 transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 pb-3 pt-1 bg-[var(--brand-bg)]/30 border-t border-[var(--brand-border)]/50">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                        <div>
                          <span className="text-[var(--brand-muted)]">Rule: </span>
                          <span className="font-mono text-[var(--brand-text)]">{alert.ruleKey}</span>
                        </div>
                        <div>
                          <span className="text-[var(--brand-muted)]">Confidence: </span>
                          <span className={cn('font-medium', conf.className)}>{conf.label}</span>
                        </div>
                        <div>
                          <span className="text-[var(--brand-muted)]">First detected: </span>
                          <span className="text-[var(--brand-text)]">
                            {new Date(alert.firstDetectedAt).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-[var(--brand-muted)]">Last detected: </span>
                          <span className="text-[var(--brand-text)]">
                            {new Date(alert.lastDetectedAt).toLocaleString()}
                          </span>
                        </div>
                        {alert.acknowledgedAt && (
                          <div>
                            <span className="text-[var(--brand-muted)]">Acknowledged: </span>
                            <span className="text-[var(--brand-text)]">
                              {new Date(alert.acknowledgedAt).toLocaleString()}
                              {alert.acknowledgedBy && ` by ${alert.acknowledgedBy}`}
                            </span>
                          </div>
                        )}
                        {alert.resolvedAt && (
                          <div>
                            <span className="text-[var(--brand-muted)]">Resolved: </span>
                            <span className="text-[var(--brand-text)]">
                              {new Date(alert.resolvedAt).toLocaleString()}
                              {alert.resolvedBy && ` by ${alert.resolvedBy}`}
                            </span>
                          </div>
                        )}
                        <div className="col-span-2">
                          <span className="text-[var(--brand-muted)]">Recommended: </span>
                          <span className="text-[var(--brand-text)]">{alert.recommendedAction}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
