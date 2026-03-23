'use client'

/**
 * Executive Summary — compact AI performance digest.
 *
 * Deterministic, rules-based summary generated from call logs.
 * Shows: header + bullet insights + 4 metric tiles + CTA.
 *
 * AI-powered summary is read from tenants.branding.ai_modules.summary.<rangeDays>
 * on mount, and can be regenerated via POST /api/ai/tenant-summary.
 */

import { useMemo, useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import {
  Bot,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ArrowRight,
  Check,
  AlertTriangle,
  Phone,
  Sparkles,
  Loader2,
  Lightbulb,
  ShieldAlert,
  Zap,
} from 'lucide-react'
import { AiStatusPill } from '@/components/ui/ai-status-pill'
import { useAiOnline } from '@/lib/ai/use-ai-online'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { cn, polish } from '@/lib/utils'
import { buildDashboardHref } from '@/lib/dashboard/link'
import { useFrontDeskMode } from '@/lib/dashboard/front-desk-mode'
import { computePeriodSummary, type PeriodSummary } from '@/lib/dashboard/conversion-metrics'
import type { CallLog } from '@/types/database'

// ── Props ────────────────────────────────────────────────────────────────────

interface WeeklyAiSummaryCardProps {
  callLogs: CallLog[]
  currency?: string
  tenantSlug?: string | null
  /** Raw tenants.branding JSON — used to pre-load cached AI summary */
  initialBranding?: Record<string, unknown> | null
}

// ── Narrative helpers ────────────────────────────────────────────────────────

function generateHeadline(current: PeriodSummary): string {
  if (current.callsHandled === 0) return ''
  const autonomy =
    current.callsHandled > 0
      ? Math.round(
          ((current.callsHandled - current.followUpsNeeded) /
            current.callsHandled) *
            100,
        )
      : 0
  return `AI handled ${current.callsHandled} call${current.callsHandled !== 1 ? 's' : ''} this week with ${autonomy}% autonomy.`
}

interface Bullet {
  icon: typeof Check
  text: string
  muted?: boolean
}

function generateBullets(current: PeriodSummary, prior: PeriodSummary): Bullet[] {
  const bullets: Bullet[] = []

  if (current.booked > 0) {
    bullets.push({
      icon: Check,
      text: `${current.booked} appointment${current.booked !== 1 ? 's' : ''} booked directly by AI`,
    })
  }

  // HIDDEN: follow-up temporarily disabled
  // if (current.followUpsNeeded > 0) {
  //   bullets.push({
  //     icon: AlertTriangle,
  //     text: `${current.followUpsNeeded} call${current.followUpsNeeded !== 1 ? 's' : ''} flagged for human follow-up`,
  //   })
  // } else if (current.callsHandled > 0) {
  //   bullets.push({
  //     icon: Check,
  //     text: 'No human follow-ups pending',
  //     muted: true,
  //   })
  // }

  if (prior.callsHandled > 0 && current.callsHandled > 0) {
    const delta = Math.round(
      ((current.callsHandled - prior.callsHandled) / prior.callsHandled) * 100,
    )
    if (Math.abs(delta) > 10) {
      bullets.push({
        icon: delta > 0 ? ArrowUpRight : ArrowDownRight,
        text: `Call volume ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)}% vs prior week`,
        muted: true,
      })
    }
  }

  return bullets
}

// ── Metric tile ──────────────────────────────────────────────────────────────

function MetricTile({
  label,
  value,
  trend,
}: {
  label: string
  value: string
  trend: 'up' | 'down' | 'flat' | null
}) {
  const TrendIcon =
    trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus
  const trendColor =
    trend === 'up'
      ? 'text-emerald-600 dark:text-emerald-400'
      : trend === 'down'
        ? 'text-rose-500 dark:text-rose-400'
        : 'text-[var(--brand-muted)]'

  return (
    <div className="flex-1 min-w-0 rounded-xl border border-[var(--brand-border)]/40 bg-[var(--brand-bg)]/50 p-3 transition-colors duration-150 hover:bg-[var(--brand-bg)]">
      <p className="text-[10px] font-medium text-[var(--brand-muted)] uppercase tracking-wider mb-1 truncate">
        {label}
      </p>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-semibold tracking-tight text-[var(--brand-text)] tabular-nums leading-none">
          {value}
        </span>
        {trend !== null && (
          <TrendIcon className={cn('h-3 w-3 shrink-0 opacity-70', trendColor)} />
        )}
      </div>
    </div>
  )
}

// ── Trend direction helper ───────────────────────────────────────────────────

function trendDir(
  current: number,
  prior: number,
): 'up' | 'down' | 'flat' | null {
  if (prior === 0 && current === 0) return null
  if (prior === 0) return 'up'
  const delta = ((current - prior) / prior) * 100
  if (delta > 5) return 'up'
  if (delta < -5) return 'down'
  return 'flat'
}

// ── Extract cached summary from branding JSON ────────────────────────────────

interface AiSummaryData {
  headline: string
  insights: string[]
  risks: string[]
  recommended_actions: string[]
}

interface CachedSummaryEntry {
  generated_at: string
  data: AiSummaryData
}

function extractCachedSummary(
  branding: Record<string, unknown> | null | undefined,
  rangeDays: number,
): CachedSummaryEntry | null {
  if (!branding) return null
  const aiModules = branding.ai_modules as Record<string, unknown> | undefined
  if (!aiModules) return null
  const summaryMap = aiModules.summary as Record<string, unknown> | undefined
  if (!summaryMap) return null
  const entry = summaryMap[String(rangeDays)] as CachedSummaryEntry | undefined
  if (!entry?.data || !entry?.generated_at) return null
  if (typeof entry.data.headline !== 'string') return null
  return entry
}

// ── Main export ──────────────────────────────────────────────────────────────

export function WeeklyAiSummaryCard({ callLogs, tenantSlug, initialBranding }: WeeklyAiSummaryCardProps) {
  const { mode } = useFrontDeskMode()
  const aiOnline = useAiOnline()
  const current = useMemo(() => computePeriodSummary(callLogs, 0, 7), [callLogs])
  const prior = useMemo(() => computePeriodSummary(callLogs, 7, 7), [callLogs])

  // AI-powered summary state — pre-load from branding if available
  const cached = useMemo(() => extractCachedSummary(initialBranding, 7), [initialBranding])
  const [aiSummary, setAiSummary] = useState<AiSummaryData | null>(cached?.data ?? null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(cached?.generated_at ?? null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // Sync when initialBranding changes (e.g. tenant switch)
  useEffect(() => {
    const next = extractCachedSummary(initialBranding, 7)
    setAiSummary(next?.data ?? null)
    setGeneratedAt(next?.generated_at ?? null)
    setAiError(null)
  }, [initialBranding])

  const handleGenerateSummary = useCallback(async () => {
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch('/api/ai/tenant-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rangeDays: 7 }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      setAiSummary(data.summary)
      // Update generated timestamp (new generation or cache hit)
      if (!data.cached) {
        setGeneratedAt(new Date().toISOString())
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to generate summary')
    } finally {
      setAiLoading(false)
    }
  }, [])

  const headline = useMemo(() => generateHeadline(current), [current])
  const bullets = useMemo(() => generateBullets(current, prior), [current, prior])

  const autonomyRate =
    current.callsHandled > 0
      ? Math.round(
          ((current.callsHandled - current.followUpsNeeded) /
            current.callsHandled) *
            100,
        )
      : 0

  // "AI Active" heartbeat — derive from most recent call
  const lastCallInfo = useMemo(() => {
    if (callLogs.length === 0) return null
    const sorted = [...callLogs].sort(
      (a, b) => Date.parse(b.contacted_at ?? b.created_at) - Date.parse(a.contacted_at ?? a.created_at),
    )
    const latest = sorted[0]
    const ts = latest.contacted_at ?? latest.created_at
    const hoursSince = (Date.now() - Date.parse(ts)) / 3_600_000
    return {
      ago: formatDistanceToNow(parseISO(ts), { addSuffix: true }),
      status: hoursSince < 24 ? 'active' as const : hoursSince < 72 ? 'idle' as const : 'stale' as const,
    }
  }, [callLogs])

  const heartbeatDot =
    lastCallInfo?.status === 'active' ? 'bg-emerald-500' :
    lastCallInfo?.status === 'idle' ? 'bg-amber-500' :
    'bg-[var(--brand-muted)]'

  // "Last generated X ago" label
  const generatedAgoLabel = useMemo(() => {
    if (!generatedAt) return null
    try {
      return formatDistanceToNow(parseISO(generatedAt), { addSuffix: true })
    } catch {
      return null
    }
  }, [generatedAt])

  // ── Empty state ────────────────────────────────────────────────────────────
  if (current.callsHandled === 0 && callLogs.length === 0) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-5">
          <div className={cn(polish.emptyState, 'py-10')}>
            <div className={polish.emptyIcon}>
              <Phone className="h-6 w-6 text-[var(--brand-muted)] opacity-50" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--brand-text)]">No calls yet this week</p>
              <p className="text-xs text-[var(--brand-muted)] opacity-60 mt-1 max-w-[240px] mx-auto">
                Once AI handles calls, you&apos;ll see a summary here.
              </p>
            </div>
            {mode !== 'simple' && (
              <Link
                href={buildDashboardHref('/dashboard/settings', tenantSlug)}
                className={polish.ctaLink}
              >
                Review setup
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        {/* ── Header row ───────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--user-accent-soft)]">
              <Bot className="h-4 w-4 text-[var(--user-accent)]" />
              {/* Heartbeat dot */}
              <span className={cn(
                'absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-[var(--brand-surface)]',
                heartbeatDot,
                lastCallInfo?.status === 'active' && 'animate-pulse',
              )} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-[var(--brand-text)] leading-tight">
                  Executive Summary
                </p>
                <AiStatusPill />
              </div>
              <p className="text-[10px] text-[var(--brand-muted)] leading-tight mt-0.5">
                {lastCallInfo
                  ? `AI Active · Last call ${lastCallInfo.ago}`
                  : 'Last 7 days vs prior 7 days'}
              </p>
            </div>
          </div>

          {/* CTA button */}
          {/* HIDDEN: follow-up temporarily disabled */}
          {/* {current.followUpsNeeded > 0 && (
            <Link
              href={buildDashboardHref('/dashboard/follow-up', tenantSlug)}
              className={cn(polish.ctaLink, 'shrink-0')}
            >
              Follow-ups
              <ArrowRight className="h-3 w-3" />
            </Link>
          )} */}
        </div>

        {/* ── Headline + bullet insights ──────────────────────────────── */}
        {headline && (
          <p className="text-[13px] font-medium leading-snug text-[var(--brand-text)] mb-2">
            {headline}
          </p>
        )}

        {bullets.length > 0 && (
          <ul className="space-y-1.5 mb-4">
            {bullets.map((b) => (
              <li
                key={b.text}
                className={cn(
                  'flex items-start gap-2 text-xs leading-relaxed',
                  b.muted ? 'text-[var(--brand-muted)]' : 'text-[var(--brand-text)]',
                )}
              >
                <b.icon className={cn(
                  'h-3.5 w-3.5 shrink-0 mt-0.5',
                  b.muted ? 'text-[var(--brand-muted)] opacity-50' : 'text-[var(--brand-primary)]',
                )} />
                {b.text}
              </li>
            ))}
          </ul>
        )}

        {/* ── 4 metric tiles ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2">
          <MetricTile
            label="Calls"
            value={current.callsHandled.toLocaleString()}
            trend={trendDir(current.callsHandled, prior.callsHandled)}
          />
          <MetricTile
            label="Autonomy"
            value={`${autonomyRate}%`}
            trend={trendDir(
              current.callsHandled - current.followUpsNeeded,
              prior.callsHandled - prior.followUpsNeeded,
            )}
          />
          <MetricTile
            label="Booked"
            value={current.booked.toLocaleString()}
            trend={trendDir(current.booked, prior.booked)}
          />
          <MetricTile
            label="Follow-ups"
            value={current.followUpsNeeded.toLocaleString()}
            trend={
              current.followUpsNeeded < prior.followUpsNeeded
                ? 'down'
                : current.followUpsNeeded > prior.followUpsNeeded
                  ? 'up'
                  : prior.followUpsNeeded === 0 && current.followUpsNeeded === 0
                    ? null
                    : 'flat'
            }
          />
        </div>

        {/* ── AI-powered summary section ──────────────────────────────── */}
        <div className="mt-4 pt-3 border-t border-[var(--brand-border)]/40">
          {aiSummary ? (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                <p className="text-[13px] font-medium text-[var(--brand-text)] leading-snug">
                  {aiSummary.headline}
                </p>
              </div>

              {aiSummary.insights.length > 0 && (
                <ul className="space-y-1">
                  {aiSummary.insights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-[var(--brand-text)]">
                      <Lightbulb className="h-3 w-3 shrink-0 mt-0.5 text-amber-500 opacity-70" />
                      {insight}
                    </li>
                  ))}
                </ul>
              )}

              {aiSummary.risks.length > 0 && aiSummary.risks[0] !== 'No significant risks identified' && (
                <ul className="space-y-1">
                  {aiSummary.risks.map((risk, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400">
                      <ShieldAlert className="h-3 w-3 shrink-0 mt-0.5 opacity-70" />
                      {risk}
                    </li>
                  ))}
                </ul>
              )}

              {aiSummary.recommended_actions.length > 0 && (
                <ul className="space-y-1">
                  {aiSummary.recommended_actions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-[var(--brand-primary)]">
                      <Zap className="h-3 w-3 shrink-0 mt-0.5 opacity-70" />
                      {action}
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-center justify-between">
                {generatedAgoLabel && (
                  <p className="text-[10px] text-[var(--brand-muted)] opacity-60">
                    Last generated {generatedAgoLabel}
                  </p>
                )}

                {mode !== 'simple' && aiOnline !== false && (
                  <button
                    onClick={handleGenerateSummary}
                    disabled={aiLoading || aiOnline === null}
                    className="text-[10px] text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors disabled:opacity-50"
                  >
                    {aiLoading ? 'Regenerating…' : 'Refresh AI summary'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-[var(--brand-muted)]">
                {mode === 'simple'
                  ? 'Updates daily at 6:00 AM'
                  : 'AI-powered executive insights'}
              </p>

              {mode !== 'simple' && (
                aiOnline === false ? (
                  <span className="text-[11px] text-[var(--brand-muted)] italic">
                    AI offline — enable later
                  </span>
                ) : (
                  <button
                    onClick={handleGenerateSummary}
                    disabled={aiLoading || aiOnline === null}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 dark:border-violet-800/50 bg-violet-50 dark:bg-violet-950/20 px-3 py-1.5 text-xs font-medium text-violet-700 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-950/40 transition-colors disabled:opacity-50"
                  >
                    {aiLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {aiLoading ? 'Generating…' : 'Generate now'}
                  </button>
                )
              )}
            </div>
          )}

          {aiError && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{aiError}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
