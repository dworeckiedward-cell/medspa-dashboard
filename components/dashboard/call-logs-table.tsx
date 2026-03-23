'use client'

import { useState, useMemo, useEffect, Fragment } from 'react'
import { format, parseISO } from 'date-fns'
import Link from 'next/link'
import {
  Search,
  Phone,
  Play,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Mic,
  FileText,
  Brain,
} from 'lucide-react'
import { RecordingPlayer } from './recording-player'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn, polish, formatCurrency, formatDuration, highlightSegments } from '@/lib/utils'
import type { CallLog, CallType, CallDisposition, CallSentiment } from '@/types/database'
import {
  CALL_TYPE_LABELS,
  CALL_DISPOSITION_LABELS,
  CALL_INTENT_LABELS,
} from '@/types/database'

// ── Search highlight renderer ────────────────────────────────────────────────

function Hl({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>
  const segs = highlightSegments(text, query)
  return (
    <>
      {segs.map((s, i) =>
        typeof s === 'string' ? (
          <Fragment key={i}>{s}</Fragment>
        ) : (
          <mark key={i} className="bg-[var(--user-accent)]/15 text-[var(--user-accent)] rounded px-0.5 py-px">
            {s.text}
          </mark>
        ),
      )}
    </>
  )
}

interface CallLogsTableProps {
  initialData: CallLog[]
  totalCount: number
  clientId: string
  /** When provided, row clicks open the detail panel instead of inline-expanding. */
  onSelectCall?: (log: CallLog) => void
  /** Pre-activate the "Has recording" chip (e.g. from ?hasRecording=1). */
  initialChipRecording?: boolean
  /** @deprecated No longer used — booked/lead columns removed. */
  initialChipBookedOrLead?: boolean
  /** Pre-set the direction filter (e.g. 'outbound' from ?direction=outbound). */
  initialDirection?: string
  /** Pre-apply a minimum call duration in seconds (e.g. 120 from ?minDuration=120). */
  initialMinDurationSec?: number
  /** Pre-apply a minimum lead confidence 0–100 (e.g. 60 from ?minConfidence=60). */
  initialMinLeadConfidence?: number
  /** @deprecated No longer used — booked column removed. */
  initialBookedOnly?: boolean
}

const callTypeColors: Record<
  string,
  'success' | 'brand' | 'warning' | 'destructive' | 'muted' | 'accent'
> = {
  booking: 'success',
  inbound_inquiry: 'brand',
  reschedule: 'accent',
  cancellation: 'destructive',
  support: 'warning',
  spam: 'muted',
  other: 'muted',
}

const dispositionColors: Record<
  CallDisposition,
  'success' | 'brand' | 'warning' | 'destructive' | 'muted' | 'accent'
> = {
  booked: 'success',
  follow_up: 'warning',
  not_interested: 'muted',
  no_answer: 'muted',
  voicemail: 'muted',
  spam: 'destructive',
  other: 'muted',
}

// Sentiment pill — compact dot + label
function SentimentPill({ sentiment }: { sentiment: CallSentiment | null | string | undefined }) {
  if (!sentiment) return <span className="text-[var(--brand-muted)] opacity-30 text-xs">—</span>
  const cfg: Record<string, { label: string; dot: string; text: string }> = {
    positive:  { label: 'Positive',  dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
    neutral:   { label: 'Neutral',   dot: 'bg-gray-400',    text: 'text-[var(--brand-muted)]' },
    negative:  { label: 'Negative',  dot: 'bg-rose-500',    text: 'text-rose-600 dark:text-rose-400' },
    follow_up: { label: 'Follow-up', dot: 'bg-amber-400',   text: 'text-amber-600 dark:text-amber-400' },
  }
  const s = cfg[sentiment as string] ?? { label: sentiment as string, dot: 'bg-gray-400', text: 'text-[var(--brand-muted)]' }
  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${s.text}`}>
      <span className={`h-2 w-2 rounded-full shrink-0 ${s.dot}`} />
      {s.label}
    </span>
  )
}

type SortKey = 'created_at' | 'duration_seconds'

const PAGE_SIZE = 20

const TIME_RANGES = [
  { label: 'Last 24h',   hours: 24  },
  { label: 'Last 3 days',hours: 72  },
  { label: 'Last 7 days',hours: 168 },
  { label: 'Last 14 days',hours: 336 },
  { label: 'Last 30 days',hours: 720 },
]

export function CallLogsTable({
  initialData,
  totalCount,
  clientId,
  onSelectCall,
  initialChipRecording,
  initialDirection,
  initialMinDurationSec,
  initialMinLeadConfidence,
}: CallLogsTableProps) {
  // ── Persist filters in localStorage, keyed by clientId ────────────────────
  const storageKey = `call-logs-filters:${clientId}`

  function loadFilters() {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(storageKey)
      return raw ? (JSON.parse(raw) as { type: string }) : null
    } catch {
      return null
    }
  }

  const saved = loadFilters()

  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>(saved?.type ?? 'all')
  const [filterSentiment, setFilterSentiment] = useState<string>('all')
  const [timeRangeIndex, setTimeRangeIndex] = useState(4) // default: 30 days
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // Persist filter changes to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ type: filterType }))
    } catch {
      // localStorage may be unavailable in some environments
    }
  }, [storageKey, filterType])

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [search, filterType, filterSentiment, timeRangeIndex])

  const filtered = useMemo(() => {
    const cutoff = Date.now() - TIME_RANGES[timeRangeIndex].hours * 3_600_000
    return initialData.filter((log) => {
      // Time range filter
      if (new Date(log.created_at).getTime() < cutoff) return false
      if (filterType !== 'all' && log.call_type !== filterType) return false
      if (filterSentiment !== 'all' && log.sentiment !== filterSentiment) return false
      if (initialMinDurationSec !== undefined && (log.duration_seconds ?? 0) < initialMinDurationSec) return false
      if (initialMinLeadConfidence !== undefined && Math.round((log.lead_confidence ?? 0) * 100) < initialMinLeadConfidence) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          log.semantic_title?.toLowerCase().includes(q) ||
          log.caller_name?.toLowerCase().includes(q) ||
          log.caller_phone?.toLowerCase().includes(q) ||
          log.summary?.toLowerCase().includes(q) ||
          log.ai_summary?.toLowerCase().includes(q) ||
          false
        )
      }
      return true
    })
  }, [initialData, filterType, filterSentiment, timeRangeIndex, search, initialMinDurationSec, initialMinLeadConfidence])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const cmp = a.created_at.localeCompare(b.created_at)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortDir])

  const visible = sorted.slice(0, visibleCount)
  const isEmpty = sorted.length === 0
  const hasMore = sorted.length > visibleCount
  const remaining = sorted.length - visibleCount

  const hasActiveFilters =
    !!search || filterType !== 'all' || filterSentiment !== 'all' ||
    timeRangeIndex !== 4 || !!initialMinDurationSec || !!initialMinLeadConfidence

  function clearFilters() {
    setSearch('')
    setFilterType('all')
    setFilterSentiment('all')
    setTimeRangeIndex(4)
  }

  return (
    <Card id="calls">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Call Logs</CardTitle>
            <CardDescription>
              {totalCount} total calls ·{' '}
              {sorted.length < totalCount && `${sorted.length} filtered · `}
              showing {visible.length}
              {hasMore && ` of ${sorted.length}`}
            </CardDescription>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--brand-muted)]" />
              <Input
                placeholder="Search calls..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 w-full sm:w-48 text-xs"
              />
            </div>

            {/* Sort order */}
            <Select value={sortDir} onValueChange={(v) => setSortDir(v as 'desc' | 'asc')}>
              <SelectTrigger className="h-9 w-full sm:w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">From Latest</SelectItem>
                <SelectItem value="asc">To Latest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      {/* Sentiment chips + time range dropdown — same row */}
      <div className="flex items-center justify-between gap-3 px-6 pb-4">
        <div className="flex items-center gap-2 flex-wrap">
          {([
            { value: 'all',      label: 'All' },
            { value: 'positive', label: 'Positive' },
            { value: 'neutral',  label: 'Neutral' },
            { value: 'negative', label: 'Negative' },
          ] as const).map((chip) => (
            <button
              key={chip.value}
              onClick={() => setFilterSentiment(chip.value)}
              className={cn(
                'rounded-full border px-3 py-1 text-[11px] font-medium transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/30',
                filterSentiment === chip.value
                  ? 'border-[var(--brand-primary)]/40 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                  : 'border-[var(--brand-border)] text-[var(--brand-muted)] hover:border-[var(--brand-border)]/80 hover:text-[var(--brand-text)]',
              )}
            >
              {chip.value !== 'all' && (
                <span className={cn('inline-block h-1.5 w-1.5 rounded-full mr-1.5 align-middle', {
                  'bg-emerald-500': chip.value === 'positive',
                  'bg-gray-400':    chip.value === 'neutral',
                  'bg-rose-500':    chip.value === 'negative',
                })} />
              )}
              {chip.label}
            </button>
          ))}
        </div>

        {/* Time range dropdown */}
        <Select
          value={String(timeRangeIndex)}
          onValueChange={(v) => setTimeRangeIndex(Number(v))}
        >
          <SelectTrigger className="h-8 w-[130px] text-xs shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_RANGES.map((r, i) => (
              <SelectItem key={i} value={String(i)} className="text-xs">
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <CardContent className="p-0">
        {isEmpty ? (
          <div className={polish.emptyState}>
            <div className={polish.emptyIcon}>
              <Phone className="h-6 w-6 text-[var(--brand-muted)] opacity-50" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--brand-text)]">No calls found</p>
              <p className="text-xs text-[var(--brand-muted)] opacity-60 mt-1 max-w-[280px] mx-auto">
                {hasActiveFilters
                  ? 'No calls match your current filters — try broadening your search'
                  : 'Calls will appear here once your AI receptionist handles them'}
              </p>
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-xs"
              >
                Clear all filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* Sentiment */}
                    <TableHead className="w-28">Sentiment</TableHead>

                    {/* Title / Caller */}
                    <TableHead>Title / Caller</TableHead>

                    {/* Time */}
                    <TableHead className="w-32">Time</TableHead>

                    {/* Type */}
                    <TableHead className="w-32 hidden sm:table-cell">Type</TableHead>

                    {/* Duration */}
                    <TableHead className="w-20 text-right hidden md:table-cell">Duration</TableHead>

                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((log) => {
                    const isExpanded = expandedId === log.id
                    const typeColor = callTypeColors[log.call_type ?? 'other'] ?? 'muted'
                    return (
                      <Fragment key={log.id}>
                        <TableRow
                          className="group cursor-pointer focus-visible:bg-[var(--brand-primary)]/[0.04] focus-visible:outline-none"
                          onClick={() => {
                            if (onSelectCall) {
                              onSelectCall(log)
                            } else {
                              setExpandedId(isExpanded ? null : log.id)
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              if (onSelectCall) onSelectCall(log)
                              else setExpandedId(isExpanded ? null : log.id)
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-expanded={onSelectCall ? undefined : isExpanded}
                        >
                          {/* Sentiment */}
                          <TableCell>
                            <SentimentPill sentiment={log.sentiment} />
                          </TableCell>

                          {/* Title + caller */}
                          <TableCell>
                            <Link
                              href={`/dashboard/call-logs/${log.id}`}
                              className="font-medium text-sm text-[var(--brand-text)] leading-tight hover:text-[var(--brand-primary)] hover:underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/30 rounded-sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Hl text={log.semantic_title || log.caller_name || log.caller_phone || 'Unknown caller'} query={search} />
                            </Link>
                            {(log.caller_name || log.caller_phone) && (
                              <div className="text-xs text-[var(--brand-muted)] mt-0.5">
                                {log.caller_name && <span><Hl text={log.caller_name} query={search} /> · </span>}
                                {log.caller_phone && <Hl text={log.caller_phone} query={search} />}
                              </div>
                            )}
                            {/* AI summary 1-liner preview */}
                            {(log.ai_summary || log.summary) && (
                              <p className="text-xs text-[var(--brand-muted)] opacity-70 mt-1 line-clamp-1">
                                {log.ai_summary ?? log.summary}
                              </p>
                            )}
                            {/* Content indicator micro-badges */}
                            <div className="flex flex-wrap items-center gap-1 mt-1.5">
                              {log.is_booked && (
                                <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800/40 dark:text-emerald-400">
                                  ✓ Booked
                                </span>
                              )}
                              {log.outbound_type === 'follow_up' && (
                                <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:bg-amber-950/30 dark:border-amber-800/40 dark:text-amber-400">
                                  Follow-up
                                </span>
                              )}
                              {log.recording_url && (
                                <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium bg-violet-100 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400" title="Recording available">
                                  <Mic className="h-2.5 w-2.5" />
                                </span>
                              )}
                              {(log.ai_summary || log.summary) && (
                                <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium bg-blue-100 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400" title="AI summary available">
                                  <Brain className="h-2.5 w-2.5" />
                                </span>
                              )}
                              {log.transcript && (
                                <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" title="Transcript available">
                                  <FileText className="h-2.5 w-2.5" />
                                </span>
                              )}
                              {log.tags.slice(0, 3).map((tag) => (
                                <Badge key={tag} variant="outline" className="text-[10px] py-0 px-1.5">
                                  {tag}
                                </Badge>
                              ))}
                              {log.tags.length > 3 && (
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                                  +{log.tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          {/* Time */}
                          <TableCell className="text-xs text-[var(--brand-muted)]">
                            <div>{format(parseISO(log.created_at), 'MMM d')}</div>
                            <div className="opacity-70">{format(parseISO(log.created_at), 'h:mm a')}</div>
                          </TableCell>

                          {/* Type — direction + call type */}
                          <TableCell className="hidden sm:table-cell">
                            <div className="flex flex-col gap-1">
                              {log.direction ? (
                                <span className="flex items-center gap-0.5 text-xs font-medium text-[var(--brand-text)]">
                                  {log.direction === 'inbound' ? (
                                    <>
                                      <ArrowDownLeft className="h-3 w-3 text-[var(--brand-primary)] shrink-0" />
                                      Inbound
                                    </>
                                  ) : (
                                    <>
                                      <ArrowUpRight className="h-3 w-3 text-amber-500 shrink-0" />
                                      Outbound
                                    </>
                                  )}
                                </span>
                              ) : null}
                              {log.call_type && (
                                <Badge variant={typeColor} className="text-[10px] w-fit py-0">
                                  {CALL_TYPE_LABELS[log.call_type as CallType] ?? log.call_type}
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          {/* Duration */}
                          <TableCell className="text-right text-xs text-[var(--brand-muted)] hidden md:table-cell">
                            {log.duration_seconds > 0 ? (
                              <div className="flex flex-col items-end gap-1">
                                <span>{formatDuration(log.duration_seconds)}</span>
                                {/* Audio play button — inline with duration */}
                                {log.recording_url && (
                                  <button
                                    className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/30 focus-visible:ring-offset-1"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      const willPlay = playingId !== log.id
                                      setPlayingId(willPlay ? log.id : null)
                                      if (willPlay) setExpandedId(log.id)
                                    }}
                                    title="Play recording"
                                  >
                                    <Play className="h-2.5 w-2.5 ml-0.5" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="opacity-30">—</span>
                            )}
                          </TableCell>

                          {/* Expand toggle / detail arrow */}
                          <TableCell>
                            <span className="text-[var(--brand-muted)] opacity-50 group-hover:opacity-100 transition-opacity">
                              {onSelectCall ? (
                                <ChevronRight className="h-4 w-4" />
                              ) : isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </span>
                          </TableCell>
                        </TableRow>

                        {/* Expanded detail row */}
                        {isExpanded && (
                          <TableRow className="bg-[var(--brand-primary)]/[0.03] hover:bg-[var(--brand-primary)]/[0.03]">
                            <TableCell colSpan={6} className="py-4 px-6">
                              <div className="space-y-4">
                                {/* Audio inline player */}
                                {playingId === log.id && log.recording_url && (
                                  <div>
                                    <p className="text-xs font-medium text-[var(--brand-muted)] mb-1.5 uppercase tracking-wider">
                                      Recording
                                    </p>
                                    <RecordingPlayer
                                      src={log.recording_url}
                                      autoPlay
                                      className="max-w-sm"
                                    />
                                  </div>
                                )}

                                {/* Outcome badges: disposition + sentiment + intent */}
                                {(log.disposition || log.sentiment || log.intent) && (
                                  <div className="flex flex-wrap items-center gap-2">
                                    {log.disposition && (
                                      <Badge
                                        variant={dispositionColors[log.disposition as CallDisposition] ?? 'muted'}
                                        className="text-xs"
                                      >
                                        {CALL_DISPOSITION_LABELS[log.disposition as CallDisposition] ?? log.disposition}
                                      </Badge>
                                    )}
                                    {log.sentiment && (
                                      <SentimentPill sentiment={log.sentiment} />
                                    )}
                                    {log.intent && (
                                      <span className="text-xs text-[var(--brand-muted)]">
                                        Intent: {CALL_INTENT_LABELS[log.intent as keyof typeof CALL_INTENT_LABELS] ?? log.intent}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* AI Summary */}
                                {(log.ai_summary || log.summary) && (
                                  <div>
                                    <p className="text-xs font-medium text-[var(--brand-muted)] mb-1 uppercase tracking-wider">
                                      AI Summary
                                    </p>
                                    <p className="text-sm text-[var(--brand-text)] leading-relaxed">
                                      {log.ai_summary ?? log.summary}
                                    </p>
                                  </div>
                                )}

                                {/* Appointment details */}
                                {(log.appointment_datetime || log.booked_at) && (
                                  <div className="flex flex-wrap gap-4 text-xs">
                                    {log.appointment_datetime && (
                                      <div>
                                        <span className="text-[var(--brand-muted)]">Appointment: </span>
                                        <span className="text-[var(--brand-text)] font-medium">
                                          {format(parseISO(log.appointment_datetime), 'MMM d, yyyy h:mm a')}
                                        </span>
                                      </div>
                                    )}
                                    {log.booked_at && (
                                      <div>
                                        <span className="text-[var(--brand-muted)]">Booked at: </span>
                                        <span className="text-[var(--brand-text)] font-medium">
                                          {format(parseISO(log.booked_at), 'MMM d h:mm a')}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Follow-up flag */}
                                {log.human_followup_needed && (
                                  <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 px-3 py-2.5">
                                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                    <div>
                                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                                        Follow-up needed
                                      </p>
                                      {log.human_followup_reason && (
                                        <p className="text-xs text-amber-600/80 dark:text-amber-300/70 mt-0.5">
                                          {log.human_followup_reason}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Revenue breakdown */}
                                {(log.booked_value > 0 || log.inquiries_value > 0 || log.lead_confidence != null) && (
                                  <div className="flex flex-wrap gap-4 text-xs">
                                    {log.booked_value > 0 && (
                                      <div>
                                        <span className="text-[var(--brand-muted)]">Booked: </span>
                                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                          {formatCurrency(log.booked_value)}
                                        </span>
                                      </div>
                                    )}
                                    {log.inquiries_value > 0 && (
                                      <div>
                                        <span className="text-[var(--brand-muted)]">Inquiry value: </span>
                                        <span className="text-[var(--brand-accent)] font-semibold">
                                          {formatCurrency(log.inquiries_value)}
                                        </span>
                                      </div>
                                    )}
                                    {log.lead_confidence != null && (
                                      <div>
                                        <span className="text-[var(--brand-muted)]">Confidence: </span>
                                        <span className="text-[var(--brand-text)] font-semibold">
                                          {Math.round(log.lead_confidence * 100)}%
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Lead source / agent info */}
                                {(log.lead_source || log.agent_name || log.agent_provider) && (
                                  <div className="flex flex-wrap gap-4 text-xs text-[var(--brand-muted)]">
                                    {log.lead_source && (
                                      <span>Source: <span className="text-[var(--brand-text)]">{log.lead_source}</span></span>
                                    )}
                                    {(log.agent_name || log.agent_provider) && (
                                      <span>
                                        Agent:{' '}
                                        <span className="text-[var(--brand-text)]">
                                          {[log.agent_name, log.agent_provider].filter(Boolean).join(' · ')}
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Show more */}
            {hasMore && (
              <div className="flex items-center justify-center border-t border-[var(--brand-border)] py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)]"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                >
                  Show {Math.min(PAGE_SIZE, remaining)} more
                  <span className="ml-1 opacity-50">({remaining} remaining)</span>
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** Skeleton placeholder matching the call-logs table layout. */
export function CallLogsTableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-3 w-40" />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Skeleton className="h-9 w-48 rounded-lg" />
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Header row */}
        <div className="flex items-center gap-4 border-b border-[var(--brand-border)]/60 px-4 py-3">
          {[70, 200, 80, 80, 60, 24].map((w, i) => (
            <Skeleton key={i} className="h-3" style={{ width: w }} />
          ))}
        </div>
        {/* Data rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-[var(--brand-border)]/60 px-4 py-4"
          >
            <Skeleton className="h-3 w-16" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-2.5 w-28" />
            </div>
            <div className="w-20 space-y-1.5">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-2.5 w-12" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-4 w-4 rounded" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
