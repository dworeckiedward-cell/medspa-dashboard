'use client'

import { useState, useEffect } from 'react'
import { Gauge, ExternalLink, AlertTriangle, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getUsageStatusConfig } from '@/lib/billing/usage'
import type { UsageStatus } from '@/lib/billing/types'

// ── Types (matches /api/ops/usage response) ─────────────────────────────────

interface TenantUsageRow {
  tenantId: string
  tenantName: string
  tenantSlug: string
  summary: {
    overallStatus: UsageStatus
    isMeteringConnected: boolean
    confidence: 'exact' | 'derived' | 'estimated'
    allowances: Array<{
      metricLabel: string
      usagePercent: number
      usageConsumed: number
      allowanceIncluded: number
      overageUnits: number
      status: UsageStatus
    }>
  }
}

interface UsageStats {
  totalTenants: number
  nearLimit: number
  overLimit: number
}

// ── Component ───────────────────────────────────────────────────────────────

export function OpsUsageWatchlist() {
  const [overviews, setOverviews] = useState<TenantUsageRow[]>([])
  const [stats, setStats] = useState<UsageStats>({ totalTenants: 0, nearLimit: 0, overLimit: 0 })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'near' | 'over'>('all')

  useEffect(() => {
    async function fetchUsage() {
      try {
        const res = await fetch('/api/ops/usage?minPercent=0&limit=50')
        if (!res.ok) return
        const data = await res.json()
        setOverviews(data.overviews ?? [])
        setStats(data.stats ?? { totalTenants: 0, nearLimit: 0, overLimit: 0 })
      } catch {
        // Silent fail — ops component should not crash page
      } finally {
        setLoading(false)
      }
    }
    fetchUsage()
  }, [])

  const filtered = overviews.filter((o) => {
    const percent = o.summary.allowances[0]?.usagePercent ?? 0
    if (filter === 'near') return percent >= 80 && percent < 100
    if (filter === 'over') return percent >= 100
    return true
  })

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge className="h-4 w-4 text-[var(--brand-muted)]" />
            Usage Watchlist
          </CardTitle>
          <div className="flex items-center gap-2 text-[10px]">
            <KpiBadge
              label="Near Limit"
              count={stats.nearLimit}
              color="amber"
            />
            <KpiBadge
              label="Over Limit"
              count={stats.overLimit}
              color="rose"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Filter chips */}
        <div className="flex gap-1.5 mb-3">
          {[
            { key: 'all' as const, label: `All (${overviews.length})` },
            { key: 'near' as const, label: `Near Limit (${stats.nearLimit})` },
            { key: 'over' as const, label: `Over Limit (${stats.overLimit})` },
          ].map((chip) => (
            <button
              key={chip.key}
              onClick={() => setFilter(chip.key)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors',
                filter === chip.key
                  ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border border-[var(--brand-primary)]/20'
                  : 'bg-[var(--brand-bg)] text-[var(--brand-muted)] border border-[var(--brand-border)] hover:text-[var(--brand-text)]',
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-[var(--brand-border)]/30 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-6">
            <p className="text-xs text-[var(--brand-muted)]">
              {filter === 'all'
                ? 'No usage data available'
                : `No tenants ${filter === 'near' ? 'near limit' : 'over limit'}`}
            </p>
          </div>
        )}

        {/* Tenant rows */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
            {filtered.map((tenant) => (
              <TenantUsageRow key={tenant.tenantId} tenant={tenant} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Tenant row ──────────────────────────────────────────────────────────────

function TenantUsageRow({ tenant }: { tenant: TenantUsageRow }) {
  const primary = tenant.summary.allowances[0]
  if (!primary) return null

  const percent = primary.usagePercent
  const status = primary.status
  const config = getUsageStatusConfig(status)

  const barColor =
    status === 'overage'
      ? 'bg-rose-500'
      : status === 'limit_reached'
        ? 'bg-orange-500'
        : status === 'high_usage'
          ? 'bg-amber-500'
          : 'bg-emerald-500'

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-3 py-2.5 hover:border-[var(--brand-primary)]/30 transition-colors">
      {/* Status icon */}
      <div className="shrink-0">
        {status === 'overage' || status === 'limit_reached' ? (
          <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
        ) : status === 'high_usage' ? (
          <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
        ) : (
          <Gauge className="h-3.5 w-3.5 text-emerald-500" />
        )}
      </div>

      {/* Tenant info + bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-[var(--brand-text)] truncate">
            {tenant.tenantName}
          </span>
          <span className={cn('text-[10px] font-medium tabular-nums', config.textClass)}>
            {percent}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--brand-border)] overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-300', barColor)}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[9px] text-[var(--brand-muted)]">
            {primary.usageConsumed.toLocaleString()} / {primary.allowanceIncluded.toLocaleString()} {primary.metricLabel}
          </span>
          {!tenant.summary.isMeteringConnected && (
            <span className="text-[8px] text-[var(--brand-muted)] italic">estimated</span>
          )}
        </div>
      </div>

      {/* Quick link */}
      <a
        href={`/ops/support/${tenant.tenantSlug}`}
        className="shrink-0 p-1 rounded text-[var(--brand-muted)] hover:text-[var(--brand-primary)] transition-colors"
        title={`View ${tenant.tenantName}`}
      >
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  )
}

// ── KPI badge ───────────────────────────────────────────────────────────────

function KpiBadge({ label, count, color }: { label: string; count: number; color: 'amber' | 'rose' }) {
  const classes = color === 'amber'
    ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
    : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400'

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium', classes)}>
      <span className="tabular-nums">{count}</span>
      <span className="opacity-70">{label}</span>
    </span>
  )
}
