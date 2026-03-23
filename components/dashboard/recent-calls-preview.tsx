'use client'

/**
 * RecentCallsPreview — shows the 5 most recent calls with a premium feel.
 *
 * Each row: status pill (Booked / Lead / Completed), caller name/phone,
 * semantic title, duration, relative timestamp, recording icon.
 * Click opens the call detail panel via onSelectCall callback.
 */

import { useMemo } from 'react'
import { Phone, Play, ArrowRight } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, polish, formatDuration } from '@/lib/utils'
import { useTabState } from './tab-state-context'
import type { CallLog } from '@/types/database'

// ── Helpers ─────────────────────────────────────────────────────────────────

function getStatusPill(log: CallLog): { label: string; className: string } {
  // Voicemail
  if (log.disposition === 'voicemail') {
    return {
      label: 'Voicemail',
      className: 'bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400',
    }
  }
  // No answer (typical outbound outcome)
  if (log.disposition === 'no_answer') {
    return {
      label: 'No Answer',
      className: 'bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400',
    }
  }
  // Booked — highest-value outcome
  if (log.is_booked) {
    return {
      label: 'Booked',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    }
  }
  // Sentiment
  if (log.sentiment === 'positive') {
    return {
      label: 'Positive',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    }
  }
  if (log.sentiment === 'negative') {
    return {
      label: 'Negative',
      className: 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
    }
  }
  if (log.sentiment === 'neutral') {
    return {
      label: 'Neutral',
      className: 'bg-[var(--brand-border)]/60 text-[var(--brand-muted)]',
    }
  }
  // Legacy fallback
  if (log.is_lead) {
    return {
      label: 'Lead',
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    }
  }
  // No sentiment or disposition yet — analysis still in progress
  if (!log.sentiment && !log.disposition) {
    return {
      label: 'Analyzing...',
      className: 'bg-[var(--brand-border)]/40 text-[var(--brand-muted)] italic',
    }
  }
  return {
    label: 'Completed',
    className: 'bg-[var(--brand-border)]/60 text-[var(--brand-muted)]',
  }
}

function callerDisplay(log: CallLog): string {
  if (log.caller_name) return log.caller_name
  if (log.caller_phone) return log.caller_phone
  return 'Unknown caller'
}

// ── Component ───────────────────────────────────────────────────────────────

interface RecentCallsPreviewProps {
  callLogs: CallLog[]
  onSelectCall: (log: CallLog) => void
  tenantSlug?: string // kept for API compat
  className?: string
}

export function RecentCallsPreview({ callLogs, onSelectCall, className }: RecentCallsPreviewProps) {
  const tabState = useTabState()
  const recentCalls = useMemo(() => {
    return [...callLogs]
      .filter((c) => {
        const hasContent = !!(c.caller_name || c.is_lead || c.is_booked || c.semantic_title || c.caller_phone)
        return hasContent
      })
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(0, 5)
  }, [callLogs])

  if (callLogs.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Phone className="h-4 w-4 text-[var(--brand-muted)]" />
            Recent Calls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={polish.emptyState}>
            <div className={polish.emptyIcon}>
              <Phone className="h-6 w-6 text-[var(--brand-muted)] opacity-50" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--brand-text)]">No calls yet</p>
              <p className="text-xs text-[var(--brand-muted)] opacity-60 mt-1 max-w-[260px] mx-auto">
                Once your AI receptionist is connected, recent calls will appear here.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Phone className="h-4 w-4 text-[var(--brand-muted)]" />
            Recent Calls
          </CardTitle>
          <button
            type="button"
            onClick={() => tabState?.setActiveTab('/dashboard/call-logs')}
            className="text-[11px] text-[var(--brand-primary)] hover:text-[var(--brand-primary)]/80 font-medium flex items-center gap-1 transition-colors"
          >
            View All
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y divide-[var(--brand-border)]/50">
          {recentCalls.map((log) => {
            const pill = getStatusPill(log)
            return (
              <button
                key={log.id}
                type="button"
                onClick={() => onSelectCall(log)}
                className="flex w-full items-center gap-3 py-3 text-left transition-colors duration-100 hover:bg-[var(--brand-bg)]/60 rounded-lg px-2 -mx-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/30"
              >
                {/* Status pill */}
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight',
                    pill.className,
                  )}
                >
                  {pill.label}
                </span>

                {/* Caller + phone */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[var(--brand-text)] truncate">
                    {log.caller_name ?? log.semantic_title ?? log.caller_phone ?? 'Unknown caller'}
                  </p>
                  {(log.caller_name || log.semantic_title) && log.caller_phone && (
                    <p className="text-[11px] text-[var(--brand-muted)] truncate mt-0.5">
                      {log.caller_phone}
                    </p>
                  )}
                </div>

                {/* Duration */}
                <span className="text-[11px] tabular-nums text-[var(--brand-muted)] shrink-0">
                  {log.duration_seconds > 0 ? formatDuration(log.duration_seconds) : '—'}
                </span>

                {/* Play icon — indicates recording available */}
                {log.recording_url && (
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)]/15 text-[var(--brand-primary)]"
                    title="Recording available"
                  >
                    <Play className="h-2.5 w-2.5 ml-px" />
                  </span>
                )}

                {/* Timestamp */}
                <span className="text-[10px] text-[var(--brand-muted)] opacity-70 shrink-0 whitespace-nowrap">
                  {formatDistanceToNow(parseISO(log.created_at), { addSuffix: true })}
                </span>

                {/* Arrow on hover */}
                <ArrowRight className="h-3 w-3 shrink-0 text-[var(--brand-muted)] opacity-0 group-hover:opacity-60 transition-opacity" />
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

/** Skeleton placeholder matching 5 recent-call rows. */
export function RecentCallsSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-3 w-12" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y divide-[var(--brand-border)]/50">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <Skeleton className="h-5 w-14 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-2.5 w-40" />
              </div>
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
