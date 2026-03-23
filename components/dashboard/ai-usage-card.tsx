'use client'

import { useState } from 'react'
import { AlertTriangle, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildTenantApiUrl } from '@/lib/dashboard/tenant-api'

// ── Circular progress ring ────────────────────────────────────────────────────

const RADIUS = 40
const CIRC = 2 * Math.PI * RADIUS // ≈ 251.33

function ProgressRing({ pct }: { pct: number }) {
  const clamped = Math.min(pct, 100)
  const offset = CIRC * (1 - clamped / 100)

  const strokeColor =
    pct >= 100 ? '#ef4444'    // red
    : pct >= 90 ? '#f59e0b'   // amber
    : '#0d9488'               // teal

  return (
    <svg width="100" height="100" className="rotate-[-90deg]" aria-hidden="true">
      {/* Track */}
      <circle
        cx="50" cy="50" r={RADIUS}
        fill="none"
        stroke="var(--brand-border)"
        strokeWidth="8"
        opacity={0.4}
      />
      {/* Progress */}
      <circle
        cx="50" cy="50" r={RADIUS}
        fill="none"
        stroke={strokeColor}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease' }}
      />
    </svg>
  )
}

// ── Top-up button ─────────────────────────────────────────────────────────────

function TopUpButton({ tenantId, tenantSlug, variant = 'outline' }: { tenantId: string; tenantSlug?: string | null; variant?: 'outline' | 'solid' }) {
  const [loading, setLoading] = useState(false)

  async function handleTopUp() {
    setLoading(true)
    try {
      const res = await fetch(buildTenantApiUrl('/api/billing/top-up', tenantSlug), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      // ignore — page won't redirect
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleTopUp}
      disabled={loading}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 disabled:opacity-60',
        variant === 'solid'
          ? 'bg-rose-500 text-white hover:bg-rose-600'
          : 'border border-[var(--brand-border)] bg-[var(--brand-bg)] text-[var(--brand-text)] hover:border-[var(--brand-primary)]/40 hover:text-[var(--brand-primary)]',
      )}
    >
      <Zap className="h-3 w-3" />
      {loading ? 'Redirecting…' : 'Top Up $50'}
    </button>
  )
}

// ── Main card ─────────────────────────────────────────────────────────────────

export interface AiUsageData {
  costCents: number
  budgetCents: number
  callCount: number
  totalMinutes: number
  tenantId: string
  tenantSlug?: string | null
}

export function AiUsageCard({ data }: { data: AiUsageData }) {
  const { costCents, budgetCents, callCount, totalMinutes, tenantId, tenantSlug } = data
  const pct = budgetCents > 0 ? Math.round((costCents / budgetCents) * 100) : 0
  const isExceeded = pct >= 100
  const isWarning = pct >= 90 && !isExceeded

  const labelColor =
    isExceeded ? 'text-rose-500'
    : isWarning ? 'text-amber-500'
    : 'text-teal-600 dark:text-teal-400'

  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5 space-y-4">
      {/* Exceeded banner */}
      {isExceeded && (
        <div className="flex items-start gap-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">
              AI budget exceeded — calls paused. Top up to continue.
            </p>
          </div>
          <TopUpButton tenantId={tenantId} tenantSlug={tenantSlug} variant="solid" />
        </div>
      )}

      {/* Ring */}
      <div className="flex justify-center">
        <div className="relative">
          <ProgressRing pct={pct} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('text-lg font-bold tabular-nums leading-none', labelColor)}>
              {pct}%
            </span>
            <span className="text-[9px] text-[var(--brand-muted)] leading-tight mt-0.5">used</span>
          </div>
        </div>
      </div>
    </div>
  )
}
