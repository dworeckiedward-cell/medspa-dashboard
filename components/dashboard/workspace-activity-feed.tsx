'use client'

/**
 * WorkspaceActivityFeed — displays recent workspace activity.
 *
 * Fetches activity from /api/team/activity and renders a timeline.
 */

import { useState, useEffect } from 'react'
import {
  UserPlus,
  UserCheck,
  UserMinus,
  ArrowUpDown,
  XCircle,
  Palette,
  Plus,
  Pencil,
  Trash2,
  Link2,
  Unlink,
  Settings,
  Image,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkspaceActivity, WorkspaceActivityAction } from '@/lib/workspace/types'

const ACTION_CONFIG: Record<
  WorkspaceActivityAction,
  { icon: React.ElementType; color: string }
> = {
  member_invited: { icon: UserPlus, color: 'text-blue-500' },
  member_joined: { icon: UserCheck, color: 'text-emerald-500' },
  member_removed: { icon: UserMinus, color: 'text-rose-500' },
  role_changed: { icon: ArrowUpDown, color: 'text-amber-500' },
  invite_revoked: { icon: XCircle, color: 'text-slate-400' },
  branding_updated: { icon: Palette, color: 'text-violet-500' },
  service_created: { icon: Plus, color: 'text-emerald-500' },
  service_updated: { icon: Pencil, color: 'text-blue-500' },
  service_deleted: { icon: Trash2, color: 'text-rose-500' },
  integration_connected: { icon: Link2, color: 'text-emerald-500' },
  integration_disconnected: { icon: Unlink, color: 'text-amber-500' },
  settings_updated: { icon: Settings, color: 'text-slate-500' },
  logo_updated: { icon: Image, color: 'text-violet-500' },
}

interface WorkspaceActivityFeedProps {
  initialActivity?: WorkspaceActivity[]
}

export function WorkspaceActivityFeed({ initialActivity }: WorkspaceActivityFeedProps) {
  const [activity, setActivity] = useState<WorkspaceActivity[]>(initialActivity ?? [])
  const [loading, setLoading] = useState(!initialActivity)

  useEffect(() => {
    if (initialActivity) return

    async function fetchActivity() {
      try {
        const res = await fetch('/api/team/activity')
        if (!res.ok) return
        const data = await res.json()
        setActivity(data.activity ?? [])
      } catch {
        // silent — activity feed is non-critical
      } finally {
        setLoading(false)
      }
    }

    fetchActivity()
  }, [initialActivity])

  function formatRelativeTime(iso: string): string {
    const now = Date.now()
    const then = new Date(iso).getTime()
    const diffMs = now - then
    const diffMin = Math.floor(diffMs / 60_000)
    const diffHr = Math.floor(diffMs / 3_600_000)
    const diffDay = Math.floor(diffMs / 86_400_000)

    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffHr < 24) return `${diffHr}h ago`
    if (diffDay < 7) return `${diffDay}d ago`
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3 animate-pulse">
            <div className="h-6 w-6 rounded-full bg-[var(--brand-border)]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-48 rounded bg-[var(--brand-border)]" />
              <div className="h-2.5 w-20 rounded bg-[var(--brand-border)]/60" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (activity.length === 0) {
    return (
      <div className="py-6 text-center">
        <Activity className="mx-auto h-6 w-6 text-[var(--brand-border)] mb-2" />
        <p className="text-xs text-[var(--brand-muted)]">No activity yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {activity.map((entry, idx) => {
        const cfg = ACTION_CONFIG[entry.action] ?? {
          icon: Activity,
          color: 'text-slate-400',
        }
        const Icon = cfg.icon
        const isLast = idx === activity.length - 1

        return (
          <div key={entry.id} className="flex items-start gap-3 relative">
            {/* Timeline line */}
            {!isLast && (
              <div className="absolute left-3 top-7 bottom-0 w-px bg-[var(--brand-border)]" />
            )}

            {/* Icon */}
            <div
              className={cn(
                'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center',
                'rounded-full bg-[var(--brand-surface)] border border-[var(--brand-border)]',
              )}
            >
              <Icon className={cn('h-3 w-3', cfg.color)} />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1 pb-4">
              <p className="text-xs text-[var(--brand-text)] leading-relaxed">
                {entry.description}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {entry.actorEmail && (
                  <span className="text-[10px] text-[var(--brand-muted)] truncate">
                    {entry.actorEmail}
                  </span>
                )}
                <span className="text-[10px] text-[var(--brand-muted)]">
                  {formatRelativeTime(entry.createdAt)}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
