'use client'

import { useState } from 'react'
import { FileText, Clock, AlertTriangle, CheckCircle2, Circle, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from '@/lib/support/types'
import type { SupportRequest, RequestStatus, RequestPriority } from '@/lib/support/types'

interface RequestListProps {
  requests: SupportRequest[]
  onSelect: (request: SupportRequest) => void
  selectedId?: string | null
}

const STATUS_ICON: Record<RequestStatus, typeof Circle> = {
  open: Circle,
  acknowledged: Clock,
  in_progress: Clock,
  waiting_for_client: AlertTriangle,
  resolved: CheckCircle2,
  closed: CheckCircle2,
  reopened: Circle,
}

const STATUS_COLORS: Record<RequestStatus, string> = {
  open: 'text-blue-500',
  acknowledged: 'text-cyan-500',
  in_progress: 'text-amber-500',
  waiting_for_client: 'text-orange-500',
  resolved: 'text-emerald-500',
  closed: 'text-gray-400',
  reopened: 'text-purple-500',
}

const PRIORITY_DOT: Record<RequestPriority, string> = {
  low: 'bg-gray-300 dark:bg-gray-600',
  normal: 'bg-blue-400',
  high: 'bg-amber-400',
  urgent: 'bg-red-500',
}

type FilterStatus = 'all' | 'open' | 'resolved'

export function RequestList({ requests, onSelect, selectedId }: RequestListProps) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')

  const filtered = requests.filter((r) => {
    // Status filter
    if (filterStatus === 'open' && ['resolved', 'closed'].includes(r.status)) return false
    if (filterStatus === 'resolved' && !['resolved', 'closed'].includes(r.status)) return false

    // Search filter
    if (search) {
      const q = search.toLowerCase()
      return (
        r.subject.toLowerCase().includes(q) ||
        r.shortCode.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      )
    }
    return true
  })

  const filterTabs: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'resolved', label: 'Resolved' },
  ]

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4 text-[var(--brand-muted)]" />
          Your Requests
          <Badge variant="outline" className="text-[10px] ml-auto">
            {filtered.length}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0 flex flex-col gap-3 flex-1 min-h-0">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--brand-muted)]" />
          <Input
            placeholder="Search requests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={cn(
                'rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors',
                filterStatus === tab.key
                  ? 'bg-[var(--brand-primary)] text-white'
                  : 'bg-[var(--brand-surface)] text-[var(--brand-muted)] hover:text-[var(--brand-text)]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Request list */}
        <div className="flex-1 overflow-y-auto -mx-4 px-4">
          {filtered.length === 0 ? (
            <p className="text-xs text-[var(--brand-muted)] text-center py-8">
              No requests found
            </p>
          ) : (
            <div className="space-y-1">
              {filtered.map((r) => {
                const StatusIcon = STATUS_ICON[r.status]
                const isSelected = selectedId === r.id
                return (
                  <button
                    key={r.id}
                    onClick={() => onSelect(r)}
                    className={cn(
                      'w-full text-left rounded-lg border p-3 transition-colors',
                      isSelected
                        ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                        : 'border-[var(--brand-border)] hover:border-[var(--brand-primary)]/40 hover:bg-[var(--brand-surface)]',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <StatusIcon className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', STATUS_COLORS[r.status])} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-[var(--brand-text)] truncate">
                            {r.subject}
                          </span>
                          <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', PRIORITY_DOT[r.priority])} />
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-[var(--brand-muted)] font-mono">
                            {r.shortCode}
                          </span>
                          <span className="text-[10px] text-[var(--brand-muted)]">
                            {CATEGORY_LABELS[r.category]}
                          </span>
                          <span className="text-[10px] text-[var(--brand-muted)] ml-auto tabular-nums">
                            {formatTimeAgo(r.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - Date.parse(isoDate)
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}
