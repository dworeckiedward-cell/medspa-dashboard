'use client'

import { useState, useMemo } from 'react'
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
}

type SortKey = 'lastCallAt' | 'nextActionAt' | 'priorityScore'
type DatePreset = 'today' | '7d' | '30d' | 'all'

// Status badge variant mapping
const statusVariant: Record<ContactStatus, 'success' | 'warning' | 'muted' | 'destructive' | 'brand' | 'accent'> = {
  new: 'brand',
  contacted: 'accent',
  interested: 'warning',
  booked: 'success',
  lost: 'destructive',
  reactivation: 'muted',
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

export function LeadsTable({ contacts }: LeadsTableProps) {
  const { t } = useLanguage()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterSource, setFilterSource] = useState<string>('all')
  const [filterFollowUp, setFilterFollowUp] = useState(false)
  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [sortKey, setSortKey] = useState<SortKey>('lastCallAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)

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
                  {(Object.keys(CONTACT_STATUS_LABELS) as ContactStatus[]).map((s) => (
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
                    <TableHead className="w-48">{t.leads.colName}</TableHead>
                    <TableHead className="w-24">{t.leads.colStatus}</TableHead>
                    <TableHead className="w-24">{t.leads.colSource}</TableHead>
                    <TableHead
                      className="w-36 cursor-pointer select-none"
                      onClick={() => handleSort('lastCallAt')}
                    >
                      <span className="flex items-center gap-1">
                        {t.leads.colLastContact}
                        <SortIcon col="lastCallAt" />
                      </span>
                    </TableHead>
                    <TableHead
                      className="w-36 cursor-pointer select-none"
                      onClick={() => handleSort('nextActionAt')}
                    >
                      <span className="flex items-center gap-1">
                        {t.leads.colNextAction}
                        <SortIcon col="nextActionAt" />
                      </span>
                    </TableHead>
                    <TableHead className="w-20">{t.leads.colOwner}</TableHead>
                    <TableHead
                      className="w-20 text-right cursor-pointer select-none"
                      onClick={() => handleSort('priorityScore')}
                    >
                      <span className="flex items-center justify-end gap-1">
                        <SortIcon col="priorityScore" />
                        {t.leads.colPriority}
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((contact) => {
                    const nextOverdue = isOverdue(contact.nextActionAt)
                    const pri = priorityLabel(contact.priorityScore)
                    const openTaskCount = contact.openFollowUpTasks?.length ?? 0
                    const intent = contact.latestCallSummary?.structuredSummary?.intent

                    return (
                      <TableRow
                        key={contact.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedContact(contact)}
                      >
                        {/* Name + intent */}
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
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Badge variant={statusVariant[contact.status]} className="text-xs">
                            {CONTACT_STATUS_LABELS[contact.status]}
                          </Badge>
                        </TableCell>

                        {/* Source */}
                        <TableCell>
                          <span className="text-xs text-[var(--brand-muted)]">
                            {SOURCE_LABELS[contact.source] ?? contact.source}
                          </span>
                        </TableCell>

                        {/* Last contact */}
                        <TableCell>
                          <span className="text-xs text-[var(--brand-muted)]">
                            {relativeTime(contact.lastCallAt) ?? '—'}
                          </span>
                        </TableCell>

                        {/* Next action */}
                        <TableCell>
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

                        {/* Owner */}
                        <TableCell>
                          <Badge
                            variant={contact.ownerType === 'ai' ? 'brand' : 'accent'}
                            className="text-[10px]"
                          >
                            {contact.ownerType === 'ai' ? t.leads.ownerAi : t.leads.ownerHuman}
                          </Badge>
                        </TableCell>

                        {/* Priority */}
                        <TableCell className="text-right">
                          <span className={cn('text-xs font-semibold tabular-nums', pri.className)}>
                            {pri.label}
                          </span>
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
      />
    </>
  )
}

