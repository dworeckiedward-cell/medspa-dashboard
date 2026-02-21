'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import {
  Phone,
  Mail,
  Clock,
  CalendarCheck,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Copy,
  ChevronDown,
  ChevronUp,
  Zap,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
} from 'lucide-react'
import { Sheet, SheetContent, SheetSection } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, formatCurrency } from '@/lib/utils'
import type {
  Contact,
  ContactStatus,
  CallLogEntry,
  FollowUpTask,
  Appointment,
} from '@/lib/types/domain'
import { CONTACT_STATUS_LABELS } from '@/lib/types/domain'

interface LeadDetailDrawerProps {
  contact: Contact | null
  onClose: () => void
}

// ── Status badge variant ──────────────────────────────────────────────────────

const statusVariant: Record<ContactStatus, 'success' | 'warning' | 'muted' | 'destructive' | 'brand' | 'accent'> = {
  new: 'brand',
  contacted: 'accent',
  interested: 'warning',
  booked: 'success',
  lost: 'destructive',
  reactivation: 'muted',
}

// ── Quick action buttons ──────────────────────────────────────────────────────

function QuickActions({ contact }: { contact: Contact }) {
  const [done, setDone] = useState<string | null>(null)

  function act(label: string) {
    setDone(label)
    setTimeout(() => setDone(null), 2000)
  }

  const actions = [
    { label: 'Mark Booked', className: 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30' },
    { label: 'Needs Follow-up', className: 'border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30' },
    { label: 'Mark Lost', className: 'border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30' },
  ]

  // Suppress unused variable lint — will wire to real API
  void contact

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <button
          key={a.label}
          onClick={() => act(a.label)}
          className={cn(
            'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
            done === a.label
              ? 'border-[var(--brand-border)] text-[var(--brand-muted)]'
              : a.className,
          )}
        >
          {done === a.label && <CheckCircle2 className="h-3 w-3" />}
          {done === a.label ? 'Done!' : a.label}
        </button>
      ))}
    </div>
  )
}

// ── AI Summary card ───────────────────────────────────────────────────────────

function AiSummaryCard({ contact }: { contact: Contact }) {
  const summary = contact.latestCallSummary
  const structured = summary?.structuredSummary

  if (!summary) {
    // Check if summary is still processing
    const latestCall = contact.recentCalls?.[0]
    const isPending = latestCall?.summaryStatus === 'pending'

    return (
      <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)]/40 px-4 py-5 flex items-center gap-3">
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 text-[var(--brand-muted)] shrink-0 animate-spin" />
            <div>
              <p className="text-xs font-medium text-[var(--brand-text)]">Summary processing…</p>
              <p className="text-xs text-[var(--brand-muted)] opacity-70 mt-0.5">
                AI is analysing this call. Check back in a moment.
              </p>
            </div>
          </>
        ) : (
          <>
            <Zap className="h-4 w-4 text-[var(--brand-muted)] shrink-0 opacity-40" />
            <p className="text-xs text-[var(--brand-muted)]">No AI summary available for this lead yet.</p>
          </>
        )}
      </div>
    )
  }

  const sentimentStyle = {
    positive: 'text-emerald-600 dark:text-emerald-400',
    neutral: 'text-[var(--brand-muted)]',
    negative: 'text-rose-600 dark:text-rose-400',
  }[summary.sentiment ?? 'neutral']

  const urgencyVariant: Record<string, 'destructive' | 'warning' | 'muted'> = {
    high: 'destructive', medium: 'warning', low: 'muted',
  }

  return (
    <div className="space-y-4">
      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2">
        {summary.sentiment && (
          <span className={cn('text-xs font-medium capitalize', sentimentStyle)}>
            {summary.sentiment}
          </span>
        )}
        {structured?.urgency && (
          <Badge variant={urgencyVariant[structured.urgency] ?? 'muted'} className="text-xs">
            {structured.urgency} urgency
          </Badge>
        )}
        {structured?.intent && (
          <Badge variant="outline" className="text-xs capitalize">
            {structured.intent.replace(/_/g, ' ')}
          </Badge>
        )}
        {structured?.outcome && (
          <Badge variant="outline" className="text-xs capitalize">
            Outcome: {structured.outcome.replace(/_/g, ' ')}
          </Badge>
        )}
      </div>

      {/* Plain summary */}
      <p className="text-sm text-[var(--brand-text)] leading-relaxed">{summary.plainSummary}</p>

      {/* Objections */}
      {structured?.objections && structured.objections.length > 0 && (
        <div>
          <p className="text-xs font-medium text-[var(--brand-muted)] mb-1.5">Objections raised</p>
          <ul className="space-y-1">
            {structured.objections.map((obj, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--brand-text)]">
                <XCircle className="h-3 w-3 text-rose-500 shrink-0 mt-0.5" />
                {obj}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Key facts */}
      {structured?.keyFacts && structured.keyFacts.length > 0 && (
        <div>
          <p className="text-xs font-medium text-[var(--brand-muted)] mb-1.5">Key facts</p>
          <ul className="space-y-1">
            {structured.keyFacts.map((fact, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--brand-text)]">
                <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                {fact}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next best action */}
      {structured?.nextBestAction && (
        <div className="rounded-lg border border-[var(--user-accent)]/20 bg-[var(--user-accent-soft)] px-4 py-3">
          <p className="text-xs font-semibold text-[var(--user-accent)] mb-1">Next best action</p>
          <p className="text-xs text-[var(--brand-text)]">{structured.nextBestAction}</p>
        </div>
      )}

      {/* Callback script */}
      {structured?.callbackScript && (
        <div>
          <p className="text-xs font-medium text-[var(--brand-muted)] mb-1.5">Suggested callback script</p>
          <div className="rounded-md bg-[var(--brand-bg)]/50 border border-[var(--brand-border)] px-3 py-2.5">
            <p className="text-xs text-[var(--brand-text)] italic leading-relaxed">
              "{structured.callbackScript}"
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Call timeline item ────────────────────────────────────────────────────────

function CallTimelineItem({ call }: { call: CallLogEntry }) {
  const [expanded, setExpanded] = useState(false)

  const dirIcon = call.direction === 'inbound'
    ? <ArrowDownLeft className="h-3 w-3 text-[var(--brand-primary)] shrink-0" />
    : <ArrowUpRight className="h-3 w-3 text-amber-500 shrink-0" />

  const outcomeColor = {
    booked: 'text-emerald-600 dark:text-emerald-400',
    follow_up: 'text-amber-600 dark:text-amber-400',
    no_answer: 'text-[var(--brand-muted)]',
    not_interested: 'text-rose-600 dark:text-rose-400',
    interested: 'text-[var(--brand-primary)]',
  }[call.outcome ?? ''] ?? 'text-[var(--brand-muted)]'

  return (
    <div className="relative pl-7">
      {/* Timeline dot */}
      <div className="absolute left-0 top-1 h-4 w-4 flex items-center justify-center rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface)]">
        {dirIcon}
      </div>

      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-medium text-[var(--brand-text)] capitalize">
              {call.callType.replace(/_/g, ' ')}
            </span>
            <span className={cn('text-xs capitalize', outcomeColor)}>
              · {call.outcome?.replace(/_/g, ' ') ?? 'unknown'}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[10px] text-[var(--brand-muted)]">
              {format(parseISO(call.startedAt), 'MMM d, h:mm a')}
            </span>
            {call.durationSec > 0 && (
              <span className="text-[10px] text-[var(--brand-muted)]">
                {Math.floor(call.durationSec / 60)}m {call.durationSec % 60}s
              </span>
            )}
            {call.summaryStatus === 'pending' && (
              <span className="text-[10px] text-amber-500 flex items-center gap-1">
                <Loader2 className="h-2.5 w-2.5 animate-spin" /> Summary pending
              </span>
            )}
          </div>
          {call.summary?.plainSummary && !expanded && (
            <p className="text-xs text-[var(--brand-muted)] opacity-70 mt-1 line-clamp-1">
              {call.summary.plainSummary}
            </p>
          )}
          {expanded && call.summary?.plainSummary && (
            <p className="text-xs text-[var(--brand-text)] mt-1 leading-relaxed">
              {call.summary.plainSummary}
            </p>
          )}
        </div>
        {call.summary && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
          >
            {expanded
              ? <ChevronUp className="h-3.5 w-3.5" />
              : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Follow-up task timeline item ──────────────────────────────────────────────

function TaskTimelineItem({ task }: { task: FollowUpTask }) {
  const isOverdue = new Date(task.dueAt) < new Date() && task.status === 'open'

  return (
    <div className="relative pl-7">
      <div className="absolute left-0 top-1 h-4 w-4 flex items-center justify-center rounded-full border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30">
        <AlertCircle className="h-2.5 w-2.5 text-amber-500 shrink-0" />
      </div>

      <div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-[var(--brand-text)] capitalize">
            {task.taskType.replace(/_/g, ' ')}
          </span>
          <Badge variant={isOverdue ? 'destructive' : 'warning'} className="text-[10px]">
            {isOverdue ? 'Overdue' : task.status}
          </Badge>
        </div>
        <p className="text-xs text-[var(--brand-muted)] mt-0.5">{task.reason}</p>
        <p className="text-[10px] text-[var(--brand-muted)] opacity-60 mt-0.5">
          Due {format(parseISO(task.dueAt), 'MMM d, h:mm a')}
        </p>
        {task.suggestedScript && (
          <p className="text-xs text-[var(--brand-muted)] italic mt-1 border-l-2 border-[var(--brand-border)] pl-2 line-clamp-2">
            "{task.suggestedScript}"
          </p>
        )}
      </div>
    </div>
  )
}

// ── Appointment timeline item ─────────────────────────────────────────────────

function AppointmentTimelineItem({ appt }: { appt: Appointment }) {
  const statusColor = {
    booked: 'text-[var(--brand-primary)]',
    confirmed: 'text-emerald-600 dark:text-emerald-400',
    cancelled: 'text-rose-600 dark:text-rose-400',
    no_show: 'text-rose-600 dark:text-rose-400',
    completed: 'text-[var(--brand-muted)]',
  }[appt.status]

  return (
    <div className="relative pl-7">
      <div className="absolute left-0 top-1 h-4 w-4 flex items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30">
        <CalendarCheck className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
      </div>

      <div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-[var(--brand-text)]">{appt.serviceName}</span>
          <span className={cn('text-xs capitalize', statusColor)}>· {appt.status.replace(/_/g, ' ')}</span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[10px] text-[var(--brand-muted)]">
            {format(parseISO(appt.startAt), 'MMM d, h:mm a')}
          </span>
          {appt.providerName && (
            <span className="text-[10px] text-[var(--brand-muted)] opacity-70">
              with {appt.providerName}
            </span>
          )}
          {appt.valueEstimate > 0 && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              {formatCurrency(appt.valueEstimate)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Transcript section ────────────────────────────────────────────────────────

function TranscriptSection({ calls }: { calls: CallLogEntry[] }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const callWithTranscript = calls.find((c) => c.transcriptText)
  const transcript = callWithTranscript?.transcriptText

  if (!transcript) {
    return (
      <p className="text-xs text-[var(--brand-muted)] opacity-60">
        No transcript available for this lead.
      </p>
    )
  }

  function copyTranscript() {
    navigator.clipboard.writeText(transcript!).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-[var(--brand-text)] hover:text-[var(--user-accent)] transition-colors"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {expanded ? 'Collapse transcript' : 'Show transcript'}
        </button>
        {expanded && (
          <button
            onClick={copyTranscript}
            className="flex items-center gap-1 text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
          >
            <Copy className="h-3 w-3" />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        )}
      </div>
      {expanded && (
        <div className="rounded-md border border-[var(--brand-border)] bg-[var(--brand-bg)]/50 px-3 py-3 max-h-64 overflow-y-auto">
          <pre className="text-xs text-[var(--brand-text)] whitespace-pre-wrap font-sans leading-relaxed">
            {transcript}
          </pre>
        </div>
      )}
    </div>
  )
}

// ── Main drawer ───────────────────────────────────────────────────────────────

export function LeadDetailDrawer({ contact, onClose }: LeadDetailDrawerProps) {
  if (!contact) return null

  // Build chronological timeline from calls + tasks + appointments
  type TimelineItem =
    | { type: 'call'; at: string; data: CallLogEntry }
    | { type: 'task'; at: string; data: FollowUpTask }
    | { type: 'appointment'; at: string; data: Appointment }

  const timeline: TimelineItem[] = [
    ...(contact.recentCalls ?? []).map((c) => ({
      type: 'call' as const,
      at: c.startedAt,
      data: c,
    })),
    ...(contact.openFollowUpTasks ?? []).map((t) => ({
      type: 'task' as const,
      at: t.createdAt,
      data: t,
    })),
    ...(contact.appointments ?? []).map((a) => ({
      type: 'appointment' as const,
      at: a.startAt,
      data: a,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at)) // descending (newest first)

  return (
    <Sheet
      open={true}
      onClose={onClose}
      size="lg"
    >
      {/* ── Header section ─────────────────────────────────────────────────── */}
      <SheetContent className="pb-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            {/* Name + badges */}
            <h2 className="text-lg font-semibold text-[var(--brand-text)] leading-tight">
              {contact.fullName}
            </h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <Badge variant={statusVariant[contact.status]} className="text-xs">
                {CONTACT_STATUS_LABELS[contact.status]}
              </Badge>
              <Badge variant="outline" className="text-xs capitalize">
                {contact.source}
              </Badge>
              {contact.priorityScore >= 80 && (
                <Badge variant="destructive" className="text-xs">High priority</Badge>
              )}
              {contact.ownerType === 'human' && (
                <Badge variant="accent" className="text-xs">Human owned</Badge>
              )}
            </div>

            {/* Contact info */}
            <div className="flex flex-col gap-1 mt-3">
              <a
                href={`tel:${contact.phone}`}
                className="flex items-center gap-2 text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
              >
                <Phone className="h-3 w-3 shrink-0" />
                {contact.phone}
              </a>
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="flex items-center gap-2 text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
                >
                  <Mail className="h-3 w-3 shrink-0" />
                  {contact.email}
                </a>
              )}
              {contact.lastCallAt && (
                <div className="flex items-center gap-2 text-xs text-[var(--brand-muted)]">
                  <Clock className="h-3 w-3 shrink-0" />
                  Last call {format(parseISO(contact.lastCallAt), 'MMM d, h:mm a')}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tags */}
        {contact.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-4">
            {contact.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px] py-0 px-1.5">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Quick actions */}
        <div className="mt-4">
          <QuickActions contact={contact} />
        </div>
      </SheetContent>

      {/* ── AI Summary ────────────────────────────────────────────────────── */}
      <SheetSection title="AI Summary" className="px-6">
        <AiSummaryCard contact={contact} />
      </SheetSection>

      {/* ── Timeline ──────────────────────────────────────────────────────── */}
      <SheetSection title="Timeline" className="px-6">
        {timeline.length === 0 ? (
          <p className="text-xs text-[var(--brand-muted)] opacity-60">No activity yet.</p>
        ) : (
          <div className="space-y-4">
            {timeline.map((item, i) => (
              <div key={i}>
                {item.type === 'call' && <CallTimelineItem call={item.data} />}
                {item.type === 'task' && <TaskTimelineItem task={item.data} />}
                {item.type === 'appointment' && <AppointmentTimelineItem appt={item.data} />}
              </div>
            ))}
          </div>
        )}
      </SheetSection>

      {/* ── Transcript ────────────────────────────────────────────────────── */}
      <SheetSection title="Transcript" className="px-6">
        <TranscriptSection calls={contact.recentCalls ?? []} />
      </SheetSection>

      {/* ── CRM Sync status ───────────────────────────────────────────────── */}
      <SheetSection title="CRM Sync" className="px-6">
        <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)]/40 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--brand-text)]">Custom Webhook</span>
            <Badge variant="success" className="text-xs">Active</Badge>
          </div>
          <p className="text-xs text-[var(--brand-muted)] mt-1">
            Lead events are synced to your configured webhook endpoint.
          </p>
          <p className="text-[10px] text-[var(--brand-muted)] opacity-60 mt-1">
            External ID: {contact.id}
          </p>
        </div>
      </SheetSection>
    </Sheet>
  )
}
