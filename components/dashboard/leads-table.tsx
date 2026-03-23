'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { formatDistanceToNowStrict, parseISO, isAfter, isBefore, subDays } from 'date-fns'
import {
  Search,
  Users,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Clock,
  Bell,
  Download,
  Link2,
  FileText,
  Phone,
  X,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/dashboard/use-language'
import { LeadDetailDrawer } from './lead-detail-drawer'
import type { Contact, ContactStatus } from '@/lib/types/domain'
import { CONTACT_STATUS_LABELS } from '@/lib/types/domain'

interface LeadsTableProps {
  contacts: Contact[]
  tenantSlug?: string | null
  remainingCallsToday?: number
}

type SortKey = 'lastCallAt' | 'nextActionAt' | 'priorityScore'
type DatePreset = 'today' | '7d' | '30d' | 'all'

// Status badge variant mapping
const statusVariant: Record<ContactStatus, 'success' | 'warning' | 'muted' | 'destructive' | 'brand' | 'accent'> = {
  new: 'brand',
  contacted: 'accent',
  booking_link_sent: 'warning',
  clicked_link: 'accent',
  booked: 'success',
  lost: 'muted',
  interested: 'warning',
  reactivation: 'muted',
  queued: 'muted',
  not_interested: 'destructive',
  followup_needed: 'warning',
  callback: 'warning',
  follow_up_exhausted: 'muted',
}

const SOURCE_LABELS: Record<string, string> = {
  website: 'Website',
  google: 'Google',
  referral: 'Referral',
  instagram: 'Instagram',
  phone: 'Phone',
  'walk-in': 'Walk-in',
}

const ALL_SOURCES = Object.keys(SOURCE_LABELS)

function relativeTime(iso: string | null): string | null {
  if (!iso) return null
  try {
    return formatDistanceToNowStrict(parseISO(iso), { addSuffix: true })
  } catch {
    return null
  }
}

function isOverdue(iso: string | null): boolean {
  if (!iso) return false
  try {
    return isBefore(parseISO(iso), new Date())
  } catch {
    return false
  }
}

function priorityLabel(score: number): { label: string; className: string } {
  if (score >= 80) return { label: 'High', className: 'text-rose-500 dark:text-rose-400' }
  if (score >= 50) return { label: 'Med', className: 'text-amber-500 dark:text-amber-400' }
  return { label: 'Low', className: 'text-[var(--brand-muted)]' }
}

export function LeadsTable({ contacts, tenantSlug, remainingCallsToday = 20 }: LeadsTableProps) {
  const { t } = useLanguage()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterSource, setFilterSource] = useState<string>('all')
  const [filterFollowUp, setFilterFollowUp] = useState(false)
  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [sortKey, setSortKey] = useState<SortKey>('lastCallAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)

  // Batch call selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [callsRemaining, setCallsRemaining] = useState(remainingCallsToday)
  const [batchStatus, setBatchStatus] = useState<'idle' | 'calling' | 'done' | 'error'>('idle')
  const [batchMessage, setBatchMessage] = useState<string | null>(null)

  // Fetch remaining calls on mount
  useEffect(() => {
    fetch('/api/leads/call-batch')
      .then((r) => r.json())
      .then((d: { remaining_today?: number }) => {
        if (typeof d.remaining_today === 'number') setCallsRemaining(d.remaining_today)
      })
      .catch(() => {})
  }, [])

  function toggleSelectId(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllUncontacted() {
    const uncontacted = sorted.filter((c) => c.status === 'new').map((c) => c.id)
    setSelectedIds(new Set(uncontacted))
  }

  function clearSelection() {
    setSelectedIds(new Set())
    setBatchStatus('idle')
    setBatchMessage(null)
  }

  const handleCallBatch = useCallback(async () => {
    if (selectedIds.size === 0 || batchStatus === 'calling') return
    setBatchStatus('calling')
    setBatchMessage(null)
    try {
      const res = await fetch('/api/leads/call-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_ids: Array.from(selectedIds) }),
      })
      const data = (await res.json()) as { count?: number; remaining_today?: number; error?: string }
      if (!res.ok) {
        setBatchStatus('error')
        setBatchMessage(data.error ?? 'Failed to queue calls')
      } else {
        setBatchStatus('done')
        setBatchMessage(`Queued ${data.count} call${data.count === 1 ? '' : 's'}. Emma will call them during business hours.`)
        if (typeof data.remaining_today === 'number') setCallsRemaining(data.remaining_today)
        setTimeout(clearSelection, 4000)
      }
    } catch {
      setBatchStatus('error')
      setBatchMessage('Network error. Please try again.')
    }
  }, [selectedIds, batchStatus])

  const filtered = useMemo(() => {
    const now = new Date()
    return contacts.filter((c) => {
      // Search
      if (search) {
        const q = search.toLowerCase()
        if (
          !c.fullName.toLowerCase().includes(q) &&
          !c.phone.toLowerCase().includes(q) &&
          !(c.email?.toLowerCase().includes(q))
        )
          return false
      }
      // Status
      if (filterStatus !== 'all' && c.status !== filterStatus) return false
      // Source
      if (filterSource !== 'all' && c.source !== filterSource) return false
      // Follow-up only
      if (filterFollowUp && (!c.openFollowUpTasks || c.openFollowUpTasks.length === 0)) return false
      // Date preset
      if (datePreset !== 'all' && c.lastCallAt) {
        const callDate = parseISO(c.lastCallAt)
        if (datePreset === 'today') {
          const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          if (isBefore(callDate, startOfDay)) return false
        } else if (datePreset === '7d') {
          if (isBefore(callDate, subDays(now, 7))) return false
        } else if (datePreset === '30d') {
          if (isBefore(callDate, subDays(now, 30))) return false
        }
      } else if (datePreset !== 'all' && !c.lastCallAt) {
        return false
      }
      return true
    })
  }, [contacts, search, filterStatus, filterSource, filterFollowUp, datePreset])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal: string | number | null
      let bVal: string | number | null
      if (sortKey === 'priorityScore') {
        aVal = a.priorityScore
        bVal = b.priorityScore
        return sortDir === 'asc' ? (aVal - bVal) : (bVal - aVal)
      }
      aVal = a[sortKey]
      bVal = b[sortKey]
      if (aVal === null && bVal === null) return 0
      if (aVal === null) return 1
      if (bVal === null) return -1
      const cmp = (aVal as string).localeCompare(bVal as string)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const hasActiveFilters = search || filterStatus !== 'all' || filterSource !== 'all' || filterFollowUp || datePreset !== 'all'

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  function clearFilters() {
    setSearch('')
    setFilterStatus('all')
    setFilterSource('all')
    setFilterFollowUp(false)
    setDatePreset('all')
  }

  function exportCsv() {
    const rows = sorted
    const header = ['Name', 'Phone', 'Email', 'Status', 'Source', 'Priority', 'Last Call', 'Created']
    const escape = (v: string | null | undefined) => {
      const s = v ?? ''
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = [
      header.join(','),
      ...rows.map((c) => [
        escape(c.fullName),
        escape(c.phone),
        escape(c.email),
        escape(CONTACT_STATUS_LABELS[c.status] ?? c.status),
        escape(c.source),
        String(c.priorityScore),
        escape(c.lastCallAt ? new Date(c.lastCallAt).toLocaleString() : ''),
        escape(c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''),
      ].join(',')),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-30 shrink-0" />
    return sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 opacity-70 shrink-0" />
      : <ArrowDown className="h-3 w-3 opacity-70 shrink-0" />
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>{t.leads.pageTitle}</CardTitle>
              <CardDescription>
                {sorted.length === contacts.length
                  ? `${contacts.length} leads total`
                  : `${sorted.length} of ${contacts.length} leads`}
              </CardDescription>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={exportCsv}
                title="Export CSV"
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--brand-border)] bg-[var(--brand-surface)] px-2.5 py-2 text-xs font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:border-[var(--brand-primary)]/40 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
              <button
                onClick={selectAllUncontacted}
                title="Select all new / uncontacted leads"
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--brand-border)] bg-[var(--brand-surface)] px-2.5 py-2 text-xs font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:border-[var(--brand-primary)]/40 transition-colors"
              >
                <Phone className="h-3.5 w-3.5" />
                Select Uncontacted
              </button>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--brand-muted)]" />
                <Input
                  placeholder={t.leads.search}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 w-48 text-xs"
                />
              </div>

              {/* Status */}
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 w-36 text-xs">
                  <SelectValue placeholder={t.leads.allStatuses} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.leads.allStatuses}</SelectItem>
                  {(Object.keys(CONTACT_STATUS_LABELS) as ContactStatus[])
                    .filter((s) => s !== 'reactivation' && s !== 'queued')
                    .map((s) => (
                      <SelectItem key={s} value={s}>{CONTACT_STATUS_LABELS[s]}</SelectItem>
                    ))}
                </SelectContent>
              </Select>

              {/* Source */}
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger className="h-9 w-32 text-xs">
                  <SelectValue placeholder={t.leads.allSources} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.leads.allSources}</SelectItem>
                  {ALL_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>{SOURCE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Date preset */}
              <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
                <SelectTrigger className="h-9 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.leads.allTime}</SelectItem>
                  <SelectItem value="today">{t.leads.today}</SelectItem>
                  <SelectItem value="7d">{t.leads.last7d}</SelectItem>
                  <SelectItem value="30d">{t.leads.last30d}</SelectItem>
                </SelectContent>
              </Select>

              {/* Follow-up toggle */}
              <button
                onClick={() => setFilterFollowUp((v) => !v)}
                className={cn(
                  'flex items-center gap-1.5 h-9 px-3.5 rounded-lg border text-xs font-medium transition-all duration-150',
                  filterFollowUp
                    ? 'border-[var(--user-accent)] bg-[var(--user-accent-soft)] text-[var(--user-accent)]'
                    : 'border-[var(--brand-border)]/60 text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:border-[var(--brand-border)]',
                )}
              >
                <Bell className="h-3 w-3" />
                {t.leads.needsFollowUp}
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-border)]/50">
                <Users className="h-6 w-6 text-[var(--brand-muted)] opacity-50" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--brand-muted)]">{t.leads.noLeads}</p>
                <p className="text-xs text-[var(--brand-muted)] opacity-60 mt-1">{t.leads.noLeadsHint}</p>
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
                  {t.leads.clearFilters}
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8 pr-0">
                      <input
                        type="checkbox"
                        aria-label="Select all visible"
                        checked={sorted.length > 0 && sorted.every((c) => selectedIds.has(c.id))}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds(new Set(sorted.map((c) => c.id)))
                          else setSelectedIds(new Set())
                        }}
                        className="h-3.5 w-3.5 cursor-pointer accent-[var(--brand-primary)]"
                      />
                    </TableHead>
                    <TableHead className="w-48">{t.leads.colName}</TableHead>
                    <TableHead className="w-24">{t.leads.colStatus}</TableHead>
                    <TableHead className="w-24 hidden sm:table-cell">{t.leads.colSource}</TableHead>
                    <TableHead
                      className="w-36 cursor-pointer select-none hidden sm:table-cell"
                      onClick={() => handleSort('lastCallAt')}
                    >
                      <span className="flex items-center gap-1">
                        {t.leads.colLastContact}
                        <SortIcon col="lastCallAt" />
                      </span>
                    </TableHead>
                    <TableHead
                      className="w-36 cursor-pointer select-none hidden md:table-cell"
                      onClick={() => handleSort('nextActionAt')}
                    >
                      <span className="flex items-center gap-1">
                        {t.leads.colNextAction}
                        <SortIcon col="nextActionAt" />
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((contact) => {
                    const nextOverdue = isOverdue(contact.nextActionAt)
                    const openTaskCount = contact.openFollowUpTasks?.length ?? 0
                    const intent = contact.latestCallSummary?.structuredSummary?.intent

                    return (
                      <TableRow
                        key={contact.id}
                        className={cn('cursor-pointer', selectedIds.has(contact.id) && 'bg-[var(--brand-primary)]/5')}
                        onClick={() => setSelectedContact(contact)}
                      >
                        {/* Checkbox */}
                        <TableCell className="pr-0" onClick={(e) => toggleSelectId(contact.id, e)}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(contact.id)}
                            onChange={() => {}}
                            className="h-3.5 w-3.5 cursor-pointer accent-[var(--brand-primary)]"
                          />
                        </TableCell>

                        {/* Name + intent + notes snippet */}
                        <TableCell>
                          <div className="font-medium text-sm text-[var(--brand-text)] leading-tight">
                            {contact.fullName}
                          </div>
                          <div className="text-xs text-[var(--brand-muted)] mt-0.5">
                            {contact.phone}
                          </div>
                          {intent && (
                            <div className="text-[10px] text-[var(--brand-muted)] opacity-70 mt-0.5 truncate max-w-[160px]">
                              {intent.replace(/_/g, ' ')}
                            </div>
                          )}
                          {contact.notes && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <FileText className="h-2.5 w-2.5 text-[var(--brand-muted)] opacity-50 shrink-0" />
                              <span className="text-[10px] text-[var(--brand-muted)] opacity-60 truncate max-w-[140px]">
                                {contact.notes}
                              </span>
                            </div>
                          )}
                          {/* Mobile-only: last call time */}
                          {contact.lastCallAt && (
                            <div className="text-[10px] text-[var(--brand-muted)] mt-0.5 sm:hidden">
                              {relativeTime(contact.lastCallAt)}
                            </div>
                          )}
                        </TableCell>

                        {/* Status + clicked badge */}
                        <TableCell>
                          <div className="flex flex-col gap-1 items-start">
                            <Badge variant={statusVariant[contact.status]} className="text-xs">
                              {CONTACT_STATUS_LABELS[contact.status]}
                            </Badge>
                            {contact.bookingLinkClickedAt && contact.status !== 'clicked_link' && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--brand-primary)] font-medium">
                                <Link2 className="h-2.5 w-2.5" />
                                Clicked
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Source */}
                        <TableCell className="hidden sm:table-cell">
                          <span className="text-xs text-[var(--brand-muted)]">
                            {SOURCE_LABELS[contact.source] ?? contact.source}
                          </span>
                        </TableCell>

                        {/* Last contact */}
                        <TableCell className="hidden sm:table-cell">
                          <span className="text-xs text-[var(--brand-muted)]">
                            {relativeTime(contact.lastCallAt) ?? '—'}
                          </span>
                        </TableCell>

                        {/* Next action */}
                        <TableCell className="hidden md:table-cell">
                          {contact.nextActionAt ? (
                            <div className="flex items-center gap-1.5">
                              {nextOverdue ? (
                                <AlertTriangle className="h-3 w-3 text-rose-500 shrink-0" />
                              ) : (
                                <Clock className="h-3 w-3 text-[var(--brand-muted)] shrink-0" />
                              )}
                              <span className={cn(
                                'text-xs',
                                nextOverdue
                                  ? 'text-rose-500 dark:text-rose-400 font-medium'
                                  : 'text-[var(--brand-muted)]',
                              )}>
                                {nextOverdue ? t.leads.overdue : relativeTime(contact.nextActionAt)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[var(--brand-muted)] text-xs opacity-30">—</span>
                          )}
                          {openTaskCount > 0 && (
                            <div className="text-[10px] text-[var(--brand-muted)] opacity-60 mt-0.5">
                              {openTaskCount} task{openTaskCount > 1 ? 's' : ''}
                            </div>
                          )}
                        </TableCell>

                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lead detail drawer */}
      <LeadDetailDrawer
        contact={selectedContact}
        onClose={() => setSelectedContact(null)}
        tenantSlug={tenantSlug}
      />

      {/* Batch action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] px-4 py-3 shadow-xl shadow-black/10 backdrop-blur-xl">
          <span className="text-sm font-medium text-[var(--brand-text)] whitespace-nowrap">
            {selectedIds.size} selected
          </span>

          <div className="h-4 w-px bg-[var(--brand-border)]" />

          {batchStatus === 'done' || batchStatus === 'error' ? (
            <p className={cn('text-xs', batchStatus === 'done' ? 'text-emerald-600' : 'text-red-500')}>
              {batchMessage}
            </p>
          ) : (
            <>
              <button
                onClick={handleCallBatch}
                disabled={batchStatus === 'calling' || callsRemaining <= 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-3.5 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                <Phone className="h-3.5 w-3.5" />
                {batchStatus === 'calling' ? 'Queuing…' : `Call All Now`}
              </button>
              {callsRemaining < 20 && (
                <span className="text-[11px] text-[var(--brand-muted)] whitespace-nowrap">
                  {callsRemaining}/20 calls left today
                </span>
              )}
            </>
          )}

          <button
            onClick={clearSelection}
            className="ml-1 rounded-full p-1 text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-border)]/30 transition-colors"
            aria-label="Clear selection"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </>
  )
}

