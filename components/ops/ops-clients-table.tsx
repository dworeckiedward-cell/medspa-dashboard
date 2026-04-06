'use client'

import { useState, useMemo, useCallback, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ArrowUpDown, ChevronDown } from 'lucide-react'
import { cn, polish } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { getHealthBadgeStyle, type HealthLevel } from '@/lib/ops/health-score'
import type { ClientOverview } from '@/lib/ops/query'
import type { ClientHealthScore } from '@/lib/ops/health-score'
import type { ClientUnitEconomics } from '@/lib/ops/unit-economics/types'
import type { ClientCommercialSnapshot } from '@/lib/ops-financials/types'
import { OpsClientDetailPopup } from './ops-client-detail-popup'

// ── Types ────────────────────────────────────────────────────────────────────

interface OpsClientsTableProps {
  overviews: ClientOverview[]
  healthScores: Map<string, ClientHealthScore>
  unitEconomics?: ClientUnitEconomics[]
  commercialSnapshots?: ClientCommercialSnapshot[]
  onUnitEconomicsRefresh?: () => void
}

type SortKey = 'name' | 'status' | 'cac' | 'setupFee' | 'retainer' | 'ltv'
type SortDir = 'asc' | 'desc'

const STATUS_OPTIONS: { value: HealthLevel; label: string }[] = [
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'healthy', label: 'Healthy' },
  { value: 'watch', label: 'Watch' },
  { value: 'critical', label: 'Critical' },
]

// ── Component ────────────────────────────────────────────────────────────────

export function OpsClientsTable({
  overviews,
  healthScores,
  unitEconomics,
  commercialSnapshots,
  onUnitEconomicsRefresh,
}: OpsClientsTableProps) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [inspectingClientId, setInspectingClientId] = useState<string | null>(null)

  const economicsMap = useMemo(() => {
    const map = new Map<string, ClientUnitEconomics>()
    if (unitEconomics) {
      for (const e of unitEconomics) map.set(e.clientId, e)
    }
    return map
  }, [unitEconomics])

  const snapshotMap = useMemo(() => {
    const map = new Map<string, ClientCommercialSnapshot>()
    if (commercialSnapshots) {
      for (const s of commercialSnapshots) map.set(s.clientId, s)
    }
    return map
  }, [commercialSnapshots])

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

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (o) =>
          o.client.name.toLowerCase().includes(q) ||
          o.client.slug.toLowerCase().includes(q),
      )
    }

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
          cmp = healthOrder[ha?.level ?? 'healthy'] - healthOrder[hb?.level ?? 'healthy']
          break
        case 'cac':
          cmp = (ea?.cacAmount ?? -1) - (eb?.cacAmount ?? -1)
          break
        case 'setupFee':
          cmp = (sa?.setupFeeAmount ?? -1) - (sb?.setupFeeAmount ?? -1)
          break
        case 'retainer':
          cmp = (sa?.retainerAmount ?? -1) - (sb?.retainerAmount ?? -1)
          break
        case 'ltv':
          cmp = (ea?.totalCollectedLtv ?? 0) - (eb?.totalCollectedLtv ?? 0)
          break
      }

      return sortDir === 'desc' ? -cmp : cmp
    })

    return result
  }, [overviews, healthScores, economicsMap, snapshotMap, search, sortKey, sortDir])

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--brand-muted)]" />
        <Input
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[var(--brand-border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--brand-border)] bg-[var(--brand-surface)]">
                <SortHeader label="Client" sortKey="name" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <th className="px-4 py-2.5 text-xs font-medium text-[var(--brand-muted)] text-center w-16">Active</th>
                <SortHeader label="Status" sortKey="status" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortHeader label="CAC" sortKey="cac" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                <SortHeader label="Setup Fee" sortKey="setupFee" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                <SortHeader label="Retainer" sortKey="retainer" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                <SortHeader label="LTV" sortKey="ltv" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--brand-border)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-[var(--brand-muted)]">
                    {search ? 'No clients match your search' : 'No clients found'}
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
                    onInspect={(id) => setInspectingClientId(id)}
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

      {/* Client detail popup */}
      {inspectingClientId && (
        <OpsClientDetailPopup
          open={!!inspectingClientId}
          onClose={() => setInspectingClientId(null)}
          overview={overviews.find((o) => o.client.id === inspectingClientId) ?? null}
          health={healthScores.get(inspectingClientId)}
          economics={economicsMap.get(inspectingClientId)}
          snapshot={snapshotMap.get(inspectingClientId)}
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

// ── Inline editable money cell ────────────────────────────────────────────────

function InlineMoneyCell({
  value: propValue,
  suffix,
  clientId,
  field,
  apiPath,
}: {
  value: number | null | undefined
  suffix?: string
  clientId: string
  field: string
  apiPath: string
}) {
  const router = useRouter()
  const [localValue, setLocalValue] = useState<number | null | undefined>(propValue)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasUserEdited = useRef(false)

  // Sync from prop only if user hasn't edited this field
  useEffect(() => {
    if (!hasUserEdited.current) {
      setLocalValue(propValue)
    }
  }, [propValue])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDraft(localValue != null ? String(localValue) : '')
    setEditing(true)
  }

  const save = async () => {
    const num = draft.trim() === '' ? null : parseFloat(draft)
    if (num !== null && isNaN(num)) {
      setEditing(false)
      return
    }

    // Skip if unchanged
    if (num === localValue || (num === null && localValue == null)) {
      setEditing(false)
      return
    }

    hasUserEdited.current = true
    setLocalValue(num)
    setEditing(false)
    setSaving(true)
    try {
      const res = await fetch(apiPath, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: num }),
      })
      if (!res.ok) {
        console.error(`[ops] Save failed for ${field}:`, res.status, await res.text().catch(() => ''))
        setLocalValue(propValue)
        hasUserEdited.current = false
      } else {
        router.refresh()
      }
    } catch (err) {
      console.error(`[ops] Save error for ${field}:`, err)
      setLocalValue(propValue)
      hasUserEdited.current = false
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') setEditing(false)
  }

  if (editing) {
    return (
      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="number"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          disabled={saving}
          className="w-20 text-right text-sm tabular-nums bg-[var(--brand-bg)] border border-[var(--brand-primary)]/40 rounded px-1.5 py-0.5 outline-none focus:border-[var(--brand-primary)]"
        />
      </td>
    )
  }

  return (
    <td className="px-4 py-3 text-right">
      <button
        onClick={startEdit}
        className="text-sm tabular-nums text-[var(--brand-text)] hover:text-[var(--brand-primary)] transition-colors cursor-text"
        title="Click to edit"
      >
        {localValue != null ? `$${Math.round(localValue).toLocaleString()}` : '—'}
        {localValue != null && suffix ? <span className="text-[10px] text-[var(--brand-muted)] ml-0.5">{suffix}</span> : null}
      </button>
    </td>
  )
}

// ── Inline status dropdown ──────────────────────────────────────────────────

function InlineStatusCell({
  health,
  clientId,
}: {
  health?: ClientHealthScore
  clientId: string
}) {
  const badge = getHealthBadgeStyle(health?.level ?? 'healthy')

  // Status is derived from health scoring, not directly editable on client.
  // Show as read-only badge.
  return (
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
  )
}

// ── Active toggle ────────────────────────────────────────────────────────────

function ActiveToggle({ active, clientId }: { active: boolean; clientId: string }) {
  const [value, setValue] = useState(active)
  const [saving, setSaving] = useState(false)

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = !value
    setValue(next)
    setSaving(true)
    try {
      await fetch(`/api/ops/tenants/${clientId}/patch`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: next }),
      })
    } catch {
      setValue(!next) // revert
    } finally {
      setSaving(false)
    }
  }

  return (
    <td className="px-4 py-3 text-center">
      <button
        onClick={toggle}
        disabled={saving}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
          value ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600',
          saving && 'opacity-50',
        )}
        role="switch"
        aria-checked={value}
        title={value ? 'Active' : 'Inactive'}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform',
            value ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </button>
    </td>
  )
}

// ── Client row ───────────────────────────────────────────────────────────────

function ClientRow({
  overview,
  health,
  economics,
  snapshot,
  onInspect,
}: {
  overview: ClientOverview
  health?: ClientHealthScore
  economics?: ClientUnitEconomics
  snapshot?: ClientCommercialSnapshot
  onInspect: (clientId: string) => void
}) {
  const { client } = overview

  return (
    <tr
      className="hover:bg-[var(--brand-surface)]/50 transition-colors cursor-pointer"
      onClick={() => onInspect(client.id)}
    >
      {/* Client name + logo + slug */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg overflow-hidden text-xs font-bold"
            style={{
              background: client.logo_url ? '#ffffff' : (client.brand_color ?? '#2563EB'),
              color: client.logo_url ? undefined : '#ffffff',
            }}
          >
            {client.logo_url ? (
              <img
                src={client.logo_url}
                alt={client.name}
                className="h-full w-full object-contain"
              />
            ) : (
              client.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--brand-text)] truncate">
              {client.name}
            </p>
            <p className="text-[10px] text-[var(--brand-muted)]">{client.slug}</p>
          </div>
        </div>
      </td>

      {/* Active toggle */}
      <ActiveToggle active={client.is_active} clientId={client.id} />

      {/* Status */}
      <InlineStatusCell health={health} clientId={client.id} />

      {/* CAC */}
      <InlineMoneyCell
        value={economics?.cacAmount}
        clientId={client.id}
        field="cacUsd"
        apiPath={`/api/ops/unit-economics/${client.id}`}
      />

      {/* Setup Fee */}
      <InlineMoneyCell
        value={snapshot?.setupFeeAmount}
        clientId={client.id}
        field="setupFeeAmount"
        apiPath={`/api/ops/financials/${client.id}`}
      />

      {/* Retainer */}
      <InlineMoneyCell
        value={snapshot?.retainerAmount}
        suffix="/mo"
        clientId={client.id}
        field="retainerAmount"
        apiPath={`/api/ops/financials/${client.id}`}
      />

      {/* LTV */}
      <InlineMoneyCell
        value={economics?.ltvMode === 'manual' && economics?.manualLtvUsd != null ? economics.manualLtvUsd : economics?.totalCollectedLtv}
        clientId={client.id}
        field="ltvUsd"
        apiPath={`/api/ops/unit-economics/${client.id}`}
      />
    </tr>
  )
}
