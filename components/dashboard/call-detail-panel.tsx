'use client'

/**
 * CallDetailPanel — rich right-side Sheet for a selected call log.
 *
 * Sections:
 *  • Header:       title, caller, date/time, duration, direction + status badges
 *  • AI Summary:   structured fields from ai_summary_json (intent, urgency, sentiment,
 *                  objections, key facts, next best action, callback script)
 *  • Action Items: follow-up flag + checklist derived from the structured summary
 *  • Outcomes:     disposition, appointment details, revenue breakdown
 *  • Transcript:   collapsible, role-parsed bubbles, search highlight, copy button
 */

import { useState, useMemo } from 'react'
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
} from 'lucide-react'
import { Sheet, SheetContent, SheetSection } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatDuration, cn } from '@/lib/utils'
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
  positive: { label: 'Positive', className: 'text-emerald-600 dark:text-emerald-400' },
  neutral:  { label: 'Neutral',  className: 'text-[var(--brand-muted)]' },
  negative: { label: 'Negative', className: 'text-rose-600 dark:text-rose-400' },
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
}

export function CallDetailPanel({ log, onClose }: CallDetailPanelProps) {
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const [transcriptSearch, setTranscriptSearch] = useState('')
  const [copied, setCopied] = useState(false)

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

  if (!log) {
    return null
  }

  const displayDate = format(parseISO(log.created_at), 'MMM d, yyyy')
  const displayTime = format(parseISO(log.created_at), 'h:mm a')

  const hasAiSummary = structured || log.ai_summary || log.summary
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
    <Sheet
      open={!!log}
      onClose={onClose}
      size="lg"
      title={log.semantic_title ?? 'Call Detail'}
      description={`${displayDate} · ${displayTime}`}
    >
      <SheetContent className="space-y-0 p-0">

        {/* ── Header card ────────────────────────────────────────────────── */}
        <SheetSection className="px-6 pt-5 pb-4">
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
              {log.is_booked && <Badge variant="success" className="text-xs">Booked</Badge>}
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
        </SheetSection>

        {/* ── AI Summary ─────────────────────────────────────────────────── */}
        {hasAiSummary && (
          <SheetSection title="AI Summary" className="px-6">
            {/* Plain summary */}
            {(log.ai_summary || log.summary) && (
              <p className="text-sm text-[var(--brand-text)] leading-relaxed mb-4">
                {log.ai_summary ?? log.summary}
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
          </SheetSection>
        )}

        {/* ── Action Items ────────────────────────────────────────────────── */}
        {actionItems.length > 0 && (
          <SheetSection title="Action Items" className="px-6">
            {log.human_followup_needed && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 px-3 py-2.5 mb-3">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    Human follow-up required
                  </p>
                  {log.human_followup_reason && (
                    <p className="text-xs text-amber-600/80 dark:text-amber-300/70 mt-0.5">
                      {log.human_followup_reason}
                    </p>
                  )}
                </div>
              </div>
            )}
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
          </SheetSection>
        )}

        {/* ── Outcome / Revenue ───────────────────────────────────────────── */}
        {(log.appointment_datetime || log.booked_at || log.booked_value > 0 ||
          log.inquiries_value > 0 || log.lead_confidence != null || log.intent) && (
          <SheetSection title="Outcome" className="px-6">
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
              {log.lead_confidence != null && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--brand-muted)]">Lead confidence</span>
                  <span className="text-[var(--brand-text)] font-semibold tabular-nums">
                    {Math.round(log.lead_confidence * 100)}%
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
          </SheetSection>
        )}

        {/* ── Transcript ─────────────────────────────────────────────────── */}
        {hasTranscript && (
          <SheetSection className="px-6 pb-6">
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
          </SheetSection>
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

      </SheetContent>
    </Sheet>
  )
}
