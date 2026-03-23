'use client'

/**
 * ProofEnginePanel — Revenue Proof page UI.
 *
 * Shows three proof cards (Recovered Revenue, After-hours Capture, Coverage),
 * a period-over-period comparison strip, range switcher, Proof Reel (top 5
 * recovered calls with inline player), Data Freshness badge, and CTA.
 *
 * All metrics are derived from the call_logs rows passed in — no extra queries.
 */

import { useMemo, useCallback, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  DollarSign,
  Moon,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  Play,
  Clock,
  ExternalLink,
  MicVocal,
} from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { cn, formatCurrency } from '@/lib/utils'
import { buildDashboardHref } from '@/lib/dashboard/link'
import { RecordingPlayer } from './recording-player'

// ── Types ────────────────────────────────────────────────────────────────────

/** Lean row type — only the columns selected by the proof page query. */
export interface ProofCallRow {
  id: string
  created_at: string
  contacted_at: string | null
  is_booked: boolean
  is_lead: boolean
  booked_value: number
  potential_revenue: number
  recording_url: string | null
  ai_summary: string | null
  summary: string | null
  direction: string | null
  caller_name: string | null
  caller_phone: string | null
  semantic_title: string | null
}

type ReelFilter = 'all' | 'booked' | 'leads'

const DEFAULT_TIMEZONE = 'America/Toronto'

interface ProofEnginePanelProps {
  callLogs: ProofCallRow[]
  prevCallLogs: ProofCallRow[]
  currency: string
  rangeDays: number
  tenantSlug: string
  timezone: string
  /** ISO timestamp of the latest call for this tenant (for Data Freshness). */
  latestCallAt: string | null
}

const RANGES = [7, 30, 45, 60, 365] as const

// ── Metric computation ──────────────────────────────────────────────────────

interface ProofMetrics {
  recoveredRevenue: number
  bookedRevenue: number
  pipelineRevenue: number
  afterHoursCapture: number
  afterHoursCalls: number
  afterHoursBooked: number
  totalCalls: number
  coverageScore: number
  coveredCalls: number
}

/** Extract the hour (0-23) for a timestamp in a given IANA timezone. */
function getLocalHour(isoTimestamp: string, tz: string): number {
  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      hour12: false,
    }).format(new Date(isoTimestamp))
    // Intl returns "00"–"23" (or "24" in rare locales — clamp)
    return Math.min(Number(formatted), 23)
  } catch {
    // Invalid timezone — fall back to local JS hour
    return new Date(isoTimestamp).getHours()
  }
}

function computeMetrics(logs: ProofCallRow[], tz: string): ProofMetrics {
  let bookedRevenue = 0
  let pipelineRevenue = 0
  let afterHoursCapture = 0
  let afterHoursCalls = 0
  let afterHoursBooked = 0
  let coveredCalls = 0

  for (const log of logs) {
    if (log.is_booked) {
      bookedRevenue += log.booked_value ?? 0
    }

    if (log.is_lead && !log.is_booked) {
      pipelineRevenue += log.potential_revenue ?? 0
    }

    // After-hours: use contacted_at (fallback created_at), resolved in tenant timezone
    const ts = log.contacted_at ?? log.created_at
    const hour = getLocalHour(ts, tz)
    if (hour < 9 || hour >= 17) {
      afterHoursCalls++
      if (log.is_booked) afterHoursBooked++
      if (log.is_booked || log.is_lead) {
        afterHoursCapture +=
          (log.booked_value ?? 0) +
          (log.is_lead && !log.is_booked ? (log.potential_revenue ?? 0) : 0)
      }
    }

    if (log.recording_url || log.ai_summary) {
      coveredCalls++
    }
  }

  const totalCalls = logs.length
  const coverageScore = totalCalls > 0 ? Math.round((coveredCalls / totalCalls) * 100) : 0

  return {
    recoveredRevenue: bookedRevenue + pipelineRevenue,
    bookedRevenue,
    pipelineRevenue,
    afterHoursCapture,
    afterHoursCalls,
    afterHoursBooked,
    totalCalls,
    coverageScore,
    coveredCalls,
  }
}

// ── Proof Reel: top 5 recovered calls ────────────────────────────────────────

/** Sort comparator for a group: by revenue desc, then contacted_at desc. */
function sortByRevenueThenTime(
  a: ProofCallRow,
  b: ProofCallRow,
  revenueKey: 'booked_value' | 'potential_revenue',
): number {
  const diff = (b[revenueKey] ?? 0) - (a[revenueKey] ?? 0)
  if (diff !== 0) return diff
  const aTs = a.contacted_at ?? a.created_at
  const bTs = b.contacted_at ?? b.created_at
  return bTs.localeCompare(aTs)
}

function getProofReelCalls(logs: ProofCallRow[], filter: ReelFilter): ProofCallRow[] {
  // Hard requirement: must have a recording
  const withRecording = logs.filter((l) => l.recording_url)

  if (filter === 'booked') {
    return withRecording
      .filter((l) => l.is_booked)
      .sort((a, b) => sortByRevenueThenTime(a, b, 'booked_value'))
      .slice(0, 5)
  }

  if (filter === 'leads') {
    return withRecording
      .filter((l) => l.is_lead && !l.is_booked)
      .sort((a, b) => sortByRevenueThenTime(a, b, 'potential_revenue'))
      .slice(0, 5)
  }

  // 'all': booked group first (by value), then leads group (by value), top 5 total
  const booked = withRecording
    .filter((l) => l.is_booked)
    .sort((a, b) => sortByRevenueThenTime(a, b, 'booked_value'))

  const leads = withRecording
    .filter((l) => l.is_lead && !l.is_booked)
    .sort((a, b) => sortByRevenueThenTime(a, b, 'potential_revenue'))

  return [...booked, ...leads].slice(0, 5)
}

// ── Data Freshness helpers ──────────────────────────────────────────────────

type FreshnessLevel = 'fresh' | 'recent' | 'stale'

function getFreshness(latestCallAt: string | null): { level: FreshnessLevel; label: string } {
  if (!latestCallAt) return { level: 'stale', label: 'No call data' }
  const hoursSince = (Date.now() - Date.parse(latestCallAt)) / 3_600_000
  const label = `Last call ${formatDistanceToNow(parseISO(latestCallAt), { addSuffix: true })}`
  if (hoursSince < 1) return { level: 'fresh', label }
  if (hoursSince < 24) return { level: 'recent', label }
  return { level: 'stale', label }
}

const freshnessStyles: Record<FreshnessLevel, { dot: string; badge: string }> = {
  fresh:  { dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' },
  recent: { dot: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' },
  stale:  { dot: 'bg-gray-400',    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
}

// ── Delta helpers ────────────────────────────────────────────────────────────

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0 && curr === 0) return null
  if (prev === 0) return 100
  return Math.round(((curr - prev) / prev) * 100)
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[11px] text-[var(--brand-muted)]">No prior data</span>
  const isUp = value > 0
  const isFlat = value === 0
  const Icon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-medium',
        isFlat && 'text-[var(--brand-muted)]',
        isUp && 'text-emerald-600 dark:text-emerald-400',
        !isUp && !isFlat && 'text-rose-600 dark:text-rose-400',
      )}
    >
      <Icon className="h-3 w-3" />
      {isUp ? '+' : ''}{value}% vs prior period
    </span>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export function ProofEnginePanel({
  callLogs,
  prevCallLogs,
  currency,
  rangeDays,
  tenantSlug,
  timezone,
  latestCallAt,
}: ProofEnginePanelProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [reelFilter, setReelFilter] = useState<ReelFilter>('all')

  // Resolve timezone: use tenant's configured TZ, fallback to default
  const tz = timezone || DEFAULT_TIMEZONE
  const isDefaultTz = !timezone

  const curr = useMemo(() => computeMetrics(callLogs, tz), [callLogs, tz])
  const prev = useMemo(() => computeMetrics(prevCallLogs, tz), [prevCallLogs, tz])
  const reelCalls = useMemo(() => getProofReelCalls(callLogs, reelFilter), [callLogs, reelFilter])
  const freshness = useMemo(() => getFreshness(latestCallAt), [latestCallAt])

  const handleRange = useCallback(
    (r: number) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('range', String(r))
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  // CTA href: pre-filter call logs to booked/lead calls with recordings
  const ctaHref = buildDashboardHref(
    '/dashboard/call-logs?hasRecording=1&bookedOrLead=1',
    tenantSlug,
  )

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
      {/* Header + freshness badge + range switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[var(--brand-text)] tracking-tight">
              Revenue Proof
            </h1>
            {/* Data Freshness badge */}
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                freshnessStyles[freshness.level].badge,
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', freshnessStyles[freshness.level].dot)} />
              {freshness.label}
            </span>
          </div>
          <p className="text-sm text-[var(--brand-muted)] mt-0.5">
            Quantified value your AI receptionist captured
          </p>
        </div>

        {/* Range pills */}
        <div className="flex items-center gap-1 rounded-xl bg-[var(--brand-surface)] border border-[var(--brand-border)] p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => handleRange(r)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150',
                r === rangeDays
                  ? 'bg-[var(--brand-primary)] text-white shadow-sm'
                  : 'text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-bg)]',
              )}
            >
              {r === 365 ? '1Y' : `${r}D`}
            </button>
          ))}
        </div>
      </div>

      {/* Proof cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Recovered Revenue */}
        <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/30">
              <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-xs font-medium text-[var(--brand-muted)] uppercase tracking-wider">
              Recovered Revenue
            </span>
          </div>
          <p className="text-2xl font-bold text-[var(--brand-text)] tabular-nums">
            {formatCurrency(curr.recoveredRevenue, currency)}
          </p>
          <div className="mt-1 flex items-baseline gap-2 text-[11px] text-[var(--brand-muted)]">
            <span>{formatCurrency(curr.bookedRevenue, currency)} booked</span>
            <span className="opacity-40">|</span>
            <span>{formatCurrency(curr.pipelineRevenue, currency)} pipeline</span>
          </div>
          <div className="mt-3">
            <DeltaBadge value={pctChange(curr.recoveredRevenue, prev.recoveredRevenue)} />
          </div>
        </div>

        {/* Card 2: After-hours Capture */}
        <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950/30">
              <Moon className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <span className="text-xs font-medium text-[var(--brand-muted)] uppercase tracking-wider">
              After-hours Capture
            </span>
          </div>
          <p className="text-2xl font-bold text-[var(--brand-text)] tabular-nums">
            {formatCurrency(curr.afterHoursCapture, currency)}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--brand-muted)]">
            <span>
              {curr.afterHoursCalls} call{curr.afterHoursCalls !== 1 ? 's' : ''} outside 9 AM – 5 PM
              {curr.afterHoursBooked > 0 && ` · ${curr.afterHoursBooked} booked`}
            </span>
            {isDefaultTz && (
              <span className="rounded px-1 py-0.5 text-[9px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" title={`Using default timezone: ${DEFAULT_TIMEZONE}`}>
                TZ default
              </span>
            )}
          </div>
          <div className="mt-3">
            <DeltaBadge value={pctChange(curr.afterHoursCapture, prev.afterHoursCapture)} />
          </div>
        </div>

        {/* Card 3: Coverage */}
        <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950/30">
              <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs font-medium text-[var(--brand-muted)] uppercase tracking-wider">
              Coverage
            </span>
          </div>
          <p className="text-2xl font-bold text-[var(--brand-text)] tabular-nums">
            {curr.coverageScore}%
          </p>
          <div className="mt-1 text-[11px] text-[var(--brand-muted)]">
            {curr.coveredCalls} of {curr.totalCalls} calls with recording or AI summary
          </div>
          <div className="mt-3">
            <DeltaBadge value={pctChange(curr.coverageScore, prev.coverageScore)} />
          </div>
        </div>
      </div>

      {/* Period comparison strip */}
      <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[var(--brand-muted)]">
        <span className="font-medium text-[var(--brand-text)]">What changed vs previous {rangeDays} days</span>
        <span>
          Calls: {prev.totalCalls} → {curr.totalCalls}
        </span>
        <span>
          Booked: {formatCurrency(prev.bookedRevenue, currency)} → {formatCurrency(curr.bookedRevenue, currency)}
        </span>
        <span>
          Coverage: {prev.coverageScore}% → {curr.coverageScore}%
        </span>
      </div>

      {/* ── Proof Reel ────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Section header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brand-primary)]/10">
              <MicVocal className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--brand-text)] leading-tight">
                Proof Reel — Top recovered calls
              </h2>
              <p className="text-[11px] text-[var(--brand-muted)] leading-tight mt-0.5">
                Calls with recordings where AI captured revenue
              </p>
            </div>
          </div>

          {/* All / Booked / Leads toggle */}
          <div className="flex items-center gap-1 rounded-lg bg-[var(--brand-surface)] border border-[var(--brand-border)] p-0.5 self-start sm:self-auto">
            {(
              [
                { id: 'all',    label: 'All' },
                { id: 'booked', label: 'Booked' },
                { id: 'leads',  label: 'Leads' },
              ] as { id: ReelFilter; label: string }[]
            ).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setReelFilter(id)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-all duration-150',
                  id === reelFilter
                    ? 'bg-[var(--brand-primary)] text-white shadow-sm'
                    : 'text-[var(--brand-muted)] hover:text-[var(--brand-text)]',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Cards */}
        {reelCalls.length === 0 ? (
          /* Premium empty state */
          <div className="rounded-2xl border border-dashed border-[var(--brand-border)] bg-[var(--brand-surface)]/40 px-6 py-10 text-center">
            <Play className="mx-auto h-8 w-8 text-[var(--brand-muted)] opacity-30 mb-3" />
            <p className="text-sm font-medium text-[var(--brand-muted)]">
              No recovered recordings yet.
            </p>
            <p className="mt-1 text-xs text-[var(--brand-muted)] opacity-60">
              Calls with recordings that resulted in bookings or leads will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {reelCalls.map((call) => {
              const callerLabel = call.caller_name ?? call.caller_phone ?? 'Unknown'
              const titleLabel = call.semantic_title ?? 'Inbound call'
              const summaryLine = call.ai_summary ?? call.summary ?? null
              const revenueValue = call.is_booked
                ? (call.booked_value ?? 0)
                : (call.potential_revenue ?? 0)
              const detailHref = buildDashboardHref(`/dashboard/call-logs/${call.id}`, tenantSlug)

              return (
                <div
                  key={call.id}
                  className="group flex flex-col gap-3 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 transition-shadow duration-150 hover:shadow-sm"
                >
                  {/* Top row: status pill + caller + value */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Status pill */}
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          call.is_booked
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
                        )}
                      >
                        {call.is_booked ? 'Booked' : 'Lead'}
                      </span>
                      {/* Caller */}
                      <span className="text-xs text-[var(--brand-muted)] truncate">
                        {callerLabel}
                      </span>
                    </div>
                    {/* Value */}
                    {revenueValue > 0 && (
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--brand-text)]">
                        {formatCurrency(revenueValue, currency)}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-[var(--brand-text)] leading-snug line-clamp-1">
                      {titleLabel}
                    </p>
                  </div>

                  {/* Summary one-liner */}
                  <p className="text-xs text-[var(--brand-muted)] line-clamp-2 leading-relaxed min-h-[2.5rem]">
                    {summaryLine ?? '—'}
                  </p>

                  {/* Inline audio player */}
                  {call.recording_url && (
                    <RecordingPlayer src={call.recording_url} />
                  )}

                  {/* Footer: timestamp + open details */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--brand-border)]/50">
                    <div className="flex items-center gap-1 text-[10px] text-[var(--brand-muted)]">
                      <Clock className="h-3 w-3 shrink-0" />
                      {formatDistanceToNow(parseISO(call.contacted_at ?? call.created_at), { addSuffix: true })}
                    </div>
                    <Link
                      href={detailHref}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--brand-primary)] hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/30 rounded"
                    >
                      Open details
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer link */}
        <div className="flex items-center justify-between">
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--brand-primary)] hover:underline transition-colors"
          >
            View all recovered calls
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* CTA button */}
      <Link
        href={ctaHref}
        className="inline-flex items-center gap-2 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] px-5 py-3 text-sm font-medium text-[var(--brand-text)] hover:bg-[var(--brand-bg)] transition-colors duration-150"
      >
        Listen to recovered calls
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
