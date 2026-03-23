'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
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
  PhoneOff,
  Link2,
  FileText,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, formatCurrency } from '@/lib/utils'
import { buildTenantApiUrl } from '@/lib/dashboard/tenant-api'
import { useDashboardData } from './dashboard-data-provider'
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
  onDeleted?: () => void
  tenantSlug?: string | null
}

// ── Status badge variant ──────────────────────────────────────────────────────

const statusVariant: Record<ContactStatus, 'success' | 'warning' | 'muted' | 'destructive' | 'brand' | 'accent'> = {
  new: 'brand',
  contacted: 'accent',
  booking_link_sent: 'warning',
  clicked_link: 'accent',
  booked: 'success',
  lost: 'muted',
  interested: 'warning',
  reactivation: 'muted',
  queued: 'muted',
  not_interested: 'destructive',
  followup_needed: 'warning',
  callback: 'warning',
  follow_up_exhausted: 'muted',
}

// ── Quick action buttons ──────────────────────────────────────────────────────

function QuickActions({ contact, onClose, tenantSlug }: { contact: Contact; onClose: () => void; tenantSlug?: string | null }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function act(label: string, body: Record<string, unknown>) {
    console.log('[LeadDrawer] act called', { contactId: contact.id, label, body })
    setLoading(label)
    try {
      const res = await fetch(buildTenantApiUrl(`/api/leads/${contact.id}/status`, tenantSlug), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      console.log('[LeadDrawer] act response', res.status, res.ok)
      if (res.ok) {
        setDone(label)
        router.refresh()
        setTimeout(() => onClose(), 1200)
      } else {
        const resBody = await res.json().catch(() => ({}))
        console.error('[LeadDrawer] act failed', res.status, resBody)
        alert(`Failed (${res.status}): ${(resBody as { error?: string }).error ?? 'Unknown error'}`)
      }
    } catch (err) {
      console.error('[LeadDrawer] act error', err)
      alert(`Network error: ${String(err)}`)
    } finally {
      setLoading(null)
    }
  }

  const actions = [
    {
      label: 'Mark Booked',
      body: { lead_status: 'booked' },
      className: 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30',
    },
    {
      label: 'Needs Follow-up',
      body: { lead_status: 'followup_needed', human_followup_needed: true },
      className: 'border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30',
    },
    {
      label: 'Mark Lost',
      body: { lead_status: 'lost' },
      className: 'border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30',
    },
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <button
          key={a.label}
          disabled={!!loading}
          onClick={() => { console.log('[LeadDrawer] button clicked', a.label); act(a.label, a.body) }}
          className={cn(
            'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
            done === a.label
              ? 'border-[var(--brand-border)] text-[var(--brand-muted)]'
              : a.className,
          )}
        >
          {done === a.label && <CheckCircle2 className="h-3 w-3" />}
          {loading === a.label ? 'Saving…' : done === a.label ? 'Done!' : a.label}
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
    follow_up: 'text-amber-600 dark:text-amber-400',
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
    booking_link_sent: 'text-amber-600 dark:text-amber-400',
    clicked_link: 'text-amber-600 dark:text-amber-400',
    follow_up: 'text-amber-600 dark:text-amber-400',
    followup_needed: 'text-amber-600 dark:text-amber-400',
    interested: 'text-[var(--brand-primary)]',
    no_answer: 'text-[var(--brand-muted)]',
    not_interested: 'text-rose-600 dark:text-rose-400',
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

export function LeadDetailDrawer({ contact, onClose, onDeleted, tenantSlug }: LeadDetailDrawerProps) {
  const router = useRouter()
  const dashboardData = useDashboardData()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDncConfirm, setShowDncConfirm] = useState(false)
  const [dncDone, setDncDone] = useState(false)
  const [dncLoading, setDncLoading] = useState(false)
  const [notes, setNotes] = useState(contact?.notes ?? '')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const notesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const saveNotes = useCallback(async (value: string) => {
    if (!contact) return
    setNotesSaving(true)
    setNotesSaved(false)
    try {
      await fetch(buildTenantApiUrl(`/api/leads/${contact.id}/notes`, tenantSlug), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: value }),
      })
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 2000)
    } finally {
      setNotesSaving(false)
    }
  }, [contact, tenantSlug])

  function handleNotesChange(value: string) {
    setNotes(value)
    setNotesSaved(false)
    if (notesTimeoutRef.current) clearTimeout(notesTimeoutRef.current)
    notesTimeoutRef.current = setTimeout(() => saveNotes(value), 1500)
  }

  async function handleDnc() {
    if (!contact) return
    setDncLoading(true)
    try {
      const res = await fetch(buildTenantApiUrl(`/api/leads/${contact.id}/dnc`, tenantSlug), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: contact.phone }),
      })
      if (res.ok) {
        dashboardData?.refresh()
        router.refresh()
        setDncDone(true)
        setShowDncConfirm(false)
        setTimeout(() => onClose(), 1200)
      }
    } finally {
      setDncLoading(false)
    }
  }

  if (!contact) return null

  // Build chronological timeline from calls + tasks + appointments + click event
  type TimelineItem =
    | { type: 'call'; at: string; data: CallLogEntry }
    | { type: 'task'; at: string; data: FollowUpTask }
    | { type: 'appointment'; at: string; data: Appointment }
    | { type: 'link_clicked'; at: string; data: null }

  const timeline: TimelineItem[] = [
    ...(contact.recentCalls ?? []).map((c) => ({ type: 'call' as const, at: c.startedAt, data: c })),
    ...(contact.openFollowUpTasks ?? []).map((t) => ({ type: 'task' as const, at: t.createdAt, data: t })),
    ...(contact.appointments ?? []).map((a) => ({ type: 'appointment' as const, at: a.startAt, data: a })),
    ...(contact.bookingLinkClickedAt ? [{ type: 'link_clicked' as const, at: contact.bookingLinkClickedAt, data: null }] : []),
  ].sort((a, b) => b.at.localeCompare(a.at))

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/leads/${contact!.id}/delete`, { method: 'DELETE' })
      if (res.ok) {
        dashboardData?.refresh()
        router.refresh()
        onDeleted?.()
        onClose()
      }
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
        <DialogContent className="sm:max-w-xl overflow-y-auto p-0">
          {/* ── Header ─────────────────────────────────────────────── */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-[var(--brand-border)]/50">
            <div className="pr-6">
              <DialogTitle className="text-lg font-semibold text-[var(--brand-text)] leading-tight">
                {contact.fullName}
              </DialogTitle>
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
                <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors">
                  <Phone className="h-3 w-3 shrink-0" />
                  {contact.phone}
                </a>
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors">
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

            {contact.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {contact.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px] py-0 px-1.5">{tag}</Badge>
                ))}
              </div>
            )}
            <div className="mt-3">
              <QuickActions contact={contact} onClose={onClose} tenantSlug={tenantSlug} />
            </div>
          </DialogHeader>

          {/* ── Callback banner ─────────────────────────────────────── */}
          {contact.status === 'callback' && (
            <div className="mx-6 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/30">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Lead asked to be called back</p>
              <p className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-0.5">Will retry in the next calling window.</p>
            </div>
          )}

          {/* ── AI Summary ─────────────────────────────────────────── */}
          <div className="px-6 py-4 border-b border-[var(--brand-border)]/50">
            <p className="text-xs font-semibold text-[var(--brand-muted)] uppercase tracking-wider mb-3">AI Summary</p>
            <AiSummaryCard contact={contact} />
          </div>

          {/* ── Timeline ───────────────────────────────────────────── */}
          <div className="px-6 py-4 border-b border-[var(--brand-border)]/50">
            <p className="text-xs font-semibold text-[var(--brand-muted)] uppercase tracking-wider mb-3">Timeline</p>
            {timeline.length === 0 ? (
              <p className="text-xs text-[var(--brand-muted)] opacity-60">No activity yet.</p>
            ) : (
              <div className="space-y-4">
                {timeline.map((item, i) => (
                  <div key={i}>
                    {item.type === 'call' && <CallTimelineItem call={item.data} />}
                    {item.type === 'task' && <TaskTimelineItem task={item.data} />}
                    {item.type === 'appointment' && <AppointmentTimelineItem appt={item.data} />}
                    {item.type === 'link_clicked' && (
                      <div className="relative pl-7">
                        <div className="absolute left-0 top-1 h-4 w-4 flex items-center justify-center rounded-full border border-[var(--brand-primary)]/40 bg-[var(--brand-bg)]">
                          <Link2 className="h-2.5 w-2.5 text-[var(--brand-primary)] shrink-0" />
                        </div>
                        <div>
                          <span className="text-xs font-medium text-[var(--brand-text)]">Opened booking link</span>
                          <p className="text-[10px] text-[var(--brand-muted)] mt-0.5">
                            {format(parseISO(item.at), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Notes ──────────────────────────────────────────────── */}
          <div className="px-6 py-4 border-b border-[var(--brand-border)]/50">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-[var(--brand-muted)] uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="h-3 w-3" />
                Notes
              </p>
              {notesSaving && (
                <span className="text-[10px] text-[var(--brand-muted)] flex items-center gap-1">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" /> Saving…
                </span>
              )}
              {notesSaved && (
                <span className="text-[10px] text-emerald-500 flex items-center gap-1">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Saved
                </span>
              )}
            </div>
            <textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              onBlur={() => { if (notesTimeoutRef.current) { clearTimeout(notesTimeoutRef.current); notesTimeoutRef.current = null } saveNotes(notes) }}
              placeholder="Add notes about this lead…"
              rows={3}
              className="w-full rounded-md border border-[var(--brand-border)] bg-[var(--brand-bg)]/50 px-3 py-2 text-xs text-[var(--brand-text)] placeholder:text-[var(--brand-muted)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]/40 resize-none"
            />
          </div>

          {/* ── Transcript ─────────────────────────────────────────── */}
          <div className="px-6 py-4 border-b border-[var(--brand-border)]/50">
            <p className="text-xs font-semibold text-[var(--brand-muted)] uppercase tracking-wider mb-3">Transcript</p>
            <TranscriptSection calls={contact.recentCalls ?? []} />
          </div>

          {/* ── Footer: DNC + Delete ───────────────────────────────── */}
          <div className="px-6 py-4 flex items-center gap-4">
            <button
              onClick={() => setShowDncConfirm(true)}
              disabled={dncDone}
              className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 dark:text-amber-500 transition-colors disabled:opacity-50"
            >
              <PhoneOff className="h-3.5 w-3.5" />
              {dncDone ? 'Blocked ✓' : 'Do Not Call'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 text-xs text-rose-500 hover:text-rose-600 transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" />
              Delete Lead
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DNC confirm overlay */}
      {showDncConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDncConfirm(false)} />
          <div className="relative bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-start gap-3 mb-5">
              <PhoneOff className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-[var(--brand-text)]">Block this number?</h3>
                <p className="text-xs text-[var(--brand-muted)] mt-1">
                  Emma will never call <strong>{contact.phone}</strong> again. This cannot be undone from the dashboard.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDncConfirm(false)}
                className="px-3 py-1.5 rounded-lg border border-[var(--brand-border)] text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDnc}
                disabled={dncLoading}
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors disabled:opacity-60"
              >
                {dncLoading ? 'Blocking…' : 'Block Number'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm overlay */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-start gap-3 mb-5">
              <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-[var(--brand-text)]">Delete Lead?</h3>
                <p className="text-xs text-[var(--brand-muted)] mt-1">
                  This will permanently remove <strong>{contact.fullName}</strong> from your leads list. The original call log is preserved.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 rounded-lg border border-[var(--brand-border)] text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 rounded-lg bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 transition-colors disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Delete Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
