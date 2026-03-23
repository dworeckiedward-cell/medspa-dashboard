'use client'

import { useState } from 'react'
import { formatDistanceToNowStrict, parseISO, isBefore, addHours } from 'date-fns'
import {
  Phone,
  Clock,
  AlertTriangle,
  CheckCircle2,
  AlarmClock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/dashboard/use-language'
import type { FollowUpTask, FollowUpTaskType } from '@/lib/types/domain'
import { FOLLOWUP_TYPE_LABELS } from '@/lib/types/domain'
import { useDashboardData } from './dashboard-data-provider'
import { CallDetailPanel } from './call-detail-panel'
import type { CallLog } from '@/types/database'

interface FollowUpQueueProps {
  tasks: FollowUpTask[]
  tenantSlug?: string
}

// ── SLA helpers ───────────────────────────────────────────────────────────────

function getSlaStatus(dueAt: string): 'overdue' | 'due_soon' | 'on_track' {
  const due = parseISO(dueAt)
  const now = new Date()
  if (isBefore(due, now)) return 'overdue'
  if (isBefore(due, addHours(now, 4))) return 'due_soon'
  return 'on_track'
}

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNowStrict(parseISO(iso), { addSuffix: true })
  } catch {
    return '—'
  }
}

// ── SLA badge ────────────────────────────────────────────────────────────────

function SlaBadge({ dueAt }: { dueAt: string }) {
  const { t } = useLanguage()
  const status = getSlaStatus(dueAt)
  const config = {
    overdue: { label: t.followUp.overdue, variant: 'destructive' as const, icon: AlertTriangle },
    due_soon: { label: t.followUp.dueSoon, variant: 'warning' as const, icon: Clock },
    on_track: { label: t.followUp.onTrack, variant: 'muted' as const, icon: CheckCircle2 },
  }[status]

  const Icon = config.icon
  return (
    <Badge variant={config.variant} className="flex items-center gap-1 text-[10px]">
      <Icon className="h-2.5 w-2.5" />
      {config.label}
    </Badge>
  )
}

// ── Task card ────────────────────────────────────────────────────────────────

type CallState = 'idle' | 'loading' | 'success' | 'error'

function TaskCard({ task, tenantSlug, onOpenDetail }: { task: FollowUpTask; tenantSlug?: string; onOpenDetail?: () => void }) {
  const { t } = useLanguage()
  const [scriptExpanded, setScriptExpanded] = useState(false)
  const [done, setDone] = useState(false)
  const [snoozed, setSnoozed] = useState(false)
  const [callState, setCallState] = useState<CallState>('idle')

  async function handleFollowUp() {
    const phone = task.contact?.phone
    if (!phone || callState !== 'idle') return
    setCallState('loading')
    try {
      const res = await fetch('/api/follow-up/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          firstName: task.contact?.fullName?.split(' ')[0] ?? 'there',
          tenantSlug,
        }),
      })
      if (res.ok) {
        setCallState('success')
        setTimeout(() => setCallState('idle'), 3000)
      } else {
        setCallState('error')
        setTimeout(() => setCallState('idle'), 3000)
      }
    } catch {
      setCallState('error')
      setTimeout(() => setCallState('idle'), 3000)
    }
  }

  if (done || snoozed) {
    return (
      <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)]/40 px-4 py-3 flex items-center gap-3 opacity-60">
        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
        <span className="text-xs text-[var(--brand-muted)]">
          {done ? 'Marked as done' : 'Snoozed for 4 hours'}
        </span>
      </div>
    )
  }

  const contact = task.contact
  const slaStatus = getSlaStatus(task.dueAt)

  return (
    <div
      className={cn(
        'rounded-lg border bg-[var(--brand-surface)] px-4 py-4 space-y-3',
        slaStatus === 'overdue'
          ? 'border-rose-300 dark:border-rose-900/40'
          : 'border-[var(--brand-border)]',
        onOpenDetail && 'cursor-pointer hover:bg-[var(--brand-bg)]/40 transition-colors',
      )}
      onClick={onOpenDetail}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* Contact name */}
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-[var(--brand-text)]">
              {contact?.fullName ?? 'Unknown lead'}
            </p>
            <SlaBadge dueAt={task.dueAt} />
            <Badge variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'warning' : 'muted'} className="text-[10px]">
              {task.priority}
            </Badge>
            {task.bookingLinkSent && (
              <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                Link sent
              </span>
            )}
          </div>

          {/* Phone */}
          {contact?.phone && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Phone className="h-3 w-3 text-[var(--brand-muted)] shrink-0" />
              <a
                href={`tel:${contact.phone}`}
                className="text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {contact.phone}
              </a>
            </div>
          )}
        </div>

        {/* Due time */}
        <div className="shrink-0 text-right">
          <p className={cn(
            'text-xs font-medium tabular-nums',
            slaStatus === 'overdue' ? 'text-rose-500 dark:text-rose-400' : 'text-[var(--brand-muted)]',
          )}>
            {relativeTime(task.dueAt)}
          </p>
          <p className="text-[10px] text-[var(--brand-muted)] opacity-60 capitalize">
            {FOLLOWUP_TYPE_LABELS[task.taskType as FollowUpTaskType] ?? task.taskType}
          </p>
        </div>
      </div>

      {/* Reason */}
      <p className="text-xs text-[var(--brand-text)] leading-relaxed">{task.reason}</p>

      {/* Suggested action */}
      {task.suggestedAction && (
        <div className="rounded-md bg-[var(--user-accent-soft)] border border-[var(--user-accent)]/20 px-3 py-2">
          <p className="text-xs font-medium text-[var(--user-accent)] mb-0.5">{t.followUp.suggestedAction}</p>
          <p className="text-xs text-[var(--brand-text)]">{task.suggestedAction}</p>
        </div>
      )}

      {/* Suggested script (collapsible) */}
      {task.suggestedScript && (
        <div>
          <button
            onClick={() => setScriptExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
          >
            {scriptExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {t.followUp.suggestedScript}
          </button>
          {scriptExpanded && (
            <div className="mt-1.5 rounded-md bg-[var(--brand-bg)]/50 border border-[var(--brand-border)] px-3 py-2">
              <p className="text-xs text-[var(--brand-text)] italic leading-relaxed">
                "{task.suggestedScript}"
              </p>
            </div>
          )}
        </div>
      )}

      {/* Quick actions */}
      <div className="flex items-center gap-2 pt-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-emerald-500/20"
          onClick={() => setDone(true)}
        >
          <CheckCircle2 className="h-3 w-3 mr-1" />
          {t.followUp.markDone}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)] border border-[var(--brand-border)]"
          onClick={() => setSnoozed(true)}
        >
          <AlarmClock className="h-3 w-3 mr-1" />
          {t.followUp.snooze}
        </Button>

        {/* Follow Up call button — only shown when contact has a phone number */}
        {task.contact?.phone && (
          <Button
            size="sm"
            variant="ghost"
            disabled={callState === 'loading'}
            onClick={handleFollowUp}
            className={cn(
              'h-7 text-xs border transition-colors duration-150',
              callState === 'idle'
                ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                : callState === 'loading'
                  ? 'text-[var(--brand-muted)] border-[var(--brand-border)] cursor-not-allowed'
                  : callState === 'success'
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : 'text-rose-500 border-rose-400/40',
            )}
          >
            {callState === 'idle' && <><Phone className="h-3 w-3 mr-1" />Call</>}
            {callState === 'loading' && <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Calling...</>}
            {callState === 'success' && <><CheckCircle2 className="h-3 w-3 mr-1" />Queued</>}
            {callState === 'error' && <><X className="h-3 w-3 mr-1" />Failed</>}
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)] ml-auto"
          asChild
        >
          <a href="/dashboard/leads">
            <ExternalLink className="h-3 w-3 mr-1" />
            {t.followUp.openLead}
          </a>
        </Button>
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyQueue() {
  const { t } = useLanguage()
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
        <CheckCircle2 className="h-6 w-6 text-emerald-500 opacity-60" />
      </div>
      <div>
        <p className="text-sm font-medium text-[var(--brand-muted)]">{t.followUp.noTasks}</p>
        <p className="text-xs text-[var(--brand-muted)] opacity-60 mt-1">{t.followUp.noTasksHint}</p>
      </div>
    </div>
  )
}

// ── Main queue component ──────────────────────────────────────────────────────

export function FollowUpQueue({ tasks, tenantSlug }: FollowUpQueueProps) {
  const { t } = useLanguage()
  const ctx = useDashboardData()
  const [selectedLog, setSelectedLog] = useState<CallLog | null>(null)

  const openTasks = tasks.filter((t) => t.status !== 'done')

  const sortedTasks = [...openTasks].sort((a, b) => {
    const slaA = getSlaStatus(a.dueAt)
    const slaB = getSlaStatus(b.dueAt)
    const slaOrder = { overdue: 0, due_soon: 1, on_track: 2 }
    if (slaOrder[slaA] !== slaOrder[slaB]) return slaOrder[slaA] - slaOrder[slaB]
    const priOrder = { high: 0, medium: 1, low: 2 }
    return priOrder[a.priority] - priOrder[b.priority]
  })

  function handleOpenDetail(task: FollowUpTask) {
    const log = ctx?.calls.find((c) => c.id === task.id) ?? null
    setSelectedLog(log)
  }

  return (
    <>
      <CallDetailPanel
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
        tenantSlug={tenantSlug}
      />

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>{t.followUp.pageTitle}</CardTitle>
          <CardDescription>
            {t.followUp.pageSubtitle} · {openTasks.length} open
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0">
          {sortedTasks.length === 0 ? (
            <EmptyQueue />
          ) : (
            <div className="space-y-3">
              {sortedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  tenantSlug={tenantSlug}
                  onOpenDetail={() => handleOpenDetail(task)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
