'use client'

import { useState, useEffect } from 'react'
import { Power, AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  AI_OPERATING_MODE_LABELS,
  AI_FALLBACK_MODE_LABELS,
  AI_EFFECTIVE_STATUS_COLORS,
  AI_EFFECTIVE_STATUS_LABELS,
} from '@/lib/ai-control/types'
import { formatAutoResume } from '@/lib/ai-control/effective-status'
import type { AiControlWatchlistRow, AiEffectiveStatus } from '@/lib/ai-control/types'

// ── Types ───────────────────────────────────────────────────────────────────

interface WatchlistSummary {
  total: number
  active: number
  paused: number
  partial: number
  maintenance: number
}

// ── Status pill ─────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: AiEffectiveStatus }) {
  const colors = AI_EFFECTIVE_STATUS_COLORS[status]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', colors.bg, colors.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', colors.dot)} />
      {AI_EFFECTIVE_STATUS_LABELS[status]}
    </span>
  )
}

// ── KPI chip ────────────────────────────────────────────────────────────────

function KpiChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={cn('h-2 w-2 rounded-full', color)} />
      <span className="text-[var(--brand-muted)]">{label}</span>
      <span className="font-semibold text-[var(--brand-text)] tabular-nums">{value}</span>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export function OpsAiControlWatchlist() {
  const [rows, setRows] = useState<AiControlWatchlistRow[]>([])
  const [summary, setSummary] = useState<WatchlistSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/ops/ai-control')
      .then((r) => r.json())
      .then((data) => {
        if (data.rows) {
          setRows(data.rows)
          setSummary(data.summary)
        }
      })
      .catch(() => {
        // Graceful — show empty state
      })
      .finally(() => setLoading(false))
  }, [])

  const nonActiveRows = rows.filter((r) => r.effectiveStatus !== 'active')

  return (
    <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--brand-border)]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950/30">
            <Power className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--brand-text)]">AI System Status</h3>
            <p className="text-[10px] text-[var(--brand-muted)]">Cross-tenant AI control watchlist</p>
          </div>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-[var(--brand-muted)]" />}
      </div>

      {/* Summary KPIs */}
      {summary && (
        <div className="flex flex-wrap items-center gap-4 px-5 py-2.5 border-b border-[var(--brand-border)] bg-[var(--brand-bg)]/50">
          <KpiChip label="Active" value={summary.active} color="bg-emerald-500" />
          <KpiChip label="Paused" value={summary.paused} color="bg-amber-500" />
          <KpiChip label="Partial" value={summary.partial} color="bg-blue-500" />
          <KpiChip label="Maintenance" value={summary.maintenance} color="bg-orange-500" />
        </div>
      )}

      {/* Watchlist rows — only show non-active clients */}
      <div className="divide-y divide-[var(--brand-border)]">
        {loading ? (
          <div className="px-5 py-8 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-muted)] mx-auto" />
            <p className="text-xs text-[var(--brand-muted)] mt-2">Loading AI status...</p>
          </div>
        ) : nonActiveRows.length === 0 ? (
          <div className="px-5 py-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30 mx-auto mb-2">
              <Power className="h-5 w-5 text-emerald-500" />
            </div>
            <p className="text-xs font-medium text-[var(--brand-text)]">All systems active</p>
            <p className="text-[10px] text-[var(--brand-muted)] mt-0.5">
              All {summary?.total ?? 0} clients have AI enabled and running.
            </p>
          </div>
        ) : (
          nonActiveRows.map((row) => (
            <div key={row.clientId} className="flex items-center justify-between px-5 py-3 hover:bg-[var(--brand-border)]/10 transition-colors">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[var(--brand-text)] truncate">{row.clientName}</p>
                  <StatusPill status={row.effectiveStatus} />
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[10px] text-[var(--brand-muted)]">
                    Mode: {AI_OPERATING_MODE_LABELS[row.controlState.ai_operating_mode]}
                  </span>
                  <span className="text-[10px] text-[var(--brand-muted)]">
                    Fallback: {AI_FALLBACK_MODE_LABELS[row.controlState.ai_fallback_mode]}
                  </span>
                  {row.controlState.ai_auto_resume_at && (
                    <span className="text-[10px] text-violet-600 dark:text-violet-400">
                      Resume {formatAutoResume(row.controlState.ai_auto_resume_at)}
                    </span>
                  )}
                </div>
                {row.controlState.ai_pause_note && (
                  <p className="text-[10px] text-[var(--brand-muted)] mt-0.5 truncate max-w-xs italic">
                    &ldquo;{row.controlState.ai_pause_note}&rdquo;
                  </p>
                )}
              </div>
              <a
                href={`/dashboard?tenant=${row.clientSlug}`}
                className="shrink-0 ml-3 text-[10px] text-[var(--brand-primary)] hover:underline"
              >
                View
              </a>
            </div>
          ))
        )}
      </div>

      {/* Footer with warning if any paused */}
      {nonActiveRows.length > 0 && (
        <div className="flex items-center gap-2 px-5 py-2.5 border-t border-[var(--brand-border)] bg-amber-50/50 dark:bg-amber-950/10">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <p className="text-[10px] text-amber-700 dark:text-amber-400">
            {nonActiveRows.length} client{nonActiveRows.length !== 1 ? 's' : ''} with non-active AI status
          </p>
        </div>
      )}
    </div>
  )
}
