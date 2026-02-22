'use client'

import { MessageSquare, UserPlus, CalendarCheck, TrendingUp, Hash, Eye } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { ConversationsKpiSummary, ChatChannel } from '@/lib/chat/types'

interface ConversationsKpiStripProps {
  summary: ConversationsKpiSummary
}

const CHANNEL_LABELS: Record<ChatChannel, string> = {
  sms: 'SMS',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
}

function getTopChannel(breakdown: Record<ChatChannel, number>): string {
  const entries = Object.entries(breakdown) as [ChatChannel, number][]
  const sorted = entries.sort((a, b) => b[1] - a[1])
  if (sorted.length === 0 || sorted[0][1] === 0) return '—'
  return CHANNEL_LABELS[sorted[0][0]]
}

export function ConversationsKpiStrip({ summary }: ConversationsKpiStripProps) {
  const kpis = [
    {
      label: 'Conversations',
      value: summary.totalConversations.toLocaleString(),
      sub: 'All channels',
      icon: MessageSquare,
      color: 'var(--brand-primary)',
    },
    {
      label: 'Needs Review',
      value: (summary.unreadConversations + summary.openConversations).toLocaleString(),
      sub: `${summary.unreadConversations} unread · ${summary.openConversations} open`,
      icon: Eye,
      color: '#3B82F6',
    },
    {
      label: 'Chat Leads',
      value: summary.chatLeadsCaptured.toLocaleString(),
      sub: 'Captured from chat',
      icon: UserPlus,
      color: '#7C3AED',
    },
    {
      label: 'Chat Bookings',
      value: summary.chatBookings.toLocaleString(),
      sub: 'From conversations',
      icon: CalendarCheck,
      color: '#10B981',
    },
    {
      label: 'Booking Rate',
      value: `${summary.chatBookingRate}%`,
      sub: 'Leads → bookings',
      icon: TrendingUp,
      color: '#F59E0B',
    },
    {
      label: 'Top Channel',
      value: getTopChannel(summary.channelBreakdown),
      sub: 'Most active',
      icon: Hash,
      color: '#EC4899',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
      {kpis.map((kpi) => {
        const Icon = kpi.icon
        return (
          <Card key={kpi.label} className="relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                background: `radial-gradient(ellipse at top left, ${kpi.color}, transparent 70%)`,
              }}
            />
            <CardContent className="p-4 relative">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-medium text-[var(--brand-muted)] uppercase tracking-wider mb-1.5">
                    {kpi.label}
                  </p>
                  <p className="text-xl font-bold text-[var(--brand-text)] tabular-nums leading-none">
                    {kpi.value}
                  </p>
                  <p className="text-[10px] text-[var(--brand-muted)] mt-1">{kpi.sub}</p>
                </div>
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: `${kpi.color}22`, color: kpi.color }}
                >
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
