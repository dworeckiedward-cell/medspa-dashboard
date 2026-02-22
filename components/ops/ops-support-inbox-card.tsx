'use client'

import { Inbox, AlertTriangle, ArrowRight, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { RequestWithClient, RequestPriority, RequestStatus, SupportKpiSummary } from '@/lib/support/types'

// ── Props ────────────────────────────────────────────────────────────────────

interface OpsSupportInboxCardProps {
  requests: RequestWithClient[]
  kpi: SupportKpiSummary
}

// ── Priority config ─────────────────────────────────────────────────────────

const PRIORITY_DOT: Record<RequestPriority, string> = {
  urgent: 'bg-rose-500',
  high: 'bg-amber-500',
  normal: 'bg-blue-500',
  low: 'bg-gray-400',
}

const STATUS_STYLE: Record<RequestStatus, { bg: string; text: string }> = {
  open: { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-600 dark:text-blue-400' },
  acknowledged: { bg: 'bg-sky-50 dark:bg-sky-950/30', text: 'text-sky-600 dark:text-sky-400' },
  in_progress: { bg: 'bg-violet-50 dark:bg-violet-950/30', text: 'text-violet-600 dark:text-violet-400' },
  waiting_for_client: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-600 dark:text-amber-400' },
  resolved: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-600 dark:text-emerald-400' },
  closed: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-500 dark:text-gray-400' },
  reopened: { bg: 'bg-rose-50 dark:bg-rose-950/30', text: 'text-rose-600 dark:text-rose-400' },
}

const STATUS_SHORT: Record<RequestStatus, string> = {
  open: 'Open',
  acknowledged: 'Ack',
  in_progress: 'In Progress',
  waiting_for_client: 'Waiting',
  resolved: 'Resolved',
  closed: 'Closed',
  reopened: 'Reopened',
}

// ── Component ────────────────────────────────────────────────────────────────

export function OpsSupportInboxCard({ requests, kpi }: OpsSupportInboxCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Inbox className="h-4 w-4 text-[var(--brand-muted)]" />
            Support Requests
          </CardTitle>
          <div className="flex items-center gap-2 text-xs">
            {kpi.totalOpen > 0 && (
              <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                {kpi.totalOpen} open
              </span>
            )}
            {kpi.overdueFirstResponse > 0 && (
              <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                <AlertTriangle className="h-3 w-3" />
                {kpi.overdueFirstResponse} overdue
              </span>
            )}
            {kpi.highUrgentOpen > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {kpi.highUrgentOpen} urgent/high
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30">
              <Inbox className="h-5 w-5 text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-[var(--brand-text)]">No open requests</p>
            <p className="text-xs text-[var(--brand-muted)]">All support requests have been resolved</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-[var(--brand-border)]">
              {requests.map((req) => (
                <RequestRow key={req.id} request={req} />
              ))}
            </div>
            <a
              href="/ops/requests"
              className="flex items-center justify-center gap-1 w-full px-4 py-2.5 text-xs font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] border-t border-[var(--brand-border)] transition-colors"
            >
              View all requests
              <ArrowRight className="h-3 w-3" />
            </a>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ── Request row ──────────────────────────────────────────────────────────────

function RequestRow({ request }: { request: RequestWithClient }) {
  const statusStyle = STATUS_STYLE[request.status] ?? STATUS_STYLE.open
  const priorityDot = PRIORITY_DOT[request.priority] ?? PRIORITY_DOT.normal

  return (
    <a
      href={`/ops/requests/${request.id}`}
      className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--brand-surface)]/50 transition-colors group"
    >
      {/* Priority dot */}
      <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', priorityDot)} />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--brand-text)] truncate">
            {request.subject}
          </span>
          <span className={cn(
            'shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium',
            statusStyle.bg,
            statusStyle.text,
          )}>
            {STATUS_SHORT[request.status]}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-[var(--brand-muted)] truncate">
            {request.clientName}
          </span>
          <span className="text-[10px] text-[var(--brand-muted)] font-mono">
            {request.shortCode}
          </span>
        </div>
      </div>

      {/* Time ago */}
      <span className="shrink-0 flex items-center gap-1 text-[10px] text-[var(--brand-muted)] tabular-nums mt-0.5">
        <Clock className="h-3 w-3" />
        {formatTimeAgo(request.createdAt)}
      </span>
    </a>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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
