'use client'

import { useState } from 'react'
import { FileText, Search, AlertTriangle, Clock, CheckCircle2, Circle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from '@/lib/support/types'
import type { RequestWithClient, RequestStatus, RequestPriority, SupportKpiSummary } from '@/lib/support/types'

interface OpsRequestsTableProps {
  requests: RequestWithClient[]
  kpi: SupportKpiSummary | null
}

const PRIORITY_BADGE: Record<RequestPriority, string> = {
  low: 'border-gray-300 text-gray-500 dark:border-gray-600',
  normal: 'border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400',
  high: 'border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400',
  urgent: 'border-red-300 text-red-600 dark:border-red-700 dark:text-red-400',
}

const STATUS_COLORS: Record<RequestStatus, string> = {
  open: 'text-blue-500',
  acknowledged: 'text-cyan-500',
  in_progress: 'text-amber-500',
  waiting_for_client: 'text-orange-500',
  resolved: 'text-emerald-500',
  closed: 'text-gray-400',
  reopened: 'text-purple-500',
}

type FilterView = 'active' | 'all' | 'overdue'

export function OpsRequestsTable({ requests, kpi }: OpsRequestsTableProps) {
  const [search, setSearch] = useState('')
  const [view, setView] = useState<FilterView>('active')

  const now = Date.now()
  const filtered = requests.filter((r) => {
    if (view === 'active' && ['resolved', 'closed'].includes(r.status)) return false
    if (view === 'overdue') {
      if (!r.firstResponseDueAt || r.firstRespondedAt) return false
      if (Date.parse(r.firstResponseDueAt) >= now) return false
    }
    if (search) {
      const q = search.toLowerCase()
      return (
        r.subject.toLowerCase().includes(q) ||
        r.shortCode.toLowerCase().includes(q) ||
        r.clientName.toLowerCase().includes(q)
      )
    }
    return true
  })

  const viewTabs: { key: FilterView; label: string; count?: number }[] = [
    { key: 'active', label: 'Active', count: kpi?.totalOpen },
    { key: 'overdue', label: 'Overdue', count: kpi?.overdueFirstResponse },
    { key: 'all', label: 'All' },
  ]

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      {kpi && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard label="Open" value={kpi.totalOpen} color="text-blue-500" />
          <KpiCard label="Overdue SLA" value={kpi.overdueFirstResponse} color="text-red-500" />
          <KpiCard label="High/Urgent" value={kpi.highUrgentOpen} color="text-amber-500" />
          <KpiCard label="Resolved Today" value={kpi.resolvedToday} color="text-emerald-500" />
          <KpiCard
            label="Avg Response"
            value={kpi.avgFirstResponseHours != null ? `${kpi.avgFirstResponseHours}h` : '—'}
            color="text-cyan-500"
          />
          <KpiCard
            label="Avg Resolution"
            value={kpi.avgResolutionHours != null ? `${kpi.avgResolutionHours}h` : '—'}
            color="text-purple-500"
          />
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-[var(--brand-muted)]" />
              Support Requests
            </CardTitle>
            <div className="flex items-center gap-2">
              {viewTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setView(tab.key)}
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors',
                    view === tab.key
                      ? 'bg-[var(--brand-primary)] text-white'
                      : 'bg-[var(--brand-surface)] text-[var(--brand-muted)] hover:text-[var(--brand-text)]',
                  )}
                >
                  {tab.label}
                  {tab.count != null && tab.count > 0 && (
                    <span className="ml-1">({tab.count})</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--brand-muted)]" />
            <Input
              placeholder="Search by subject, code, or client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="text-xs text-[var(--brand-muted)] text-center py-8">No requests found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--brand-border)]">
                    <th className="text-left py-2 px-2 font-medium text-[var(--brand-muted)]">Code</th>
                    <th className="text-left py-2 px-2 font-medium text-[var(--brand-muted)]">Subject</th>
                    <th className="text-left py-2 px-2 font-medium text-[var(--brand-muted)]">Client</th>
                    <th className="text-left py-2 px-2 font-medium text-[var(--brand-muted)]">Priority</th>
                    <th className="text-left py-2 px-2 font-medium text-[var(--brand-muted)]">Status</th>
                    <th className="text-left py-2 px-2 font-medium text-[var(--brand-muted)]">Category</th>
                    <th className="text-left py-2 px-2 font-medium text-[var(--brand-muted)]">SLA</th>
                    <th className="text-right py-2 px-2 font-medium text-[var(--brand-muted)]">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const slaLabel = getSlaLabel(r)
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-[var(--brand-border)] hover:bg-[var(--brand-surface)] cursor-pointer"
                        onClick={() => { window.location.href = `/ops/requests/${r.id}` }}
                      >
                        <td className="py-2 px-2 font-mono text-[var(--brand-muted)]">{r.shortCode}</td>
                        <td className="py-2 px-2 font-medium text-[var(--brand-text)] max-w-[200px] truncate">
                          {r.subject}
                        </td>
                        <td className="py-2 px-2 text-[var(--brand-muted)]">{r.clientName}</td>
                        <td className="py-2 px-2">
                          <Badge variant="outline" className={cn('text-[10px]', PRIORITY_BADGE[r.priority])}>
                            {PRIORITY_LABELS[r.priority]}
                          </Badge>
                        </td>
                        <td className="py-2 px-2">
                          <span className={cn('font-medium', STATUS_COLORS[r.status])}>
                            {STATUS_LABELS[r.status]}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-[var(--brand-muted)]">{CATEGORY_LABELS[r.category]}</td>
                        <td className="py-2 px-2">
                          <span className={cn('text-[10px] font-medium', slaLabel.color)}>
                            {slaLabel.text}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right text-[var(--brand-muted)] tabular-nums">
                          {formatTimeAgo(r.createdAt)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function KpiCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[10px] font-medium text-[var(--brand-muted)] uppercase tracking-wider mb-1">
          {label}
        </p>
        <p className={cn('text-lg font-bold tabular-nums', color)}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      </CardContent>
    </Card>
  )
}

function getSlaLabel(r: RequestWithClient): { text: string; color: string } {
  if (r.firstRespondedAt) {
    return { text: 'Responded', color: 'text-blue-500' }
  }
  if (!r.firstResponseDueAt) {
    return { text: '—', color: 'text-gray-400' }
  }
  const diff = Date.parse(r.firstResponseDueAt) - Date.now()
  const hours = Math.round((diff / (60 * 60 * 1000)) * 10) / 10
  if (diff < 0) {
    return { text: `${Math.abs(hours)}h overdue`, color: 'text-red-500' }
  }
  if (hours <= 4) {
    return { text: `${hours}h left`, color: 'text-amber-500' }
  }
  return { text: `${Math.round(hours)}h left`, color: 'text-emerald-500' }
}

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - Date.parse(isoDate)
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}
