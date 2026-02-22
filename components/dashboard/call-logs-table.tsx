'use client'

import { useState, useMemo, useEffect, Fragment } from 'react'
import { format, parseISO } from 'date-fns'
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
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { formatCurrency, formatDuration } from '@/lib/utils'
import type { CallLog, CallType, CallDisposition, CallSentiment } from '@/types/database'
import {
  CALL_TYPE_LABELS,
  CALL_DISPOSITION_LABELS,
  CALL_INTENT_LABELS,
} from '@/types/database'

interface CallLogsTableProps {
  initialData: CallLog[]
  totalCount: number
  clientId: string
  /** When provided, row clicks open the detail panel instead of inline-expanding. */
  onSelectCall?: (log: CallLog) => void
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

const sentimentStyle: Record<CallSentiment, { label: string; className: string }> = {
  positive: { label: 'Positive', className: 'text-emerald-600 dark:text-emerald-400' },
  neutral:  { label: 'Neutral',  className: 'text-[var(--brand-muted)]' },
  negative: { label: 'Negative', className: 'text-rose-600 dark:text-rose-400' },
}

type SortKey = 'created_at' | 'potential_revenue' | 'duration_seconds'

const PAGE_SIZE = 20

export function CallLogsTable({ initialData, totalCount, clientId, onSelectCall }: CallLogsTableProps) {
  // ── Persist filters in localStorage, keyed by clientId ────────────────────
  const storageKey = `call-logs-filters:${clientId}`

  function loadFilters() {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(storageKey)
      return raw ? (JSON.parse(raw) as { type: string; booked: string; direction: string }) : null
    } catch {
      return null
    }
  }

  const saved = loadFilters()

  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>(saved?.type ?? 'all')
  const [filterBooked, setFilterBooked] = useState<string>(saved?.booked ?? 'all')
  const [filterDirection, setFilterDirection] = useState<string>(saved?.direction ?? 'all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // Persist filter changes to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ type: filterType, booked: filterBooked, direction: filterDirection }),
      )
    } catch {
      // localStorage may be unavailable in some environments
    }
  }, [storageKey, filterType, filterBooked, filterDirection])

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [search, filterType, filterBooked, filterDirection])

  const filtered = useMemo(() => {
    return initialData.filter((log) => {
      if (filterType !== 'all' && log.call_type !== filterType) return false
      if (filterBooked === 'booked' && !log.is_booked) return false
      if (filterBooked === 'not_booked' && log.is_booked) return false

      if (filterDirection !== 'all') {
        if (log.direction !== null && log.direction !== undefined) {
          // New rows: use explicit direction field
          if (log.direction !== filterDirection) return false
        } else {
          // Old rows: infer direction from call_type as proxy
          const isInbound = log.call_type === 'inbound_inquiry'
          if (filterDirection === 'inbound' && !isInbound) return false
          if (filterDirection === 'outbound' && isInbound) return false
        }
      }

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
  }, [initialData, filterType, filterBooked, filterDirection, search])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      if (sortKey === 'created_at') {
        const cmp = a.created_at.localeCompare(b.created_at)
        return sortDir === 'asc' ? cmp : -cmp
      }
      const aVal = a[sortKey] ?? 0
      const bVal = b[sortKey] ?? 0
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
  }, [filtered, sortKey, sortDir])

  const visible = sorted.slice(0, visibleCount)
  const isEmpty = sorted.length === 0
  const hasMore = sorted.length > visibleCount
  const remaining = sorted.length - visibleCount

  const hasActiveFilters =
    search || filterType !== 'all' || filterBooked !== 'all' || filterDirection !== 'all'

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function clearFilters() {
    setSearch('')
    setFilterType('all')
    setFilterBooked('all')
    setFilterDirection('all')
  }

  // Inline helper — returns sort icon JSX (not a component, avoids remount)
  const sortIcon = (colKey: SortKey) =>
    sortKey === colKey ? (
      sortDir === 'asc' ? (
        <ChevronUp className="h-3 w-3 shrink-0 opacity-70" />
      ) : (
        <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
      )
    ) : (
      <ChevronDown className="h-3 w-3 shrink-0 opacity-20" />
    )

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

            {/* Direction filter */}
            <Select value={filterDirection} onValueChange={setFilterDirection}>
              <SelectTrigger className="h-9 w-full sm:w-32 text-xs">
                <SelectValue placeholder="All calls" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All calls</SelectItem>
                <SelectItem value="inbound">↓ Inbound</SelectItem>
                <SelectItem value="outbound">↑ Outbound</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-9 w-full sm:w-36 text-xs">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {(Object.keys(CALL_TYPE_LABELS) as CallType[]).map((type) => (
                  <SelectItem key={type} value={type}>
                    {CALL_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterBooked} onValueChange={setFilterBooked}>
              <SelectTrigger className="h-9 w-full sm:w-32 text-xs">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="booked">Booked ✓</SelectItem>
                <SelectItem value="not_booked">Not booked</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-border)]/50">
              <Phone className="h-6 w-6 text-[var(--brand-muted)] opacity-50" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--brand-muted)]">No calls found</p>
              <p className="text-xs text-[var(--brand-muted)] opacity-60 mt-1">
                {hasActiveFilters
                  ? 'Try adjusting your filters'
                  : 'Calls will appear here after your AI receptionist handles them'}
              </p>
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-xs"
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* Sortable: Time */}
                    <TableHead
                      className="w-32 cursor-pointer select-none"
                      onClick={() => handleSort('created_at')}
                    >
                      <span className="flex items-center gap-1">
                        Time
                        {sortIcon('created_at')}
                      </span>
                    </TableHead>

                    <TableHead>Title / Caller</TableHead>
                    <TableHead className="w-28">Type</TableHead>
                    <TableHead className="w-16 text-center">Lead</TableHead>
                    <TableHead className="w-20 text-center">Booked</TableHead>

                    {/* Sortable: Revenue */}
                    <TableHead
                      className="w-28 text-right cursor-pointer select-none"
                      onClick={() => handleSort('potential_revenue')}
                    >
                      <span className="flex items-center justify-end gap-1">
                        {sortIcon('potential_revenue')}
                        Revenue
                      </span>
                    </TableHead>

                    {/* Sortable: Duration */}
                    <TableHead
                      className="w-20 text-right cursor-pointer select-none"
                      onClick={() => handleSort('duration_seconds')}
                    >
                      <span className="flex items-center justify-end gap-1">
                        {sortIcon('duration_seconds')}
                        Duration
                      </span>
                    </TableHead>

                    <TableHead className="w-16 text-center">Audio</TableHead>
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
                          className="cursor-pointer"
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
                          {/* Time */}
                          <TableCell className="text-xs text-[var(--brand-muted)]">
                            <div>{format(parseISO(log.created_at), 'MMM d')}</div>
                            <div className="opacity-70">{format(parseISO(log.created_at), 'h:mm a')}</div>
                          </TableCell>

                          {/* Title + caller */}
                          <TableCell>
                            <div className="font-medium text-sm text-[var(--brand-text)] leading-tight">
                              {log.semantic_title || 'Untitled call'}
                            </div>
                            {(log.caller_name || log.caller_phone) && (
                              <div className="text-xs text-[var(--brand-muted)] mt-0.5">
                                {log.caller_name && <span>{log.caller_name} · </span>}
                                {log.caller_phone}
                              </div>
                            )}
                            {/* AI summary 1-liner preview */}
                            {(log.ai_summary || log.summary) && (
                              <p className="text-xs text-[var(--brand-muted)] opacity-70 mt-1 line-clamp-1">
                                {log.ai_summary ?? log.summary}
                              </p>
                            )}
                            {log.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
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
                            )}
                          </TableCell>

                          {/* Call type + direction indicator */}
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant={typeColor} className="text-xs w-fit">
                                {CALL_TYPE_LABELS[log.call_type as CallType] ?? log.call_type ?? 'Unknown'}
                              </Badge>
                              {log.direction && (
                                <span className="flex items-center gap-0.5 text-[10px] text-[var(--brand-muted)]">
                                  {log.direction === 'inbound' ? (
                                    <>
                                      <ArrowDownLeft className="h-2.5 w-2.5 text-[var(--brand-primary)]" />
                                      Inbound
                                    </>
                                  ) : (
                                    <>
                                      <ArrowUpRight className="h-2.5 w-2.5 text-amber-500" />
                                      Outbound
                                    </>
                                  )}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Lead */}
                          <TableCell className="text-center">
                            {log.is_lead ? (
                              <span className="text-[var(--brand-primary)] text-sm">✓</span>
                            ) : (
                              <span className="text-[var(--brand-muted)] text-sm opacity-30">—</span>
                            )}
                          </TableCell>

                          {/* Booked */}
                          <TableCell className="text-center">
                            {log.is_booked ? (
                              <Badge variant="success" className="text-xs">Booked</Badge>
                            ) : (
                              <span className="text-[var(--brand-muted)] text-sm opacity-30">—</span>
                            )}
                          </TableCell>

                          {/* Revenue */}
                          <TableCell className="text-right text-sm tabular-nums">
                            {log.potential_revenue > 0 ? (
                              <span className="text-[var(--brand-text)] font-medium">
                                {formatCurrency(log.potential_revenue)}
                              </span>
                            ) : (
                              <span className="text-[var(--brand-muted)] opacity-30">—</span>
                            )}
                          </TableCell>

                          {/* Duration */}
                          <TableCell className="text-right text-xs text-[var(--brand-muted)]">
                            {log.duration_seconds > 0 ? formatDuration(log.duration_seconds) : '—'}
                          </TableCell>

                          {/* Audio player — stopPropagation so row expand isn't triggered */}
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            {log.recording_url ? (
                              <button
                                className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/30 transition-colors mx-auto"
                                onClick={() => {
                                  const willPlay = playingId !== log.id
                                  setPlayingId(willPlay ? log.id : null)
                                  if (willPlay) setExpandedId(log.id)
                                }}
                                title="Play recording"
                              >
                                <Play className="h-3 w-3 ml-0.5" />
                              </button>
                            ) : (
                              <span className="text-[var(--brand-muted)] opacity-30 text-xs">—</span>
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
                            <TableCell colSpan={9} className="py-4 px-6">
                              <div className="space-y-4">
                                {/* Audio inline player */}
                                {playingId === log.id && log.recording_url && (
                                  <div>
                                    <p className="text-xs font-medium text-[var(--brand-muted)] mb-1.5 uppercase tracking-wider">
                                      Recording
                                    </p>
                                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                                    <audio
                                      controls
                                      src={log.recording_url}
                                      className="h-8 w-full max-w-sm"
                                      autoPlay
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
                                      <span className={`text-xs font-medium ${sentimentStyle[log.sentiment as CallSentiment]?.className ?? ''}`}>
                                        {sentimentStyle[log.sentiment as CallSentiment]?.label ?? log.sentiment}
                                      </span>
                                    )}
                                    {log.intent && (
                                      <span className="text-xs text-[var(--brand-muted)]">
                                        Intent: {CALL_INTENT_LABELS[log.intent as keyof typeof CALL_INTENT_LABELS] ?? log.intent}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* AI Summary (prefer ai_summary, fall back to summary) */}
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
