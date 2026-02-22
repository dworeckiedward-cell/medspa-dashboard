'use client'

import { useState, useEffect } from 'react'
import { MessageSquare, Eye, CalendarCheck, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface OpsConvOverview {
  clientId: string
  clientName: string
  totalConversations: number
  openConversations: number
  unreadCount: number
  bookedFromChat: number
  lastActivityAt: string | null
}

interface OpsConvStats {
  totalConversations: number
  totalOpen: number
  totalUnread: number
  totalBooked: number
  activeTenants: number
}

export function OpsConversationsWatchlist() {
  const [overviews, setOverviews] = useState<OpsConvOverview[]>([])
  const [stats, setStats] = useState<OpsConvStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch_() {
      try {
        const res = await fetch('/api/ops/conversations')
        if (res.ok) {
          const data = await res.json()
          setOverviews(data.overviews ?? [])
          setStats(data.stats ?? null)
        }
      } catch {
        // Fail silently
      } finally {
        setLoading(false)
      }
    }
    fetch_()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-xs text-[var(--brand-muted)]">
            <div className="h-4 w-4 rounded-full border-2 border-[var(--brand-primary)] border-t-transparent animate-spin" />
            Loading chat overview...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (overviews.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[var(--brand-muted)]" />
            Chat Conversations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-[var(--brand-muted)]">No chat data yet</p>
        </CardContent>
      </Card>
    )
  }

  // Sort by unread desc, then by total conversations desc
  const sorted = [...overviews].sort((a, b) => {
    if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount
    return b.totalConversations - a.totalConversations
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[var(--brand-muted)]" />
            Chat Conversations
          </CardTitle>
          {stats && (
            <div className="flex items-center gap-2">
              {stats.totalUnread > 0 && (
                <Badge variant="outline" className="text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700 text-[10px] gap-1">
                  <Eye className="h-3 w-3" />
                  {stats.totalUnread} unread
                </Badge>
              )}
              <Badge variant="outline" className="text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700 text-[10px] gap-1">
                <CalendarCheck className="h-3 w-3" />
                {stats.totalBooked} booked
              </Badge>
            </div>
          )}
        </div>
        {stats && (
          <p className="text-[10px] text-[var(--brand-muted)] mt-0.5">
            {stats.totalConversations} total conversations · {stats.activeTenants} active tenants · {stats.totalOpen} open
          </p>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        <div className="divide-y divide-[var(--brand-border)]">
          {sorted.map((o) => (
            <div key={o.clientId} className="flex items-center gap-3 py-2 first:pt-0">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[var(--brand-text)] truncate">
                  {o.clientName}
                </p>
                <p className="text-[10px] text-[var(--brand-muted)]">
                  {o.totalConversations} conv · {o.openConversations} open · {o.bookedFromChat} booked
                </p>
              </div>

              {o.unreadCount > 0 && (
                <span className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                  o.unreadCount >= 10
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                    : 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
                )}>
                  {o.unreadCount >= 10 && <AlertTriangle className="h-3 w-3" />}
                  {o.unreadCount} unread
                </span>
              )}

              {o.lastActivityAt && (
                <span className="text-[10px] text-[var(--brand-muted)] tabular-nums shrink-0">
                  {formatTimeAgo(o.lastActivityAt)}
                </span>
              )}
            </div>
          ))}
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
