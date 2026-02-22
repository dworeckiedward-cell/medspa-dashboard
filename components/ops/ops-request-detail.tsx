'use client'

import { useState } from 'react'
import {
  Send, User, Bot, Settings2, Lock, Globe,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  ALLOWED_TRANSITIONS,
} from '@/lib/support/types'
import type {
  RequestWithClient,
  SupportRequestUpdate,
  SlaInfo,
  SlaStatus,
  RequestStatus,
  RequestPriority,
} from '@/lib/support/types'

interface OpsRequestDetailProps {
  request: RequestWithClient
  updates: SupportRequestUpdate[]
  slaInfo: SlaInfo | null
}

const PRIORITY_BADGE: Record<RequestPriority, string> = {
  low: 'border-gray-300 text-gray-500 dark:border-gray-600',
  normal: 'border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400',
  high: 'border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400',
  urgent: 'border-red-300 text-red-600 dark:border-red-700 dark:text-red-400',
}

const SLA_BADGE: Record<SlaStatus, string> = {
  on_track: 'border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400',
  at_risk: 'border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400',
  overdue: 'border-red-300 text-red-600 dark:border-red-700 dark:text-red-400',
  responded: 'border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400',
  not_applicable: 'border-gray-300 text-gray-400 dark:border-gray-700',
}

const AUTHOR_ICON: Record<string, typeof User> = {
  client: User,
  operator: Bot,
  system: Settings2,
}

export function OpsRequestDetail({ request, updates: initialUpdates, slaInfo }: OpsRequestDetailProps) {
  const [updates, setUpdates] = useState(initialUpdates)
  const [currentStatus, setCurrentStatus] = useState<RequestStatus>(request.status)
  const [comment, setComment] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'internal'>('public')
  const [submitting, setSubmitting] = useState(false)
  const [transitioning, setTransitioning] = useState(false)

  const allowedNextStatuses = ALLOWED_TRANSITIONS[currentStatus]

  async function handleTransition(newStatus: RequestStatus) {
    setTransitioning(true)
    try {
      const res = await fetch(`/api/ops/requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'transition_status', newStatus }),
      })
      if (res.ok) {
        setCurrentStatus(newStatus)
        await refreshUpdates()
      }
    } catch {
      // Failed
    } finally {
      setTransitioning(false)
    }
  }

  async function handleAddComment() {
    if (!comment.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/ops/requests/${request.id}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: comment.trim(), visibility }),
      })
      if (res.ok) {
        setComment('')
        await refreshUpdates()
      }
    } catch {
      // Failed
    } finally {
      setSubmitting(false)
    }
  }

  async function refreshUpdates() {
    try {
      const res = await fetch(`/api/ops/requests/${request.id}`)
      if (res.ok) {
        const data = await res.json()
        setUpdates(data.updates ?? [])
        if (data.request) setCurrentStatus(data.request.status)
      }
    } catch {
      // Failed
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left: request info + timeline */}
      <div className="lg:col-span-2 space-y-4">
        {/* Request info */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-[var(--brand-muted)] font-mono">{request.shortCode}</span>
              <Badge variant="outline" className={cn('text-[10px]', PRIORITY_BADGE[request.priority])}>
                {PRIORITY_LABELS[request.priority]}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {CATEGORY_LABELS[request.category]}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {STATUS_LABELS[currentStatus]}
              </Badge>
              {slaInfo && (
                <Badge variant="outline" className={cn('text-[10px]', SLA_BADGE[slaInfo.slaStatus])}>
                  {formatSlaDisplay(slaInfo)}
                </Badge>
              )}
            </div>
            <CardTitle className="text-sm mt-1">{request.subject}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="border border-[var(--brand-border)] rounded-lg p-3 bg-[var(--brand-surface)]">
              <p className="text-xs text-[var(--brand-text)] whitespace-pre-wrap leading-relaxed">
                {request.description}
              </p>
              {request.pagePath && (
                <p className="text-[10px] text-[var(--brand-muted)] mt-2">
                  Page: <span className="font-mono">{request.pagePath}</span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Timeline</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {updates.map((update) => {
              const AuthorIcon = AUTHOR_ICON[update.authorType] ?? User
              const isInternal = update.visibility === 'internal'
              return (
                <div key={update.id} className={cn(
                  'flex gap-2 p-2 rounded-md',
                  isInternal ? 'bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-800/30' : '',
                )}>
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-medium text-[var(--brand-text)]">
                        {update.authorLabel ?? update.authorType}
                      </span>
                      {update.updateType === 'status_change' && (
                        <Badge variant="outline" className="text-[8px] px-1 py-0">Status Change</Badge>
                      )}
                      {isInternal && (
                        <Badge variant="outline" className="text-[8px] px-1 py-0 border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400">
                          <Lock className="h-2 w-2 mr-0.5" />
                          Internal
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

            {updates.length === 0 && (
              <p className="text-xs text-[var(--brand-muted)] text-center py-4">No updates yet</p>
            )}
          </CardContent>
        </Card>

        {/* Add comment */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setVisibility('public')}
                className={cn(
                  'flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors',
                  visibility === 'public'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
                    : 'text-[var(--brand-muted)] hover:text-[var(--brand-text)]',
                )}
              >
                <Globe className="h-3 w-3" />
                Public
              </button>
              <button
                onClick={() => setVisibility('internal')}
                className={cn(
                  'flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors',
                  visibility === 'internal'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                    : 'text-[var(--brand-muted)] hover:text-[var(--brand-text)]',
                )}
              >
                <Lock className="h-3 w-3" />
                Internal
              </button>
            </div>
            <div className="flex gap-2">
              <Textarea
                placeholder={visibility === 'internal' ? 'Add internal note (not visible to client)...' : 'Reply to client...'}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="flex-1 text-xs"
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
                {submitting ? 'Sending...' : 'Send'}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right sidebar: metadata + actions */}
      <div className="space-y-4">
        {/* Metadata */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Details</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            <MetaRow label="Client" value={request.clientName} />
            <MetaRow label="Status" value={STATUS_LABELS[currentStatus]} />
            <MetaRow label="Priority" value={PRIORITY_LABELS[request.priority]} />
            <MetaRow label="Category" value={CATEGORY_LABELS[request.category]} />
            <MetaRow label="Source" value={request.source} />
            <MetaRow label="Assigned" value={request.assignedTo ?? 'Unassigned'} />
            <MetaRow label="Created" value={new Date(request.createdAt).toLocaleString()} />
            {request.resolvedAt && (
              <MetaRow label="Resolved" value={new Date(request.resolvedAt).toLocaleString()} />
            )}
            {slaInfo && (
              <>
                {slaInfo.responseTimeHours != null && (
                  <MetaRow label="Response Time" value={`${slaInfo.responseTimeHours}h`} />
                )}
                {slaInfo.resolutionTimeHours != null && (
                  <MetaRow label="Resolution Time" value={`${slaInfo.resolutionTimeHours}h`} />
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Status transitions */}
        {allowedNextStatuses.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Transition Status</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1.5">
              {allowedNextStatuses.map((s) => (
                <button
                  key={s}
                  onClick={() => handleTransition(s)}
                  disabled={transitioning}
                  className={cn(
                    'w-full text-left rounded-md border border-[var(--brand-border)] px-3 py-2 text-xs font-medium transition-colors',
                    'hover:border-[var(--brand-primary)] hover:bg-[var(--brand-surface)]',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-[var(--brand-muted)]">{label}</span>
      <span className="text-[10px] font-medium text-[var(--brand-text)]">{value}</span>
    </div>
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
