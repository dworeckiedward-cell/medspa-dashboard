'use client'

import { useState, useEffect } from 'react'
import {
  ArrowLeft, Clock, CheckCircle2, AlertTriangle, MessageSquare,
  Send, User, Bot, Settings2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { buildTenantApiUrl } from '@/lib/dashboard/tenant-api'
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from '@/lib/support/types'
import type {
  SupportRequest,
  SupportRequestUpdate,
  SlaInfo,
  SlaStatus,
  RequestPriority,
} from '@/lib/support/types'

interface RequestDetailProps {
  request: SupportRequest
  tenantSlug: string
  onBack: () => void
  onRefresh?: () => void
}

interface DetailData {
  request: SupportRequest
  updates: SupportRequestUpdate[]
  slaInfo: SlaInfo | null
}

const SLA_COLORS: Record<SlaStatus, string> = {
  on_track: 'text-emerald-600 dark:text-emerald-400',
  at_risk: 'text-amber-600 dark:text-amber-400',
  overdue: 'text-red-600 dark:text-red-400',
  responded: 'text-blue-600 dark:text-blue-400',
  not_applicable: 'text-gray-400',
}

const SLA_BADGE_COLORS: Record<SlaStatus, string> = {
  on_track: 'border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400',
  at_risk: 'border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400',
  overdue: 'border-red-300 text-red-600 dark:border-red-700 dark:text-red-400',
  responded: 'border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400',
  not_applicable: 'border-gray-300 text-gray-400 dark:border-gray-700',
}

const PRIORITY_BADGE: Record<RequestPriority, string> = {
  low: 'border-gray-300 text-gray-500 dark:border-gray-600',
  normal: 'border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400',
  high: 'border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400',
  urgent: 'border-red-300 text-red-600 dark:border-red-700 dark:text-red-400',
}

const AUTHOR_ICON: Record<string, typeof User> = {
  client: User,
  operator: Bot,
  system: Settings2,
}

export function RequestDetail({ request, tenantSlug, onBack, onRefresh }: RequestDetailProps) {
  const [detail, setDetail] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadDetail()
  }, [request.id])

  async function loadDetail() {
    setLoading(true)
    try {
      const res = await fetch(
        buildTenantApiUrl(`/api/support/${request.id}`, tenantSlug),
      )
      if (res.ok) {
        const data = await res.json()
        setDetail(data)
      }
    } catch {
      // Failed to load detail
    } finally {
      setLoading(false)
    }
  }

  async function handleAddComment() {
    if (!comment.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(
        buildTenantApiUrl(`/api/support/${request.id}`, tenantSlug),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'add_comment', body: comment.trim() }),
        },
      )
      if (res.ok) {
        setComment('')
        await loadDetail()
        onRefresh?.()
      }
    } catch {
      // Failed to add comment
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReopen() {
    try {
      const res = await fetch(
        buildTenantApiUrl(`/api/support/${request.id}`, tenantSlug),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reopen' }),
        },
      )
      if (res.ok) {
        await loadDetail()
        onRefresh?.()
      }
    } catch {
      // Failed to reopen
    }
  }

  const req = detail?.request ?? request
  const updates = detail?.updates ?? []
  const slaInfo = detail?.slaInfo
  const canReopen = req.status === 'resolved' || req.status === 'closed'

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1 rounded hover:bg-[var(--brand-surface)] transition-colors md:hidden"
          >
            <ArrowLeft className="h-4 w-4 text-[var(--brand-muted)]" />
          </button>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm truncate">{req.subject}</CardTitle>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[10px] text-[var(--brand-muted)] font-mono">
                {req.shortCode}
              </span>
              <Badge variant="outline" className={cn('text-[10px]', PRIORITY_BADGE[req.priority])}>
                {PRIORITY_LABELS[req.priority]}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {CATEGORY_LABELS[req.category]}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {STATUS_LABELS[req.status]}
              </Badge>
              {slaInfo && (
                <Badge variant="outline" className={cn('text-[10px]', SLA_BADGE_COLORS[slaInfo.slaStatus])}>
                  {formatSlaDisplay(slaInfo)}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0 pt-0">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-[var(--brand-muted)] py-8 justify-center">
            <div className="h-4 w-4 rounded-full border-2 border-[var(--brand-primary)] border-t-transparent animate-spin" />
            Loading details...
          </div>
        ) : (
          <>
            {/* Description */}
            <div className="border border-[var(--brand-border)] rounded-lg p-3 mb-3 bg-[var(--brand-surface)]">
              <p className="text-xs text-[var(--brand-text)] whitespace-pre-wrap leading-relaxed">
                {req.description}
              </p>
              {req.pagePath && (
                <p className="text-[10px] text-[var(--brand-muted)] mt-2">
                  Page: <span className="font-mono">{req.pagePath}</span>
                </p>
              )}
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto space-y-2 mb-3">
              {updates
                .filter((u) => u.visibility === 'public')
                .map((update) => {
                  const AuthorIcon = AUTHOR_ICON[update.authorType] ?? User
                  return (
                    <div key={update.id} className="flex gap-2">
                      <div className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-0.5',
                        update.authorType === 'operator'
                          ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                          : update.authorType === 'system'
                            ? 'bg-gray-100 text-gray-400 dark:bg-gray-800'
                            : 'bg-blue-50 text-blue-500 dark:bg-blue-950/30',
                      )}>
                        <AuthorIcon className="h-3 w-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-medium text-[var(--brand-text)]">
                            {update.authorLabel ?? update.authorType}
                          </span>
                          {update.updateType === 'status_change' && (
                            <Badge variant="outline" className="text-[8px] px-1 py-0">
                              Status Change
                            </Badge>
                          )}
                          <span className="text-[10px] text-[var(--brand-muted)] tabular-nums ml-auto">
                            {formatTimestamp(update.createdAt)}
                          </span>
                        </div>
                        {update.body && (
                          <p className="text-xs text-[var(--brand-text)] mt-0.5 whitespace-pre-wrap leading-relaxed">
                            {update.body}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}

              {updates.filter((u) => u.visibility === 'public').length === 0 && (
                <p className="text-xs text-[var(--brand-muted)] text-center py-4">
                  No updates yet. We&apos;ll respond soon.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="border-t border-[var(--brand-border)] pt-3 space-y-2">
              {canReopen && (
                <button
                  onClick={handleReopen}
                  className="text-[10px] text-[var(--brand-primary)] hover:underline"
                >
                  Reopen this request
                </button>
              )}
              <div className="flex gap-2">
                <Textarea
                  placeholder="Add a comment..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  className="flex-1 text-xs min-h-[60px]"
                />
                <button
                  onClick={handleAddComment}
                  disabled={submitting || !comment.trim()}
                  className={cn(
                    'self-end flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] font-medium transition-colors',
                    'bg-[var(--brand-primary)] text-white hover:opacity-90',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  <Send className="h-3 w-3" />
                  {submitting ? 'Sending...' : 'Reply'}
                </button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function formatSlaDisplay(info: SlaInfo): string {
  switch (info.slaStatus) {
    case 'responded':
      return info.responseTimeHours != null ? `Responded in ${info.responseTimeHours}h` : 'Responded'
    case 'overdue':
      return info.hoursOverdue != null ? `Overdue by ${info.hoursOverdue}h` : 'Overdue'
    case 'at_risk':
      return info.hoursUntilDue != null ? `Due in ${info.hoursUntilDue}h` : 'At risk'
    case 'on_track':
      return info.hoursUntilDue != null ? `Due in ${Math.round(info.hoursUntilDue)}h` : 'On track'
    case 'not_applicable':
      return '—'
  }
}

function formatTimestamp(isoDate: string): string {
  const d = new Date(isoDate)
  const diff = Date.now() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
