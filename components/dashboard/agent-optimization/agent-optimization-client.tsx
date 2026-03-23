'use client'

/**
 * Agent Optimization — interactive client component.
 *
 * Features:
 * 1. Range switcher (7 / 30 / 45 / 60 days)
 * 2. Generate Insights button (POST /api/ai/outbound/insights)
 * 3. Insights cards: top objections, fail reasons, winning lines, period deltas
 * 4. Recommendations accordion: Draft → Approve / Reject / Export (copy diff)
 * 5. A/B Experiment panel: switch active variant, save prompt text
 *
 * Rules enforced in UI:
 * - Never auto-push to Retell; Export = clipboard copy only
 * - No external vendor links
 */

import { useState, useCallback } from 'react'
import {
  FlaskConical,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Lightbulb,
  Trophy,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentOptimizationStore, Recommendation, StoredInsight } from '@/lib/ai/agent-optimization/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  store: AgentOptimizationStore
  tenantId: string
}

type RangeDays = 7 | 30 | 45 | 60

const RANGE_OPTIONS: { label: string; value: RangeDays }[] = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '45d', value: 45 },
  { label: '60d', value: 60 },
]

// ── Delta pill ────────────────────────────────────────────────────────────────

function DeltaPill({ value, format = 'pct' }: { value?: number; format?: 'pct' | 'sec' }) {
  if (value === undefined || value === null) return null
  const abs = Math.abs(value)
  const formatted =
    format === 'sec'
      ? `${abs >= 1 ? Math.round(abs) : abs.toFixed(1)}s`
      : `${(abs * 100).toFixed(1)}%`

  if (abs < 0.005 && format === 'pct') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[var(--brand-muted)]">
        <Minus className="h-3 w-3" /> {formatted}
      </span>
    )
  }

  const positive = value > 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-[11px] font-semibold',
        positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
      )}
    >
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {formatted}
    </span>
  )
}

// ── Impact badge ──────────────────────────────────────────────────────────────

function ImpactBadge({ impact }: { impact: 'high' | 'med' | 'low' }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-full px-2 text-[10px] font-bold uppercase tracking-wide',
        impact === 'high' && 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
        impact === 'med' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
        impact === 'low' && 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
      )}
    >
      {impact}
    </span>
  )
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Recommendation['status'] }) {
  const map = {
    draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
    rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400',
    archived: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500',
  }
  return (
    <span className={cn('inline-flex h-5 items-center rounded-full px-2 text-[10px] font-bold uppercase tracking-wide', map[status])}>
      {status}
    </span>
  )
}

// ── CopyButton ────────────────────────────────────────────────────────────────

function CopyButton({ text, label = 'Export diff' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-2.5 py-1 text-[12px] font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:border-[var(--brand-primary)] transition-colors duration-150"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied!' : label}
    </button>
  )
}

// ── PromptDiff display ────────────────────────────────────────────────────────

function DiffRow({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--brand-muted)]">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-rose-500 mb-1">Before</p>
          <p className="text-[12px] text-[var(--brand-text)] leading-relaxed">{before}</p>
        </div>
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 mb-1">After</p>
          <p className="text-[12px] text-[var(--brand-text)] leading-relaxed">{after}</p>
        </div>
      </div>
    </div>
  )
}

// ── RecommendationCard ────────────────────────────────────────────────────────

interface RecCardProps {
  rec: Recommendation
  onApprove: (id: string) => Promise<void>
  onReject: (id: string) => Promise<void>
}

function RecommendationCard({ rec, onApprove, onReject }: RecCardProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)

  const handleApprove = async () => {
    setLoading('approve')
    await onApprove(rec.id).finally(() => setLoading(null))
  }
  const handleReject = async () => {
    setLoading('reject')
    await onReject(rec.id).finally(() => setLoading(null))
  }

  const diffText = JSON.stringify(rec.diff, null, 2)

  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--brand-bg)] transition-colors duration-150"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] font-semibold text-[var(--brand-text)] truncate">{rec.title}</p>
            <ImpactBadge impact={rec.expected_impact} />
            <StatusBadge status={rec.status} />
          </div>
          <p className="mt-0.5 text-[12px] text-[var(--brand-muted)] line-clamp-2">{rec.rationale}</p>
        </div>
        <div className="shrink-0 mt-0.5">
          {open ? <ChevronUp className="h-4 w-4 text-[var(--brand-muted)]" /> : <ChevronDown className="h-4 w-4 text-[var(--brand-muted)]" />}
        </div>
      </div>

      {/* Expanded body */}
      {open && (
        <div className="border-t border-[var(--brand-border)] px-4 py-4 space-y-4">
          {/* Prompt diffs */}
          <div className="space-y-3">
            {rec.diff.opening && <DiffRow label="Opening" before={rec.diff.opening.before} after={rec.diff.opening.after} />}
            {rec.diff.qualifying && <DiffRow label="Qualifying" before={rec.diff.qualifying.before} after={rec.diff.qualifying.after} />}
            {rec.diff.objections?.map((o) => (
              <DiffRow key={o.objection} label={`Objection: ${o.objection}`} before={o.before} after={o.after} />
            ))}
            {rec.diff.closing && <DiffRow label="Closing" before={rec.diff.closing.before} after={rec.diff.closing.after} />}
          </div>

          {/* A/B plan */}
          <div className="rounded-lg bg-[var(--brand-bg)] border border-[var(--brand-border)] px-3 py-2 text-[12px] text-[var(--brand-muted)]">
            <span className="font-semibold text-[var(--brand-text)]">A/B plan:</span>{' '}
            {rec.ab_plan.split}/{100 - rec.ab_plan.split} split · optimize for{' '}
            <span className="font-medium text-[var(--brand-text)]">{rec.ab_plan.success_metric}</span> ·{' '}
            {rec.ab_plan.duration_days} days
          </div>

          {/* Actions */}
          {rec.status === 'draft' && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleApprove}
                disabled={!!loading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors duration-150"
              >
                {loading === 'approve' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Approve
              </button>
              <button
                onClick={handleReject}
                disabled={!!loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--brand-border)] px-3 py-1.5 text-[12px] font-semibold text-[var(--brand-muted)] hover:text-rose-600 hover:border-rose-400 disabled:opacity-50 transition-colors duration-150"
              >
                {loading === 'reject' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                Reject
              </button>
              <CopyButton text={diffText} />
            </div>
          )}
          {rec.status === 'approved' && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[12px] text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approved
                {rec.approved_at && ` · ${new Date(rec.approved_at).toLocaleDateString()}`}
              </span>
              <CopyButton text={diffText} label="Copy diff" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── ExperimentPanel ───────────────────────────────────────────────────────────

interface ExperimentPanelProps {
  store: AgentOptimizationStore
}

function ExperimentPanel({ store }: ExperimentPanelProps) {
  const exp = store.experiment
  const [variant, setVariant] = useState<'A' | 'B'>(exp?.active_variant ?? 'A')
  const [promptA, setPromptA] = useState(exp?.variantA_prompt ?? '')
  const [promptB, setPromptB] = useState(exp?.variantB_prompt ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/ai/outbound/experiment/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeVariant: variant, variantA_prompt: promptA, variantB_prompt: promptB }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-[var(--brand-text)]">A/B Experiment</h3>
        <p className="text-[11px] text-[var(--brand-muted)]">Stored in your tenant only — never pushed automatically</p>
      </div>

      {/* Variant toggle */}
      <div className="flex gap-2">
        {(['A', 'B'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setVariant(v)}
            className={cn(
              'flex-1 rounded-lg border px-4 py-2.5 text-[13px] font-semibold transition-all duration-150',
              variant === v
                ? 'border-[var(--user-accent)] bg-[var(--user-accent-soft)] text-[var(--user-accent)]'
                : 'border-[var(--brand-border)] bg-[var(--brand-bg)] text-[var(--brand-muted)] hover:text-[var(--brand-text)]',
            )}
          >
            Variant {v}
            {exp?.active_variant === v && (
              <span className="ml-2 text-[10px] font-bold uppercase tracking-wide opacity-70">active</span>
            )}
          </button>
        ))}
      </div>

      {/* Prompt editors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {([['A', promptA, setPromptA], ['B', promptB, setPromptB]] as const).map(([v, val, setter]) => (
          <div key={v} className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--brand-muted)]">
              Variant {v} prompt
            </label>
            <textarea
              value={val}
              onChange={(e) => setter(e.target.value)}
              rows={5}
              placeholder={`Paste the Variant ${v} system prompt here…`}
              className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-3 py-2 text-[12px] text-[var(--brand-text)] placeholder-[var(--brand-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:ring-offset-1"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50 transition-colors duration-150"
          style={{ background: 'var(--user-accent)' }}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? 'Saving…' : 'Save & set active variant'}
        </button>
        {saved && (
          <span className="text-[12px] text-emerald-600 font-medium flex items-center gap-1">
            <Check className="h-3.5 w-3.5" /> Saved
          </span>
        )}
      </div>

      <p className="text-[11px] text-[var(--brand-muted)] bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-lg px-3 py-2">
        <AlertTriangle className="inline h-3 w-3 mr-1 text-amber-500" />
        To activate a variant on your AI agent, copy the prompt and manually update it in Retell or your telephony platform. Nothing is pushed automatically.
      </p>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AgentOptimizationClient({ store: initialStore, tenantId }: Props) {
  const [store, setStore] = useState(initialStore)
  const [range, setRange] = useState<RangeDays>(30)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentInsight: StoredInsight | undefined = store.insights[String(range)]
  const currentRecs: Recommendation[] = currentInsight
    ? currentInsight.data.recommendation_ids
        .map((id) => store.recommendations[id])
        .filter(Boolean)
    : []

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/outbound/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rangeDays: range }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as {
        insight: StoredInsight
        recommendations: Recommendation[]
        cached: boolean
        call_count?: number
      }
      // Merge new data into store
      const newRecs: Record<string, Recommendation> = {}
      for (const r of data.recommendations) newRecs[r.id] = r
      setStore((s) => ({
        ...s,
        insights: { ...s.insights, [String(range)]: data.insight },
        recommendations: { ...s.recommendations, ...newRecs },
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleApprove = async (id: string) => {
    const res = await fetch(`/api/ai/outbound/recommendations/${id}/approve`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json() as { recommendation: Recommendation }
      setStore((s) => ({
        ...s,
        recommendations: { ...s.recommendations, [id]: data.recommendation },
      }))
    }
  }

  const handleReject = async (id: string) => {
    const res = await fetch(`/api/ai/outbound/recommendations/${id}/reject`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json() as { recommendation: Recommendation }
      setStore((s) => ({
        ...s,
        recommendations: { ...s.recommendations, [id]: data.recommendation },
      }))
    }
  }

  const deltas = currentInsight?.data.comparison?.deltas

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-[var(--brand-primary)]" />
            <h1 className="text-[20px] font-bold text-[var(--brand-text)]">Agent Optimization</h1>
          </div>
          <p className="mt-1 text-[13px] text-[var(--brand-muted)]">
            AI-generated insights from your outbound call batch · recommendations are drafts until you approve them
          </p>
        </div>

        {/* Range + Generate */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-xl border border-[var(--brand-border)] overflow-hidden">
            {RANGE_OPTIONS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setRange(value)}
                className={cn(
                  'px-3 py-1.5 text-[12px] font-semibold transition-all duration-150',
                  range === value
                    ? 'bg-[var(--user-accent-soft)] text-[var(--user-accent)]'
                    : 'bg-[var(--brand-surface)] text-[var(--brand-muted)] hover:text-[var(--brand-text)]',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60 transition-all duration-150 hover:opacity-90"
            style={{ background: 'var(--user-accent)' }}
          >
            {generating
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : currentInsight
              ? <RefreshCw className="h-4 w-4" />
              : <FlaskConical className="h-4 w-4" />}
            {generating ? 'Analyzing…' : currentInsight ? 'Refresh' : 'Generate insights'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900/40 px-4 py-3 text-[13px] text-rose-700 dark:text-rose-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Empty state */}
      {!currentInsight && !generating && (
        <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-[var(--brand-border)] bg-[var(--brand-surface)]">
          <FlaskConical className="h-10 w-10 text-[var(--brand-muted)] mb-3 opacity-40" />
          <p className="text-[14px] font-medium text-[var(--brand-muted)]">No insights for the last {range} days</p>
          <p className="text-[12px] text-[var(--brand-muted)] opacity-60 mt-1">Click "Generate insights" to analyze your outbound calls</p>
        </div>
      )}

      {/* Insights */}
      {currentInsight && (
        <div className="space-y-5">
          {/* Period deltas */}
          {deltas && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Connect rate', value: deltas.connect_rate },
                { label: 'Lead rate', value: deltas.lead_rate },
                { label: 'Booked rate', value: deltas.booked_rate },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] px-4 py-3">
                  <p className="text-[11px] text-[var(--brand-muted)]">{label}</p>
                  <div className="mt-1"><DeltaPill value={value} /></div>
                  <p className="text-[10px] text-[var(--brand-muted)] mt-0.5 opacity-60">vs prev {currentInsight.data.comparison?.prev_range}d</p>
                </div>
              ))}
              <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] px-4 py-3">
                <p className="text-[11px] text-[var(--brand-muted)]">Avg duration</p>
                <div className="mt-1"><DeltaPill value={deltas.avg_duration} format="sec" /></div>
                <p className="text-[10px] text-[var(--brand-muted)] mt-0.5 opacity-60">vs prev {currentInsight.data.comparison?.prev_range}d</p>
              </div>
            </div>
          )}

          {/* 3-column insight grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Top objections */}
            <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h3 className="text-[13px] font-semibold text-[var(--brand-text)]">Top Objections</h3>
              </div>
              {currentInsight.data.top_objections.length === 0 && (
                <p className="text-[12px] text-[var(--brand-muted)]">None identified</p>
              )}
              {currentInsight.data.top_objections.map((obj) => (
                <div key={obj.label} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-medium text-[var(--brand-text)]">{obj.label}</p>
                    <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">{obj.count}×</span>
                  </div>
                  {obj.examples?.slice(0, 1).map((ex, i) => (
                    <p key={i} className="text-[11px] text-[var(--brand-muted)] italic truncate">"{ex}"</p>
                  ))}
                </div>
              ))}
            </div>

            {/* Top fail reasons */}
            <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 space-y-3">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-rose-500" />
                <h3 className="text-[13px] font-semibold text-[var(--brand-text)]">Fail Reasons</h3>
              </div>
              {currentInsight.data.top_fail_reasons.length === 0 && (
                <p className="text-[12px] text-[var(--brand-muted)]">None identified</p>
              )}
              {currentInsight.data.top_fail_reasons.map((reason) => (
                <div key={reason.label} className="flex items-center justify-between">
                  <p className="text-[12px] font-medium text-[var(--brand-text)]">{reason.label}</p>
                  <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">{reason.count}×</span>
                </div>
              ))}
            </div>

            {/* Winning lines */}
            <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-emerald-500" />
                <h3 className="text-[13px] font-semibold text-[var(--brand-text)]">Winning Lines</h3>
              </div>
              {currentInsight.data.winning_lines.length === 0 && (
                <p className="text-[12px] text-[var(--brand-muted)]">None identified yet</p>
              )}
              {currentInsight.data.winning_lines.map((line, i) => (
                <div key={i} className="space-y-0.5">
                  <p className="text-[12px] font-medium text-[var(--brand-text)] italic">"{line.snippet}"</p>
                  <p className="text-[11px] text-[var(--brand-muted)]">{line.why}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          {currentRecs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-[var(--brand-primary)]" />
                <h2 className="text-[15px] font-bold text-[var(--brand-text)]">Recommendations</h2>
                <span className="text-[11px] text-[var(--brand-muted)]">{currentRecs.length} suggestions · approve to mark for implementation</span>
              </div>
              {currentRecs.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  rec={rec}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))}
            </div>
          )}

          {/* Metadata */}
          <p className="text-[11px] text-[var(--brand-muted)] opacity-60">
            Generated {new Date(currentInsight.generated_at).toLocaleString()} · model: {currentInsight.model}
          </p>
        </div>
      )}

      {/* A/B Experiment panel — always visible */}
      <ExperimentPanel store={store} />
    </div>
  )
}
