'use client'

import { useState, useMemo } from 'react'
import { Search, ArrowUpDown, ExternalLink, BarChart3, Plug, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { getHealthBadgeStyle, type HealthLevel } from '@/lib/ops/health-score'
import type { ClientOverview } from '@/lib/ops/query'
import type { ClientHealthScore } from '@/lib/ops/health-score'

// ── Types ────────────────────────────────────────────────────────────────────

interface OpsClientsTableProps {
  overviews: ClientOverview[]
  healthScores: Map<string, ClientHealthScore>
}

type SortKey = 'name' | 'status' | 'calls' | 'bookings' | 'revenue' | 'lastActivity'
type SortDir = 'asc' | 'desc'

// ── Filter presets ───────────────────────────────────────────────────────────

interface FilterPreset {
  key: string
  label: string
  filter: (o: ClientOverview, h?: ClientHealthScore) => boolean
}

const FILTER_PRESETS: FilterPreset[] = [
  { key: 'all', label: 'All', filter: () => true },
  { key: 'critical', label: 'Critical', filter: (_, h) => h?.level === 'critical' },
  { key: 'watch', label: 'Watch', filter: (_, h) => h?.level === 'watch' },
  { key: 'healthy', label: 'Healthy', filter: (_, h) => h?.level === 'healthy' },
  { key: 'onboarding', label: 'Onboarding', filter: (_, h) => h?.level === 'onboarding' },
  {
    key: 'no-activity',
    label: 'No activity (30d)',
    filter: (o) => o.callStats.totalCalls === 0,
  },
]

// ── Component ────────────────────────────────────────────────────────────────

export function OpsClientsTable({ overviews, healthScores }: OpsClientsTableProps) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('status')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [activeFilter, setActiveFilter] = useState('all')

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtered = useMemo(() => {
    let result = overviews

    // Text search
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (o) =>
          o.client.name.toLowerCase().includes(q) ||
          o.client.slug.toLowerCase().includes(q),
      )
    }

    // Filter preset
    const preset = FILTER_PRESETS.find((p) => p.key === activeFilter)
    if (preset && preset.key !== 'all') {
      result = result.filter((o) => preset.filter(o, healthScores.get(o.client.id)))
    }

    // Sort
    const healthOrder: Record<HealthLevel, number> = {
      critical: 0,
      watch: 1,
      onboarding: 2,
      healthy: 3,
    }

    result = [...result].sort((a, b) => {
      const ha = healthScores.get(a.client.id)
      const hb = healthScores.get(b.client.id)
      let cmp = 0

      switch (sortKey) {
        case 'name':
          cmp = a.client.name.localeCompare(b.client.name)
          break
        case 'status':
          cmp =
            healthOrder[ha?.level ?? 'healthy'] - healthOrder[hb?.level ?? 'healthy']
          break
        case 'calls':
          cmp = a.callStats.totalCalls - b.callStats.totalCalls
          break
        case 'bookings':
          cmp = a.callStats.bookedCalls - b.callStats.bookedCalls
          break
        case 'revenue':
          cmp = a.callStats.totalRevenue - b.callStats.totalRevenue
          break
        case 'lastActivity':
          cmp = (a.callStats.lastCallAt ?? '').localeCompare(
            b.callStats.lastCallAt ?? '',
          )
          break
      }

      return sortDir === 'desc' ? -cmp : cmp
    })

    return result
  }, [overviews, healthScores, search, activeFilter, sortKey, sortDir])

  return (
    <div className="space-y-3">
      {/* Search + filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--brand-muted)]" />
          <Input
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_PRESETS.map((preset) => (
            <button
              key={preset.key}
              onClick={() => setActiveFilter(preset.key)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                activeFilter === preset.key
                  ? 'bg-[var(--brand-primary)] text-white'
                  : 'bg-[var(--brand-surface)] text-[var(--brand-muted)] border border-[var(--brand-border)] hover:text-[var(--brand-text)]',
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[var(--brand-border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--brand-border)] bg-[var(--brand-surface)]">
                <SortHeader label="Client" sortKey="name" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortHeader label="Status" sortKey="status" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortHeader label="Calls" sortKey="calls" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                <SortHeader label="Bookings" sortKey="bookings" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                <SortHeader label="Revenue" sortKey="revenue" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                <th className="px-4 py-2.5 text-xs font-medium text-[var(--brand-muted)] text-center">
                  Integrations
                </th>
                <SortHeader label="Last Activity" sortKey="lastActivity" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <th className="px-4 py-2.5 text-xs font-medium text-[var(--brand-muted)] text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--brand-border)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-[var(--brand-muted)]">
                    {search || activeFilter !== 'all'
                      ? 'No clients match your filter'
                      : 'No active clients found'}
                  </td>
                </tr>
              ) : (
                filtered.map((overview) => (
                  <ClientRow
                    key={overview.client.id}
                    overview={overview}
                    health={healthScores.get(overview.client.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <p className="text-xs text-[var(--brand-muted)]">
        Showing {filtered.length} of {overviews.length} client{overviews.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

// ── Sort header ──────────────────────────────────────────────────────────────

function SortHeader({
  label,
  sortKey: sk,
  current,
  dir,
  onSort,
  className,
}: {
  label: string
  sortKey: SortKey
  current: SortKey
  dir: SortDir
  onSort: (key: SortKey) => void
  className?: string
}) {
  const isActive = current === sk

  return (
    <th className={cn('px-4 py-2.5', className)}>
      <button
        onClick={() => onSort(sk)}
        className={cn(
          'inline-flex items-center gap-1 text-xs font-medium transition-colors',
          isActive ? 'text-[var(--brand-text)]' : 'text-[var(--brand-muted)] hover:text-[var(--brand-text)]',
        )}
      >
        {label}
        <ArrowUpDown className={cn('h-3 w-3', isActive ? 'opacity-100' : 'opacity-40')} />
      </button>
    </th>
  )
}

// ── Client row ───────────────────────────────────────────────────────────────

function ClientRow({
  overview,
  health,
}: {
  overview: ClientOverview
  health?: ClientHealthScore
}) {
  const { client, callStats, integrationsCount, integrationsHealthy } = overview
  const badge = getHealthBadgeStyle(health?.level ?? 'healthy')

  const lastActivity = callStats.lastCallAt
    ? new Date(callStats.lastCallAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : '—'

  return (
    <tr className="hover:bg-[var(--brand-surface)]/50 transition-colors">
      {/* Client name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white text-xs font-bold"
            style={{ background: client.brand_color ?? '#2563EB' }}
          >
            {client.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--brand-text)] truncate">
              {client.name}
            </p>
            <p className="text-[10px] text-[var(--brand-muted)]">{client.slug}</p>
          </div>
        </div>
      </td>

      {/* Status badge */}
      <td className="px-4 py-3">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
            badge.bgClass,
            badge.textClass,
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', badge.dotClass)} />
          {badge.label}
        </span>
      </td>

      {/* Calls */}
      <td className="px-4 py-3 text-right">
        <span className="text-sm tabular-nums text-[var(--brand-text)]">
          {callStats.totalCalls}
        </span>
      </td>

      {/* Bookings */}
      <td className="px-4 py-3 text-right">
        <span className="text-sm tabular-nums text-[var(--brand-text)]">
          {callStats.bookedCalls}
        </span>
        {callStats.totalCalls > 0 && (
          <span className="text-[10px] text-[var(--brand-muted)] ml-1">
            ({callStats.bookingRate}%)
          </span>
        )}
      </td>

      {/* Revenue */}
      <td className="px-4 py-3 text-right">
        <span className="text-sm tabular-nums text-[var(--brand-text)]">
          {callStats.totalRevenue > 0
            ? formatCurrency(callStats.totalRevenue, client.currency)
            : '—'}
        </span>
      </td>

      {/* Integrations */}
      <td className="px-4 py-3 text-center">
        {integrationsCount > 0 ? (
          <span className={cn(
            'text-sm tabular-nums',
            integrationsHealthy === integrationsCount
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-amber-600 dark:text-amber-400',
          )}>
            {integrationsHealthy}/{integrationsCount}
          </span>
        ) : (
          <span className="text-xs text-[var(--brand-muted)]">—</span>
        )}
      </td>

      {/* Last Activity */}
      <td className="px-4 py-3">
        <span className="text-xs text-[var(--brand-muted)]">{lastActivity}</span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <ActionButton
            href={`/dashboard?tenant=${client.slug}&support=true`}
            icon={Eye}
            label="Support view"
          />
          <ActionButton
            href={`/dashboard/reports?tenant=${client.slug}`}
            icon={BarChart3}
            label="Reports"
          />
          <ActionButton
            href={`/dashboard/integrations?tenant=${client.slug}`}
            icon={Plug}
            label="Integrations"
          />
          <ActionButton
            href={`/dashboard?tenant=${client.slug}`}
            icon={ExternalLink}
            label="Dashboard"
          />
        </div>
      </td>
    </tr>
  )
}

function ActionButton({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: React.ElementType
  label: string
}) {
  return (
    <a
      href={href}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-border)]/40 transition-colors"
      aria-label={label}
      title={label}
    >
      <Icon className="h-3.5 w-3.5" />
    </a>
  )
}
