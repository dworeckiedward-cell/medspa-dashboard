'use client'

import { useState, useMemo } from 'react'
import { Search, ArrowUpDown, ExternalLink, BarChart3, Plug, Eye, Pencil, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { getHealthBadgeStyle, type HealthLevel } from '@/lib/ops/health-score'
import {
  PAYBACK_STATUS_LABELS,
  PAYBACK_STATUS_COLORS,
  LTV_CONFIDENCE_LABELS,
  CAC_SOURCE_LABELS,
  CAC_SOURCE_COLORS,
} from '@/lib/ops/unit-economics/types'
import {
  SETUP_FEE_STATUS_LABELS,
  SETUP_FEE_STATUS_COLORS,
  RETAINER_STATUS_LABELS,
  RETAINER_STATUS_COLORS,
} from '@/lib/ops-financials/types'
import type { ClientCommercialSnapshot, SetupFeeStatus, RetainerStatus } from '@/lib/ops-financials/types'
import { formatMoneyCompact, formatLastPaidLabel } from '@/lib/ops-financials/format'
import { CacEditDialog } from './cac-edit-dialog'
import type { ClientOverview } from '@/lib/ops/query'
import type { ClientHealthScore } from '@/lib/ops/health-score'
import type { ClientUnitEconomics } from '@/lib/ops/unit-economics/types'

// ── Types ────────────────────────────────────────────────────────────────────

interface OpsClientsTableProps {
  overviews: ClientOverview[]
  healthScores: Map<string, ClientHealthScore>
  unitEconomics?: ClientUnitEconomics[]
  commercialSnapshots?: ClientCommercialSnapshot[]
  onUnitEconomicsRefresh?: () => void
}

type SortKey = 'name' | 'status' | 'calls' | 'bookings' | 'revenue' | 'lastActivity' | 'cac' | 'ltv' | 'ltvCac' | 'retainer' | 'lastPaid'
type SortDir = 'asc' | 'desc'

// ── Filter presets ───────────────────────────────────────────────────────────

interface FilterPreset {
  key: string
  label: string
  filter: (o: ClientOverview, h?: ClientHealthScore, e?: ClientUnitEconomics) => boolean
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
  {
    key: 'no-cac',
    label: 'No CAC',
    filter: (_o, _h, e) => !e || e.cacAmount === null,
  },
  {
    key: 'not-recovered',
    label: 'Not recovered',
    filter: (_o, _h, e) => e?.paybackStatus === 'not_recovered',
  },
  {
    key: 'overdue',
    label: 'Overdue',
    filter: () => true, // Handled specially via snapshotMap
  },
  {
    key: 'unpaid-setup',
    label: 'Unpaid setup',
    filter: () => true, // Handled specially via snapshotMap
  },
]

// ── Component ────────────────────────────────────────────────────────────────

export function OpsClientsTable({ overviews, healthScores, unitEconomics, commercialSnapshots, onUnitEconomicsRefresh }: OpsClientsTableProps) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('status')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [activeFilter, setActiveFilter] = useState('all')
  const [editingClient, setEditingClient] = useState<ClientUnitEconomics | null>(null)

  // Build economics map for fast lookup
  const economicsMap = useMemo(() => {
    const map = new Map<string, ClientUnitEconomics>()
    if (unitEconomics) {
      for (const e of unitEconomics) map.set(e.clientId, e)
    }
    return map
  }, [unitEconomics])

  // Build commercial snapshot map
  const snapshotMap = useMemo(() => {
    const map = new Map<string, ClientCommercialSnapshot>()
    if (commercialSnapshots) {
      for (const s of commercialSnapshots) map.set(s.clientId, s)
    }
    return map
  }, [commercialSnapshots])

  const hasEconomics = unitEconomics && unitEconomics.length > 0
  const hasFinancials = commercialSnapshots && commercialSnapshots.length > 0

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
      if (preset.key === 'overdue') {
        result = result.filter((o) => snapshotMap.get(o.client.id)?.retainerStatus === 'overdue')
      } else if (preset.key === 'unpaid-setup') {
        result = result.filter((o) => snapshotMap.get(o.client.id)?.setupFeeStatus === 'unpaid')
      } else {
        result = result.filter((o) =>
          preset.filter(o, healthScores.get(o.client.id), economicsMap.get(o.client.id)),
        )
      }
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
      const ea = economicsMap.get(a.client.id)
      const eb = economicsMap.get(b.client.id)
      const sa = snapshotMap.get(a.client.id)
      const sb = snapshotMap.get(b.client.id)
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
        case 'cac':
          cmp = (ea?.cacAmount ?? -1) - (eb?.cacAmount ?? -1)
          break
        case 'ltv':
          cmp = (ea?.totalCollectedLtv ?? 0) - (eb?.totalCollectedLtv ?? 0)
          break
        case 'ltvCac':
          cmp = (ea?.paybackRatio ?? -1) - (eb?.paybackRatio ?? -1)
          break
        case 'retainer':
          cmp = (sa?.retainerAmount ?? -1) - (sb?.retainerAmount ?? -1)
          break
        case 'lastPaid':
          cmp = (sa?.lastPaidAt ?? '').localeCompare(sb?.lastPaidAt ?? '')
          break
      }

      return sortDir === 'desc' ? -cmp : cmp
    })

    return result
  }, [overviews, healthScores, economicsMap, snapshotMap, search, activeFilter, sortKey, sortDir])

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
      <div className="rounded-2xl border border-[var(--brand-border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--brand-border)] bg-[var(--brand-surface)]">
                <SortHeader label="Client" sortKey="name" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortHeader label="Status" sortKey="status" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortHeader label="Calls" sortKey="calls" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                <SortHeader label="Bookings" sortKey="bookings" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                <SortHeader label="Revenue" sortKey="revenue" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                {hasEconomics && (
                  <>
                    <SortHeader label="CAC" sortKey="cac" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                    <SortHeader label="LTV" sortKey="ltv" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                    <SortHeader label="LTV:CAC" sortKey="ltvCac" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                    <th className="px-4 py-2.5 text-xs font-medium text-[var(--brand-muted)] text-center">
                      Payback
                    </th>
                  </>
                )}
                {hasFinancials && (
                  <>
                    <th className="px-4 py-2.5 text-xs font-medium text-[var(--brand-muted)] text-center">
                      Setup Fee
                    </th>
                    <SortHeader label="Retainer" sortKey="retainer" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                    <SortHeader label="Last Paid" sortKey="lastPaid" current={sortKey} dir={sortDir} onSort={toggleSort} />
                    <th className="px-4 py-2.5 text-xs font-medium text-[var(--brand-muted)] text-center">
                      MRR
                    </th>
                  </>
                )}
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
                  <td colSpan={99} className="px-4 py-12 text-center text-sm text-[var(--brand-muted)]">
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
                    economics={economicsMap.get(overview.client.id)}
                    snapshot={snapshotMap.get(overview.client.id)}
                    showEconomics={!!hasEconomics}
                    showFinancials={!!hasFinancials}
                    onEditCac={(e) => setEditingClient(e)}
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

      {/* CAC edit dialog */}
      {editingClient && (
        <CacEditDialog
          open={!!editingClient}
          onOpenChange={(open) => { if (!open) setEditingClient(null) }}
          clientEconomics={editingClient}
          onSaved={() => {
            setEditingClient(null)
            onUnitEconomicsRefresh?.()
          }}
        />
      )}
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
  economics,
  snapshot,
  showEconomics,
  showFinancials,
  onEditCac,
}: {
  overview: ClientOverview
  health?: ClientHealthScore
  economics?: ClientUnitEconomics
  snapshot?: ClientCommercialSnapshot
  showEconomics: boolean
  showFinancials: boolean
  onEditCac: (e: ClientUnitEconomics) => void
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
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] text-[var(--brand-muted)]">{client.slug}</p>
              {economics?.cacSource && (
                <span
                  className="inline-flex items-center gap-0.5 text-[9px] font-medium rounded px-1 py-0.5"
                  style={{
                    backgroundColor: `${CAC_SOURCE_COLORS[economics.cacSource]}15`,
                    color: CAC_SOURCE_COLORS[economics.cacSource],
                  }}
                >
                  {CAC_SOURCE_LABELS[economics.cacSource]}
                </span>
              )}
            </div>
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

      {/* Unit economics columns (only when data exists) */}
      {showEconomics && (
        <>
          {/* CAC */}
          <td className="px-4 py-3 text-right">
            {economics?.cacAmount !== null && economics?.cacAmount !== undefined ? (
              <span className="text-sm tabular-nums text-[var(--brand-text)]">
                ${Math.round(economics.cacAmount).toLocaleString()}
              </span>
            ) : (
              <button
                onClick={() => economics && onEditCac(economics)}
                className="text-[10px] text-[var(--brand-muted)] hover:text-[var(--brand-primary)] transition-colors"
                title="Set CAC"
              >
                + Set
              </button>
            )}
          </td>

          {/* LTV */}
          <td className="px-4 py-3 text-right">
            <div>
              <span className="text-sm tabular-nums text-[var(--brand-text)]">
                ${Math.round(economics?.totalCollectedLtv ?? 0).toLocaleString()}
              </span>
              {economics && (
                <span className={cn(
                  'block text-[9px]',
                  economics.ltvConfidence === 'exact'
                    ? 'text-emerald-500'
                    : economics.ltvConfidence === 'derived'
                      ? 'text-blue-500'
                      : 'text-[var(--brand-muted)]',
                )}>
                  {LTV_CONFIDENCE_LABELS[economics.ltvConfidence]}
                </span>
              )}
            </div>
          </td>

          {/* LTV:CAC ratio */}
          <td className="px-4 py-3 text-right">
            {economics?.paybackRatio !== null && economics?.paybackRatio !== undefined ? (
              <span className={cn(
                'text-sm tabular-nums font-semibold',
                economics.paybackRatio >= 3
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : economics.paybackRatio >= 1
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-red-600 dark:text-red-400',
              )}>
                {economics.paybackRatio}x
              </span>
            ) : (
              <span className="text-xs text-[var(--brand-muted)]">—</span>
            )}
          </td>

          {/* Payback status */}
          <td className="px-4 py-3 text-center">
            {economics && (
              <span className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                PAYBACK_STATUS_COLORS[economics.paybackStatus].bg,
                PAYBACK_STATUS_COLORS[economics.paybackStatus].text,
              )}>
                {PAYBACK_STATUS_LABELS[economics.paybackStatus]}
              </span>
            )}
          </td>
        </>
      )}

      {/* Billing columns (only when financial data exists) */}
      {showFinancials && (
        <>
          {/* Setup Fee status */}
          <td className="px-4 py-3 text-center">
            {snapshot ? (
              <BillingBadge
                label={SETUP_FEE_STATUS_LABELS[snapshot.setupFeeStatus]}
                colors={SETUP_FEE_STATUS_COLORS[snapshot.setupFeeStatus]}
              />
            ) : (
              <span className="text-xs text-[var(--brand-muted)]">—</span>
            )}
          </td>

          {/* Retainer amount + status */}
          <td className="px-4 py-3 text-right">
            {snapshot && snapshot.retainerAmount ? (
              <div>
                <span className="text-sm tabular-nums text-[var(--brand-text)]">
                  {formatMoneyCompact(snapshot.retainerAmount)}
                </span>
                <span className="block mt-0.5">
                  <BillingBadge
                    label={RETAINER_STATUS_LABELS[snapshot.retainerStatus]}
                    colors={RETAINER_STATUS_COLORS[snapshot.retainerStatus]}
                  />
                </span>
              </div>
            ) : (
              <span className="text-xs text-[var(--brand-muted)]">—</span>
            )}
          </td>

          {/* Last Paid */}
          <td className="px-4 py-3">
            <span className="text-xs text-[var(--brand-muted)]">
              {snapshot ? formatLastPaidLabel(snapshot.lastPaidAt) : '—'}
            </span>
          </td>

          {/* MRR badge */}
          <td className="px-4 py-3 text-center">
            {snapshot ? (
              <span className={cn(
                'inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium',
                snapshot.mrrIncluded
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500',
              )}>
                {snapshot.mrrIncluded ? 'Yes' : 'No'}
              </span>
            ) : (
              <span className="text-xs text-[var(--brand-muted)]">—</span>
            )}
          </td>
        </>
      )}

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
          {economics && (
            <ActionButton
              onClick={() => onEditCac(economics)}
              icon={Pencil}
              label="Edit CAC"
            />
          )}
          <ActionLink
            href={`/ops/clients/${client.id}/financials`}
            icon={DollarSign}
            label="Financials"
          />
          <ActionLink
            href={`/dashboard?tenant=${client.slug}&support=true`}
            icon={Eye}
            label="Support view"
          />
          <ActionLink
            href={`/dashboard/reports?tenant=${client.slug}`}
            icon={BarChart3}
            label="Reports"
          />
          <ActionLink
            href={`/dashboard/integrations?tenant=${client.slug}`}
            icon={Plug}
            label="Integrations"
          />
          <ActionLink
            href={`/dashboard?tenant=${client.slug}`}
            icon={ExternalLink}
            label="Dashboard"
          />
        </div>
      </td>
    </tr>
  )
}

function ActionLink({
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

function ActionButton({
  onClick,
  icon: Icon,
  label,
}: {
  onClick: () => void
  icon: React.ElementType
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-border)]/40 transition-colors"
      aria-label={label}
      title={label}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

function BillingBadge({
  label,
  colors,
}: {
  label: string
  colors: { bg: string; text: string; dot: string }
}) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium', colors.bg, colors.text)}>
      <span className={cn('h-1 w-1 rounded-full', colors.dot)} />
      {label}
    </span>
  )
}
