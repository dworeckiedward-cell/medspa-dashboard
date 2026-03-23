'use client'

/**
 * OpsNeedsAttention — compact triage panel showing top 3 attention items.
 *
 * Links to /ops/alerts, /ops/requests, and /ops/clients (filtered).
 */

import Link from 'next/link'
import { AlertTriangle, MessageSquare, UserX, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn, polish } from '@/lib/utils'

interface AttentionItem {
  icon: React.ElementType
  label: string
  count: number
  href: string
  color: string
  urgent: boolean
}

interface OpsNeedsAttentionProps {
  criticalAlerts: number
  openRequests: number
  inactiveClients: number
}

export function OpsNeedsAttention({
  criticalAlerts,
  openRequests,
  inactiveClients,
}: OpsNeedsAttentionProps) {
  const items: AttentionItem[] = [
    {
      icon: AlertTriangle,
      label: 'Critical alerts',
      count: criticalAlerts,
      href: '/ops/alerts',
      color: '#EF4444',
      urgent: criticalAlerts > 0,
    },
    {
      icon: MessageSquare,
      label: 'Open support requests',
      count: openRequests,
      href: '/ops/requests',
      color: '#3B82F6',
      urgent: openRequests > 0,
    },
    {
      icon: UserX,
      label: 'No activity (30d)',
      count: inactiveClients,
      href: '/ops/clients',
      color: '#F59E0B',
      urgent: inactiveClients > 0,
    },
  ]

  const hasAny = items.some((i) => i.count > 0)

  if (!hasAny) return null

  return (
    <Card>
      <CardContent className="p-4">
        <p className={cn(polish.sectionTitle, 'mb-3')}>Needs Attention</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {items
            .filter((item) => item.count > 0)
            .map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-xl border p-3 transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/30',
                  item.urgent
                    ? 'border-[var(--brand-border)] hover:border-[var(--brand-border)]/80 hover:bg-[var(--brand-bg)]/60'
                    : 'border-[var(--brand-border)]/40 hover:border-[var(--brand-border)]/60',
                )}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: `${item.color}15`, color: item.color }}
                >
                  <item.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-2xl font-semibold tracking-tight text-[var(--brand-text)] tabular-nums leading-none">
                    {item.count}
                  </p>
                  <p className="text-[10px] text-[var(--brand-muted)] mt-0.5 truncate">
                    {item.label}
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-[var(--brand-muted)] opacity-0 group-hover:opacity-60 transition-opacity" />
              </Link>
            ))}
        </div>
      </CardContent>
    </Card>
  )
}
