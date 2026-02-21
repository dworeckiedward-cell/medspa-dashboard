'use client'

import { useState, useMemo } from 'react'
import { Search, ArrowUpDown, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import type { PartnerSummary } from '@/lib/partners/types'
import type { PartnerStatus } from '@/lib/partners/types'

interface PartnersTableProps {
  summaries: PartnerSummary[]
}

type SortKey = 'name' | 'status' | 'referrals' | 'clients' | 'closeRate' | 'payable'
type SortDir = 'asc' | 'desc'

const STATUS_BADGE: Record<PartnerStatus, { label: string; bg: string; text: string; dot: string }> = {
  active: {
    label: 'Active',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  paused: {
    label: 'Paused',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  onboarding: {
    label: 'Onboarding',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    text: 'text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
  blocked: {
    label: 'Blocked',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    text: 'text-rose-700 dark:text-rose-400',
    dot: 'bg-rose-500',
  },
}

const FILTER_PRESETS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'paused', label: 'Paused' },
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'blocked', label: 'Blocked' },
]

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function PartnersTable({ summaries }: PartnersTableProps) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('payable')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [activeFilter, setActiveFilter] = useState('all')

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const filtered = useMemo(() => {
    let result = summaries

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (s) =>
          s.partner.name.toLowerCase().includes(q) ||
          (s.partner.email?.toLowerCase().includes(q) ?? false) ||
          s.partner.referralCode.toLowerCase().includes(q),
      )
    }

    if (activeFilter !== 'all') {
      result = result.filter((s) => s.partner.status === activeFilter)
    }

    const statusOrder: Record<PartnerStatus, number> = {
      active: 0,
      onboarding: 1,
      paused: 2,
      blocked: 3,
    }

    result = [...result].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'name':
          cmp = a.partner.name.localeCompare(b.partner.name)
          break
        case 'status':
          cmp = statusOrder[a.partner.status] - statusOrder[b.partner.status]
          break
        case 'referrals':
          cmp = a.referralCount - b.referralCount
          break
        case 'clients':
          cmp = a.clientCount - b.clientCount
          break
        case 'closeRate':
          cmp = a.closeRate - b.closeRate
          break
        case 'payable':
          cmp = a.payableCommissionCents - b.payableCommissionCents
          break
      }
      return sortDir === 'desc' ? -cmp : cmp
    })

    return result
  }, [summaries, search, activeFilter, sortKey, sortDir])

  return (
    <div className="space-y-3">
      {/* Search + filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--brand-muted)]" />
          <Input
            placeholder="Search partners..."
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
                <SortHeader label="Partner" sortKey="name" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortHeader label="Status" sortKey="status" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <th className="px-4 py-2.5 text-xs font-medium text-[var(--brand-muted)]">Type</th>
                <SortHeader label="Referrals" sortKey="referrals" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                <SortHeader label="Clients" sortKey="clients" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                <SortHeader label="Close Rate" sortKey="closeRate" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                <SortHeader label="Payable" sortKey="payable" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                <th className="px-4 py-2.5 text-xs font-medium text-[var(--brand-muted)] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--brand-border)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-[var(--brand-muted)]">
                    {search || activeFilter !== 'all'
                      ? 'No partners match your filter'
                      : 'No partners found'}
                  </td>
                </tr>
              ) : (
                filtered.map((summary) => (
                  <PartnerRow key={summary.partner.id} summary={summary} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-[var(--brand-muted)]">
        Showing {filtered.length} of {summaries.length} partner{summaries.length !== 1 ? 's' : ''}
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

// ── Partner row ──────────────────────────────────────────────────────────────

function PartnerRow({ summary }: { summary: PartnerSummary }) {
  const { partner } = summary
  const badge = STATUS_BADGE[partner.status]

  return (
    <tr className="hover:bg-[var(--brand-surface)]/50 transition-colors">
      <td className="px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--brand-text)] truncate">
            {partner.name}
          </p>
          <p className="text-[10px] text-[var(--brand-muted)]">
            {partner.email ?? partner.referralCode}
          </p>
        </div>
      </td>

      <td className="px-4 py-3">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
            badge.bg,
            badge.text,
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', badge.dot)} />
          {badge.label}
        </span>
      </td>

      <td className="px-4 py-3">
        <span className="text-xs text-[var(--brand-muted)] capitalize">{partner.type}</span>
      </td>

      <td className="px-4 py-3 text-right">
        <span className="text-sm tabular-nums text-[var(--brand-text)]">{summary.referralCount}</span>
      </td>

      <td className="px-4 py-3 text-right">
        <span className="text-sm tabular-nums text-[var(--brand-text)]">{summary.clientCount}</span>
      </td>

      <td className="px-4 py-3 text-right">
        <span className="text-sm tabular-nums text-[var(--brand-text)]">{summary.closeRate}%</span>
      </td>

      <td className="px-4 py-3 text-right">
        <span className="text-sm tabular-nums text-[var(--brand-text)]">
          {summary.payableCommissionCents > 0 ? formatCents(summary.payableCommissionCents) : '—'}
        </span>
        {summary.paidCommissionCents > 0 && (
          <span className="text-[10px] text-[var(--brand-muted)] ml-1">
            ({formatCents(summary.paidCommissionCents)} paid)
          </span>
        )}
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center justify-end">
          <a
            href={`/ops/partners/${partner.id}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-border)]/40 transition-colors"
            aria-label="View partner"
            title="View partner"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </td>
    </tr>
  )
}
