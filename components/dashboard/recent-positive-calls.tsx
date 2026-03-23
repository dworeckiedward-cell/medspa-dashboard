'use client'

import { useMemo } from 'react'
import { TrendingUp, Phone } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatDuration } from '@/lib/utils'
import type { CallLog } from '@/types/database'

interface RecentPositiveCallsProps {
  callLogs: CallLog[]
  onSelectCall?: (log: CallLog) => void
  className?: string
}

export function RecentPositiveCalls({ callLogs, onSelectCall, className }: RecentPositiveCallsProps) {
  const positiveCalls = useMemo(
    () =>
      callLogs
        .filter((c) => c.sentiment === 'positive')
        .slice(0, 4),
    [callLogs],
  )

  return (
    <Card className={cn('flex flex-col h-full', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-[var(--brand-text)] flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          Recent Positive Calls
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 px-4 pb-4">
        {positiveCalls.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center py-8">
            <Phone className="h-8 w-8 text-[var(--brand-border)]" />
            <p className="text-xs text-[var(--brand-muted)]">No positive calls yet</p>
          </div>
        ) : (
          <ul className="space-y-2.5 overflow-y-auto max-h-[280px]">
            {positiveCalls.map((log) => {
              const name = log.caller_name || log.caller_phone || 'Unknown'
              const title = (log.semantic_title || log.call_summary) ?? null
              const time = log.created_at
                ? formatDistanceToNow(parseISO(log.created_at), { addSuffix: true })
                : null
              const duration = log.duration_seconds ? formatDuration(log.duration_seconds) : null

              return (
                <li
                  key={log.id}
                  onClick={() => onSelectCall?.(log)}
                  className={cn(
                    'group rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-3 py-2.5 transition-colors',
                    onSelectCall && 'cursor-pointer hover:bg-[var(--brand-surface)] hover:border-emerald-500/30',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-[var(--brand-text)] truncate">{name}</p>
                      {title && (
                        <p className="text-[11px] text-[var(--brand-muted)] truncate mt-0.5">{title}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                        Positive
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    {time && (
                      <span className="text-[10px] text-[var(--brand-muted)]">{time}</span>
                    )}
                    {duration && time && (
                      <span className="text-[10px] text-[var(--brand-border)]">·</span>
                    )}
                    {duration && (
                      <span className="text-[10px] text-[var(--brand-muted)]">{duration}</span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
