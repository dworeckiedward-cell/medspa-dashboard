'use client'

/**
 * AiInsightsSection — compact AI tags display with "Generate insights" button.
 *
 * Shows intent/service/objection/outcome/urgency/lead_confidence tags.
 * In simple mode: read-only display or "Insights pending".
 * In operator/analyst: "Generate insights" button triggers /api/ai/tag-call.
 */

import { useState, useCallback, useEffect } from 'react'
import {
  Sparkles,
  Loader2,
  Target,
  ShoppingBag,
  ShieldAlert,
  Flame,
  CheckCircle2,
  Gauge,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFrontDeskMode } from '@/lib/dashboard/front-desk-mode'
import { useAiOnline } from '@/lib/ai/use-ai-online'
import type { CallLog } from '@/types/database'

// ── Types ────────────────────────────────────────────────────────────────────

interface AiTags {
  intent: string
  service: string | null
  objection: string
  urgency: string
  outcome: string
  lead_confidence: number
}

interface AiInsightsSectionProps {
  callLog: CallLog
  /** Compact layout for side panels */
  compact?: boolean
}

// ── Tag config ───────────────────────────────────────────────────────────────

const urgencyColors: Record<string, string> = {
  hot:  'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400',
  warm: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
  cold: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
}

const outcomeColors: Record<string, string> = {
  booked:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
  lead:      'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
  completed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  followup:  'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
  lost:      'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractExistingTags(log: CallLog): AiTags | null {
  const raw = log.raw_payload as Record<string, unknown> | null
  const modules = raw?.ai_modules as Record<string, unknown> | undefined
  const tags = modules?.tags as AiTags | undefined
  if (tags && typeof tags.intent === 'string') return tags
  return null
}

// ── Component ────────────────────────────────────────────────────────────────

export function AiInsightsSection({ callLog, compact }: AiInsightsSectionProps) {
  const { mode } = useFrontDeskMode()
  const aiOnline = useAiOnline()
  const [tags, setTags] = useState<AiTags | null>(() => extractExistingTags(callLog))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync when callLog changes
  useEffect(() => {
    setTags(extractExistingTags(callLog))
    setError(null)
  }, [callLog])

  const handleGenerate = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/tag-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callLogId: callLog.id }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      setTags(data.tags)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate insights')
    } finally {
      setLoading(false)
    }
  }, [callLog.id])

  // ── No tags yet ──────────────────────────────────────────────────────────
  if (!tags) {
    return (
      <div className={cn(
        'rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4',
        compact && 'p-3',
      )}>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <h3 className={cn('font-semibold text-[var(--brand-text)]', compact ? 'text-xs' : 'text-sm')}>
            AI Insights
          </h3>
        </div>

        {error && (
          <p className="text-[11px] text-rose-600 dark:text-rose-400 mb-2">{error}</p>
        )}

        {mode === 'simple' ? (
          <p className="text-xs text-[var(--brand-muted)]">Insights pending — updates automatically</p>
        ) : aiOnline === false ? (
          <p className="text-[11px] text-[var(--brand-muted)] italic">AI offline — enable later</p>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={loading || aiOnline === null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 dark:border-violet-800/50 bg-violet-50 dark:bg-violet-950/20 px-3 py-1.5 text-xs font-medium text-violet-700 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-950/40 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {loading ? 'Generating…' : 'Generate insights'}
          </button>
        )}
      </div>
    )
  }

  // ── Tags display ─────────────────────────────────────────────────────────
  return (
    <div className={cn(
      'rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4',
      compact && 'p-3',
    )}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-violet-500" />
        <h3 className={cn('font-semibold text-[var(--brand-text)]', compact ? 'text-xs' : 'text-sm')}>
          AI Insights
        </h3>
        {mode !== 'simple' && aiOnline !== false && (
          <button
            onClick={handleGenerate}
            disabled={loading || aiOnline === null}
            className="ml-auto text-[10px] text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors disabled:opacity-50"
            title="Regenerate insights"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Refresh'}
          </button>
        )}
      </div>

      <div className={cn('grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>
        {/* Intent */}
        <TagTile
          icon={Target}
          label="Intent"
          value={tags.intent}
          compact={compact}
        />

        {/* Service */}
        {tags.service && (
          <TagTile
            icon={ShoppingBag}
            label="Service"
            value={tags.service}
            compact={compact}
          />
        )}

        {/* Objection */}
        {tags.objection !== 'none' && (
          <TagTile
            icon={ShieldAlert}
            label="Objection"
            value={tags.objection}
            compact={compact}
          />
        )}

        {/* Urgency */}
        <div className={cn(
          'rounded-lg px-2.5 py-2',
          urgencyColors[tags.urgency] ?? 'bg-[var(--brand-bg)]',
        )}>
          <div className="flex items-center gap-1.5">
            <Flame className="h-3 w-3" />
            <span className="text-[10px] font-medium uppercase tracking-wider opacity-70">Urgency</span>
          </div>
          <p className={cn('font-semibold capitalize', compact ? 'text-xs mt-0.5' : 'text-sm mt-1')}>
            {tags.urgency}
          </p>
        </div>

        {/* Outcome */}
        <div className={cn(
          'rounded-lg px-2.5 py-2',
          outcomeColors[tags.outcome] ?? 'bg-[var(--brand-bg)]',
        )}>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3" />
            <span className="text-[10px] font-medium uppercase tracking-wider opacity-70">Outcome</span>
          </div>
          <p className={cn('font-semibold capitalize', compact ? 'text-xs mt-0.5' : 'text-sm mt-1')}>
            {tags.outcome}
          </p>
        </div>

        {/* Lead confidence */}
        <div className="rounded-lg bg-[var(--brand-bg)] px-2.5 py-2">
          <div className="flex items-center gap-1.5">
            <Gauge className="h-3 w-3 text-[var(--brand-muted)]" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--brand-muted)]">Confidence</span>
          </div>
          <p className={cn('font-semibold text-[var(--brand-text)] tabular-nums', compact ? 'text-xs mt-0.5' : 'text-sm mt-1')}>
            {Math.round(tags.lead_confidence * 100)}%
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Tag tile sub-component ───────────────────────────────────────────────────

function TagTile({
  icon: Icon,
  label,
  value,
  compact,
}: {
  icon: React.ElementType
  label: string
  value: string
  compact?: boolean
}) {
  return (
    <div className="rounded-lg bg-[var(--brand-bg)] px-2.5 py-2">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-[var(--brand-muted)]" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--brand-muted)]">{label}</span>
      </div>
      <p className={cn(
        'font-semibold text-[var(--brand-text)] capitalize',
        compact ? 'text-xs mt-0.5' : 'text-sm mt-1',
      )}>
        {value}
      </p>
    </div>
  )
}
