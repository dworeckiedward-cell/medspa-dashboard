'use client'

/**
 * AiFollowupDraft — generate and display SMS follow-up variants.
 *
 * Only shows for calls with human_followup_needed=true.
 * Operator/analyst only: "Generate follow-up draft" button.
 * Displays variant A/B in a collapsible area with Copy buttons.
 */

import { useState, useCallback, useEffect } from 'react'
import {
  MessageSquareText,
  Loader2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFrontDeskMode } from '@/lib/dashboard/front-desk-mode'
import { useAiOnline } from '@/lib/ai/use-ai-online'
import type { CallLog } from '@/types/database'

interface FollowupData {
  variant_a: string
  variant_b: string
  cta: string
}

interface AiFollowupDraftProps {
  callLog: CallLog
  compact?: boolean
}

function extractExistingFollowup(log: CallLog): FollowupData | null {
  const raw = log.raw_payload as Record<string, unknown> | null
  const modules = raw?.ai_modules as Record<string, unknown> | undefined
  const followup = modules?.followup as FollowupData | undefined
  if (followup && typeof followup.variant_a === 'string') return followup
  return null
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text).catch(() => undefined)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-[10px] text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export function AiFollowupDraft({ callLog, compact }: AiFollowupDraftProps) {
  const { mode } = useFrontDeskMode()
  const aiOnline = useAiOnline()
  const [followup, setFollowup] = useState<FollowupData | null>(() => extractExistingFollowup(callLog))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setFollowup(extractExistingFollowup(callLog))
    setError(null)
  }, [callLog])

  const handleGenerate = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/followup-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callLogId: callLog.id }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      setFollowup(data.followup)
      setExpanded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate')
    } finally {
      setLoading(false)
    }
  }, [callLog.id])

  // Only show for follow-up-needed calls
  if (!callLog.human_followup_needed) return null

  // Simple mode: no generation, just show if exists
  if (mode === 'simple' && !followup) return null

  return (
    <div className={cn(
      'rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]',
      compact ? 'p-3' : 'p-4',
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-amber-500" />
          <h3 className={cn('font-semibold text-[var(--brand-text)]', compact ? 'text-xs' : 'text-sm')}>
            Follow-up Draft
          </h3>
        </div>

        {followup && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
      </div>

      {error && (
        <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-2">{error}</p>
      )}

      {!followup && mode !== 'simple' && (
        aiOnline === false ? (
          <p className="mt-2 text-[11px] text-[var(--brand-muted)] italic">AI offline — enable later</p>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={loading || aiOnline === null}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/40 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {loading ? 'Generating…' : 'Generate follow-up draft'}
          </button>
        )
      )}

      {followup && expanded && (
        <div className="mt-3 space-y-3">
          {/* Variant A */}
          <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider">
                Variant A — Warm
              </span>
              <CopyBtn text={followup.variant_a} />
            </div>
            <p className="text-xs text-[var(--brand-text)] leading-relaxed">{followup.variant_a}</p>
          </div>

          {/* Variant B */}
          <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider">
                Variant B — Professional
              </span>
              <CopyBtn text={followup.variant_b} />
            </div>
            <p className="text-xs text-[var(--brand-text)] leading-relaxed">{followup.variant_b}</p>
          </div>

          {/* CTA */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider">
              CTA:
            </span>
            <span className="text-xs font-medium text-[var(--brand-text)]">{followup.cta}</span>
            <CopyBtn text={followup.cta} />
          </div>

          {mode !== 'simple' && aiOnline !== false && (
            <button
              onClick={handleGenerate}
              disabled={loading || aiOnline === null}
              className="text-[10px] text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors disabled:opacity-50"
            >
              {loading ? 'Regenerating…' : 'Regenerate'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
