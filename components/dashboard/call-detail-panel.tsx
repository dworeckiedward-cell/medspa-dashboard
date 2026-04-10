'use client'

/**
 * CallDetailPanel — rich right-side Sheet for a selected call log.
 *
 * Sections:
 *  • Header:       title, caller, date/time, duration, direction + status badges
 *  • Recording:    audio player + download link (when recording_url exists)
 *  • AI Summary:   structured fields from ai_summary_json (intent, urgency, sentiment,
 *                  objections, key facts, next best action, callback script)
 *  • Action Items: follow-up flag + checklist derived from the structured summary
 *  • Outcomes:     disposition, appointment details, revenue breakdown
 *  • Transcript:   collapsible, role-parsed bubbles, search highlight, copy button
 */

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDashboardData } from './dashboard-data-provider'
import { format, parseISO } from 'date-fns'
import {
  Phone,
  Calendar,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Search,
  Zap,
  Target,
  MessageSquare,
  Mic,
  Download,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import { RecordingPlayer } from './recording-player'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatDuration, cn } from '@/lib/utils'
import { buildTenantApiUrl } from '@/lib/dashboard/tenant-api'
import type { CallLog, CallDisposition, CallSentiment } from '@/types/database'
import { CALL_DISPOSITION_LABELS, CALL_INTENT_LABELS } from '@/types/database'

// ── Structured summary shape (mirrors domain.ts StructuredSummary) ──────────

interface StructuredSummary {
  intent?: string | null
  sentiment?: 'positive' | 'neutral' | 'negative' | null
  urgency?: 'high' | 'medium' | 'low' | null
  objections?: string[]
  outcome?: string | null
  nextBestAction?: string | null
  callbackScript?: string | null
  keyFacts?: string[]
  unansweredQuestions?: string[]
}

function parseStructuredSummary(raw: Record<string, unknown> | null): StructuredSummary | null {
  if (!raw) return null
  return {
    intent:              typeof raw.intent === 'string'        ? raw.intent        : null,
    sentiment:           raw.sentiment === 'positive' || raw.sentiment === 'neutral' || raw.sentiment === 'negative'
                          ? raw.sentiment : null,
    urgency:             raw.urgency === 'high' || raw.urgency === 'medium' || raw.urgency === 'low'
                          ? raw.urgency : null,
    objections:          Array.isArray(raw.objections)         ? (raw.objections as string[]) : [],
    outcome:             typeof raw.outcome === 'string'       ? raw.outcome       : null,
    nextBestAction:      typeof raw.nextBestAction === 'string'? raw.nextBestAction: null,
    callbackScript:      typeof raw.callbackScript === 'string'? raw.callbackScript: null,
    keyFacts:            Array.isArray(raw.keyFacts)           ? (raw.keyFacts as string[]) : [],
    unansweredQuestions: Array.isArray(raw.unansweredQuestions)? (raw.unansweredQuestions as string[]) : [],
  }
}

// ── Transcript parser ────────────────────────────────────────────────────────

interface TranscriptLine {
  role: 'agent' | 'caller'
  text: string
}

function parseTranscript(raw: string | null | undefined): TranscriptLine[] {
  if (!raw) return []
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): TranscriptLine => {
      if (/^(agent|ai|bot|assistant)\s*:/i.test(line)) {
        return { role: 'agent',  text: line.replace(/^[^:]+:\s*/, '') }
      }
      if (/^(user|caller|customer|client)\s*:/i.test(line)) {
        return { role: 'caller', text: line.replace(/^[^:]+:\s*/, '') }
      }
      // Unrecognised prefix — attribute to caller
      return { role: 'caller', text: line }
    })
}

// ── Sentiment / urgency ──────────────────────────────────────────────────────

const sentimentConfig: Record<string, { label: string; className: string }> = {
  positive:  { label: 'Positive',  className: 'text-emerald-600 dark:text-emerald-400' },
  neutral:   { label: 'Neutral',   className: 'text-[var(--brand-muted)]' },
  negative:  { label: 'Negative',  className: 'text-rose-600 dark:text-rose-400' },
  follow_up: { label: 'Follow-up', className: 'text-amber-600 dark:text-amber-400' },
}

const urgencyConfig: Record<string, { label: string; variant: 'destructive' | 'warning' | 'muted' }> = {
  high:   { label: 'High Urgency',   variant: 'destructive' },
  medium: { label: 'Medium Urgency', variant: 'warning' },
  low:    { label: 'Low Urgency',    variant: 'muted' },
}

// ── Highlight helper ─────────────────────────────────────────────────────────

function highlight(text: string, query: string) {
  if (!query) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[var(--user-accent-soft)] text-[var(--brand-text)] rounded px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

// ── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text).catch(() => undefined)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-[10px] text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
      title={label}
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : label}
    </button>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

interface CallDetailPanelProps {
  log: CallLog | null
  onClose: () => void
  onDeleted?: () => void
  tenantSlug?: string | null
}

export function CallDetailPanel({ log: initialLog, onClose, onDeleted, tenantSlug }: CallDetailPanelProps) {
  const router = useRouter()
  const ctx = useDashboardData()
  // Re-derive log from the live dashboard cache so ctx.refresh() (triggered by
  // "Refresh Call Recording") actually updates fields like recording_url here.
  // Without this, selectedCall in parent components is a frozen snapshot taken
  // at click time and the panel never sees the refreshed row.
  const log = useMemo(
    () => (initialLog ? ctx?.calls?.find((c) => c.id === initialLog.id) ?? initialLog : null),
    [ctx?.calls, initialLog],
  )
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const [transcriptSearch, setTranscriptSearch] = useState('')
  const [copied, setCopied] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [markingLead, setMarkingLead] = useState(false)
  const [isLead, setIsLead] = useState<boolean | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Reset all action state when a different call is opened
  useEffect(() => {
    setTranscriptOpen(false)
    setTranscriptSearch('')
    setCopied(false)
    setRefreshing(false)
    setMarkingLead(false)
    setIsLead(null)
    setConfirmDelete(false)
    setDeleting(false)
  }, [log?.id])

  const structured = useMemo(
    () => parseStructuredSummary(log?.ai_summary_json ?? null),
    [log],
  )

  const transcriptLines = useMemo(
    () => parseTranscript(log?.transcript),
    [log],
  )

  const filteredLines = useMemo(() => {
    if (!transcriptSearch) return transcriptLines
    const q = transcriptSearch.toLowerCase()
    return transcriptLines.filter((l) => l.text.toLowerCase().includes(q))
  }, [transcriptLines, transcriptSearch])

  function copyTranscript() {
    if (!log?.transcript) return
    navigator.clipboard.writeText(log.transcript).catch(() => undefined)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleRefreshFromRetell() {
    if (!log?.id || refreshing) return
    setRefreshing(true)
    try {
      const res = await fetch(`/api/call-logs/${log.id}/refresh`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        console.log('[refresh] OK', body)
        // Re-fetch dashboard data so recording_url and status update live
        ctx?.refresh()
      } else {
        console.error('[refresh] FAILED', res.status, body)
        alert(`Refresh failed (${res.status}): ${body.error ?? 'unknown error'}`)
      }
    } catch (err) {
      console.error('[refresh] EXCEPTION', err)
      alert(`Refresh exception: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setRefreshing(false)
    }
  }

  async function handleMarkLead() {
    if (!log || markingLead) return
    setMarkingLead(true)
    try {
      await fetch(buildTenantApiUrl(`/api/call-logs/${log.id}/mark-lead`, tenantSlug), { method: 'PATCH' })
      setIsLead(true)
    } catch {
      // silently fail
    } finally {
      setMarkingLead(false)
    }
  }

  async function handleDelete() {
    if (!log || deleting) return
    setDeleting(true)
    try {
      const res = await fetch(buildTenantApiUrl(`/api/call-logs/${log.id}`, tenantSlug), { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
        onDeleted?.()
        onClose()
      } else {
        setDeleting(false)
      }
    } catch {
      setDeleting(false)
    }
  }

  if (!log) {
    return null
  }

  const effectiveIsLead = isLead ?? log.is_lead

  const startTime = log.contacted_at ?? log.created_at
  const displayDate = format(parseISO(startTime), 'MMM d, yyyy')
  const displayTime = format(parseISO(startTime), 'h:mm a')

  const hasAiSummary = structured || log.call_summary || log.ai_summary || log.summary
  const hasTranscript = (transcriptLines.length > 0) || log.transcript

  const actionItems: string[] = []
  if (structured?.nextBestAction) actionItems.push(structured.nextBestAction)
  if (log.human_followup_needed) {
    actionItems.push(log.human_followup_reason ?? 'Human follow-up required')
  }
  if ((structured?.unansweredQuestions ?? []).length > 0) {
    actionItems.push(`Address ${structured!.unansweredQuestions!.length} unanswered question(s)`)
  }

  return (
    <Dialog open={!!log} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <div className="space-y-0">

        {/* ── Header card ────────────────────────────────────────────────── */}
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* Caller */}
              {(log.caller_name || log.caller_phone) && (
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)]/15 text-[var(--brand-primary)]">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    {log.caller_name && (
                      <p className="text-sm font-semibold text-[var(--brand-text)]">{log.caller_name}</p>
                    )}
                    {log.caller_phone && (
                      <p className="text-xs text-[var(--brand-muted)]">{log.caller_phone}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--brand-muted)]">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {displayDate} · {displayTime}
                </span>
                {log.duration_seconds > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(log.duration_seconds)}
                  </span>
                )}
                {log.direction && (
                  <span className="flex items-center gap-1">
                    {log.direction === 'inbound' ? (
                      <ArrowDownLeft className="h-3 w-3 text-[var(--brand-primary)]" />
                    ) : (
                      <ArrowUpRight className="h-3 w-3 text-amber-500" />
                    )}
                    {log.direction === 'inbound' ? 'Inbound' : 'Outbound'}
                  </span>
                )}
              </div>
            </div>

            {/* Status badges */}
            <div className="flex flex-col gap-1.5 items-end shrink-0">
              {log.is_booked && (
                <Badge variant="success" className="text-xs">
                  {log.campaign_type ? `Booked · ${log.campaign_type}` : 'Booked'}
                </Badge>
              )}
              {log.is_lead && !log.is_booked && <Badge variant="brand" className="text-xs">Lead</Badge>}
              {log.disposition && (
                <Badge
                  variant={
                    (log.disposition as CallDisposition) === 'booked' ? 'success'
                    : (log.disposition as CallDisposition) === 'follow_up' ? 'warning'
                    : 'muted'
                  }
                  className="text-xs"
                >
                  {CALL_DISPOSITION_LABELS[log.disposition as CallDisposition] ?? log.disposition}
                </Badge>
              )}
              {log.sentiment && sentimentConfig[log.sentiment] && (
                <span className={cn('text-xs font-medium', sentimentConfig[log.sentiment].className)}>
                  {sentimentConfig[log.sentiment as CallSentiment].label}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Recording ──────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-[var(--brand-border)]/50">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-muted)] mb-3">Call Recording</p>
          {log.recording_url ? (
            <div className="space-y-2.5">
              <RecordingPlayer src={log.recording_url} />
              <a
                href={log.recording_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--brand-border)] px-3 py-1.5 text-xs font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Download Recording
              </a>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--brand-muted)] italic">
                Recording not available yet.
              </p>
              {log.external_call_id && (
                <button
                  onClick={handleRefreshFromRetell}
                  disabled={refreshing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--brand-border)] px-3 py-1.5 text-xs font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors disabled:opacity-50"
                >
                  {refreshing
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <RefreshCw className="h-3.5 w-3.5" />}
                  Refresh Call Recording
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── AI Summary ─────────────────────────────────────────────────── */}
        {hasAiSummary && (
          <div className="px-6 py-4 border-t border-[var(--brand-border)]/50">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-muted)] mb-3">AI Summary</p>
            {/* Plain summary */}
            {(log.call_summary || log.ai_summary || log.summary) && (
              <p className="text-sm text-[var(--brand-text)] leading-relaxed mb-4">
                {log.call_summary ?? log.ai_summary ?? log.summary}
              </p>
            )}

            {/* Structured grid */}
            {structured && (
              <div className="space-y-3">
                {/* Intent + Urgency row */}
                {(structured.intent || structured.urgency) && (
                  <div className="flex flex-wrap gap-2">
                    {structured.intent && (
                      <div className="flex items-center gap-1.5 rounded-md bg-[var(--brand-primary)]/10 px-2.5 py-1.5">
                        <Target className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                        <span className="text-xs font-medium text-[var(--brand-text)]">
                          {structured.intent}
                        </span>
                      </div>
                    )}
                    {structured.urgency && urgencyConfig[structured.urgency] && (
                      <Badge variant={urgencyConfig[structured.urgency].variant} className="text-xs">
                        {urgencyConfig[structured.urgency].label}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Key facts */}
                {(structured.keyFacts ?? []).length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider mb-1.5">
                      Key Facts
                    </p>
                    <ul className="space-y-1">
                      {structured.keyFacts!.map((fact, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-[var(--brand-text)]">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--brand-primary)] shrink-0" />
                          {fact}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Objections */}
                {(structured.objections ?? []).length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider mb-1.5">
                      Objections
                    </p>
                    <ul className="space-y-1">
                      {structured.objections!.map((obj, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                          {obj}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Next best action */}
                {structured.nextBestAction && (
                  <div className="rounded-lg border border-[var(--user-accent)]/30 bg-[var(--user-accent-soft)] px-3 py-2.5">
                    <p className="text-[10px] font-semibold text-[var(--user-accent)] uppercase tracking-wider mb-1">
                      Next Best Action
                    </p>
                    <p className="text-xs text-[var(--brand-text)]">{structured.nextBestAction}</p>
                  </div>
                )}

                {/* Callback script */}
                {structured.callbackScript && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider">
                        Callback Script
                      </p>
                      <CopyButton text={structured.callbackScript} label="Copy script" />
                    </div>
                    <div className="rounded-md bg-[var(--brand-bg)] border border-[var(--brand-border)] px-3 py-2.5">
                      <p className="text-xs text-[var(--brand-text)] leading-relaxed whitespace-pre-wrap">
                        {structured.callbackScript}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Action Items ────────────────────────────────────────────────── */}
        {actionItems.length > 0 && (
          <div className="px-6 py-4 border-t border-[var(--brand-border)]/50">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-muted)] mb-3">Action Items</p>
            <ul className="space-y-2">
              {actionItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[var(--brand-border)]">
                    <Zap className="h-2.5 w-2.5 text-[var(--user-accent)]" />
                  </div>
                  <span className="text-xs text-[var(--brand-text)]">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Outcome / Revenue ───────────────────────────────────────────── */}
        {(log.appointment_datetime || log.booked_at || log.booked_value > 0 ||
          log.inquiries_value > 0 || log.intent) && (
          <div className="px-6 py-4 border-t border-[var(--brand-border)]/50">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-muted)] mb-3">Outcome</p>
            <div className="space-y-2.5">
              {log.intent && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--brand-muted)]">Intent</span>
                  <span className="text-[var(--brand-text)] font-medium">
                    {CALL_INTENT_LABELS[log.intent as keyof typeof CALL_INTENT_LABELS] ?? log.intent}
                  </span>
                </div>
              )}
              {log.appointment_datetime && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--brand-muted)]">Appointment</span>
                  <span className="text-[var(--brand-text)] font-medium">
                    {format(parseISO(log.appointment_datetime), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
              )}
              {log.booked_value > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--brand-muted)]">Booked value</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                    {formatCurrency(log.booked_value)}
                  </span>
                </div>
              )}
              {log.potential_revenue > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--brand-muted)]">Potential revenue</span>
                  <span className="text-[var(--brand-accent)] font-semibold tabular-nums">
                    {formatCurrency(log.potential_revenue)}
                  </span>
                </div>
              )}
              {log.lead_source && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--brand-muted)]">Lead source</span>
                  <span className="text-[var(--brand-text)]">{log.lead_source}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Transcript ─────────────────────────────────────────────────── */}
        {hasTranscript && (
          <div className="px-6 py-4 pb-6 border-t border-[var(--brand-border)]/50">
            <button
              className="flex w-full items-center justify-between group"
              onClick={() => setTranscriptOpen((o) => !o)}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-[var(--brand-muted)]" />
                <span className="text-xs font-semibold text-[var(--brand-muted)] uppercase tracking-wider">
                  Transcript
                </span>
                {transcriptLines.length > 0 && (
                  <span className="text-[10px] text-[var(--brand-muted)] opacity-60">
                    ({transcriptLines.length} lines)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {log.transcript && (
                  <span
                    onClick={(e) => { e.stopPropagation(); copyTranscript() }}
                    className="hidden group-hover:flex items-center gap-1 text-[10px] text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'Copied' : 'Copy'}
                  </span>
                )}
                {transcriptOpen
                  ? <ChevronUp className="h-4 w-4 text-[var(--brand-muted)]" />
                  : <ChevronDown className="h-4 w-4 text-[var(--brand-muted)]" />
                }
              </div>
            </button>

            {transcriptOpen && (
              <div className="mt-3 space-y-3">
                {/* Search */}
                {transcriptLines.length > 4 && (
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--brand-muted)]" />
                    <Input
                      placeholder="Search transcript…"
                      value={transcriptSearch}
                      onChange={(e) => setTranscriptSearch(e.target.value)}
                      className="pl-7 h-7 text-xs"
                    />
                  </div>
                )}

                {/* Bubbles */}
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {transcriptLines.length > 0 ? (
                    filteredLines.length === 0 ? (
                      <p className="text-xs text-center text-[var(--brand-muted)] py-4">
                        No matching lines
                      </p>
                    ) : (
                      filteredLines.map((line, i) => (
                        <div
                          key={i}
                          className={cn(
                            'flex',
                            line.role === 'agent' ? 'justify-start' : 'justify-end',
                          )}
                        >
                          <div
                            className={cn(
                              'max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed',
                              line.role === 'agent'
                                ? 'rounded-tl-sm bg-[var(--brand-surface)] border border-[var(--brand-border)] text-[var(--brand-text)]'
                                : 'rounded-tr-sm bg-[var(--user-accent-soft)] text-[var(--brand-text)]',
                            )}
                          >
                            {transcriptSearch
                              ? highlight(line.text, transcriptSearch)
                              : line.text}
                          </div>
                        </div>
                      ))
                    )
                  ) : (
                    /* Plain-text fallback (unparseable transcript) */
                    <pre className="text-xs text-[var(--brand-text)] leading-relaxed whitespace-pre-wrap bg-[var(--brand-bg)] rounded-md p-3 border border-[var(--brand-border)] max-h-64 overflow-y-auto">
                      {log.transcript}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Summary status pill — shown when AI processing is in progress */}
        {log.summary_status === 'pending' && (
          <div className="px-6 py-3 text-center">
            <span className="inline-flex items-center gap-1.5 text-[10px] text-[var(--brand-muted)] bg-[var(--brand-border)]/40 rounded-full px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              AI summary processing…
            </span>
          </div>
        )}

        {/* ── Actions footer ─────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-[var(--brand-border)]/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {!effectiveIsLead && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleMarkLead}
                disabled={markingLead}
                className="text-xs h-8"
              >
                {markingLead ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
                Mark as Lead
              </Button>
            )}
            {effectiveIsLead && (
              <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-100 rounded-full px-3 py-1">
                Lead
              </span>
            )}
          </div>

          {/* Delete */}
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-rose-500 hover:text-rose-700 transition-colors"
            >
              Delete call
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--brand-muted)]">Delete this call?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs font-semibold text-rose-600 hover:text-rose-800 transition-colors"
              >
                {deleting ? 'Deleting…' : 'Confirm'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)]"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}
