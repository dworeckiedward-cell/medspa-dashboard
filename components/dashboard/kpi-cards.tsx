import { CalendarCheck, DollarSign, Phone, Clock, Users, PhoneIncoming, PhoneOutgoing } from 'lucide-react'
import { KpiCard } from './kpi-card'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import type { DashboardMetrics } from '@/types/database'
import type { TenantFeatures } from '@/lib/dashboard/tenant-features'

// ── Speed-to-lead helpers ────────────────────────────────────────────────────

function formatSpeedValue(sec: number | null): string {
  if (sec === null) return '—'
  if (sec < 60) return `${Math.round(sec)}s`
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function speedStatus(sec: number | null): { label: string; color: string } {
  if (sec === null) return { label: 'Pending data', color: '#6B7280' }
  if (sec <= 30)  return { label: 'Excellent', color: '#10B981' }
  if (sec <= 120) return { label: 'Good',      color: '#F59E0B' }
  return           { label: 'Needs work',  color: '#E11D48' }
}

interface KpiCardsProps {
  metrics: DashboardMetrics
  currency?: string
  /** Prior-period metrics for trend chips (optional) */
  priorMetrics?: DashboardMetrics | null
  /** Tenant feature flags — controls which cards are shown */
  features?: TenantFeatures
  /** Active date range in days (matches RangeSwitch: 1, 3, 7, 30, 0=all) */
  rangeDays?: number
}

function rangeLabel(days: number | undefined): string {
  if (days === undefined || days === 7) return 'Last 7 days'
  if (days === 1) return 'Last 24 hours'
  if (days === 3) return 'Last 72 hours'
  if (days === 30) return 'Last 30 days'
  if (days === 0) return 'All time'
  return `Last ${days} days`
}

export function KpiCards({ metrics, currency = 'USD', priorMetrics, features, rangeDays }: KpiCardsProps) {
  const periodLabel = rangeLabel(rangeDays)
  function pctDelta(current: number, prior: number | undefined): number | null {
    if (prior == null || prior === 0) return null
    return ((current - prior) / prior) * 100
  }

  // Build subtitle showing breakdown of filtered calls
  const bd = metrics.callBreakdown
  const breakdownParts: string[] = []
  if (bd) {
    if (bd.voicemail > 0) breakdownParts.push(`${bd.voicemail} voicemail`)
    if (bd.noAnswer > 0) breakdownParts.push(`${bd.noAnswer} no-answer`)
    if (bd.junk > 0) breakdownParts.push(`${bd.junk} other`)
  }
  const callsSubtitle = metrics.totalCalls > 0
    ? `${metrics.totalCalls} total · ${breakdownParts.length > 0 ? breakdownParts.join(', ') + ' filtered' : 'all meaningful'}`
    : 'No calls yet'

  const showAppointments      = features?.showAppointments      !== false
  const showBookedRevenue     = features?.showBookedRevenue     !== false
  const janeApi               = features?.janeApi               !== false
  const showPotentialRevenue  = features?.showPotentialRevenue  !== false

  const hoursSavedValue = metrics.hoursSaved > 0
    ? metrics.hoursSaved < 1
      ? `${Math.round(metrics.hoursSaved * 60)} min`
      : `${metrics.hoursSaved}h`
    : metrics.meaningfulCalls > 0
      ? `~${Math.round(metrics.meaningfulCalls * 2.5 / 60 * 10) / 10}h`
      : '—'
  const hoursSavedSubtitle = metrics.hoursSaved > 0
    ? 'Staff time handled by AI'
    : metrics.meaningfulCalls > 0
      ? 'Est. based on call count'
      : 'Staff time handled by AI'

  const cards: Array<{
    title: string
    value: string
    subtitle: string
    icon: React.ElementType
    color: string
    trend: number | null
  }> = showAppointments && showBookedRevenue
    ? [
        {
          title: 'Appointments Booked',
          value: metrics.appointmentsBooked.toLocaleString(),
          subtitle: periodLabel,
          icon: CalendarCheck,
          color: 'var(--brand-primary)',
          trend: pctDelta(metrics.appointmentsBooked, priorMetrics?.appointmentsBooked),
        },
        {
          title: 'Revenue',
          value: formatCurrency(metrics.potentialRevenue, currency),
          subtitle: metrics.pipelineRevenue > 0
            ? `${formatCurrency(metrics.pipelineRevenue, currency)} potential pipeline`
            : 'Booked & paid',
          icon: DollarSign,
          color: '#10B981',
          trend: pctDelta(metrics.potentialRevenue, priorMetrics?.potentialRevenue),
        },
        {
          title: 'AI Calls Handled',
          value: metrics.meaningfulCalls.toLocaleString(),
          subtitle: callsSubtitle,
          icon: Phone,
          color: '#7C3AED',
          trend: pctDelta(metrics.meaningfulCalls, priorMetrics?.meaningfulCalls),
        },
        {
          title: 'Hours Saved',
          value: hoursSavedValue,
          subtitle: hoursSavedSubtitle,
          icon: Clock,
          color: '#F59E0B',
          trend: pctDelta(metrics.hoursSaved, priorMetrics?.hoursSaved),
        },
      ]
    : !janeApi
    ? [
        // No Jane API mode: AI Receptionist | AI Setter | Potential Revenue | Hours Saved
        {
          title: 'AI Receptionist',
          value: metrics.inboundCalls.toLocaleString(),
          subtitle: periodLabel,
          icon: PhoneIncoming,
          color: 'var(--brand-primary)',
          trend: pctDelta(metrics.inboundCalls, priorMetrics?.inboundCalls),
        },
        {
          title: 'AI Setter',
          value: metrics.outboundSetterCalls.toLocaleString(),
          subtitle: periodLabel,
          icon: PhoneOutgoing,
          color: '#7C3AED',
          trend: pctDelta(metrics.outboundSetterCalls, priorMetrics?.outboundSetterCalls),
        },
        {
          title: 'Potential Revenue',
          value: formatCurrency(metrics.pipelineRevenue, currency),
          subtitle: 'AI-estimated pipeline',
          icon: DollarSign,
          color: '#10B981',
          trend: pctDelta(metrics.pipelineRevenue, priorMetrics?.pipelineRevenue),
        },
        {
          title: 'Hours Saved',
          value: hoursSavedValue,
          subtitle: hoursSavedSubtitle,
          icon: Clock,
          color: '#F59E0B',
          trend: pctDelta(metrics.hoursSaved, priorMetrics?.hoursSaved),
        },
      ]
    : [
        // No-appointments mode: AI Calls | Leads Generated | Potential Revenue | Hours Saved
        {
          title: 'AI Calls Handled',
          value: metrics.meaningfulCalls.toLocaleString(),
          subtitle: callsSubtitle,
          icon: Phone,
          color: '#7C3AED',
          trend: pctDelta(metrics.meaningfulCalls, priorMetrics?.meaningfulCalls),
        },
        {
          title: 'Leads Generated',
          value: metrics.totalLeads.toLocaleString(),
          subtitle: 'From inbound calls',
          icon: Users,
          color: 'var(--brand-primary)',
          trend: pctDelta(metrics.totalLeads, priorMetrics?.totalLeads),
        },
        {
          title: 'Potential Revenue',
          value: formatCurrency(metrics.pipelineRevenue, currency),
          subtitle: 'AI-estimated pipeline',
          icon: DollarSign,
          color: '#10B981',
          trend: pctDelta(metrics.pipelineRevenue, priorMetrics?.pipelineRevenue),
        },
        {
          title: 'Hours Saved',
          value: hoursSavedValue,
          subtitle: hoursSavedSubtitle,
          icon: Clock,
          color: '#F59E0B',
          trend: pctDelta(metrics.hoursSaved, priorMetrics?.hoursSaved),
        },
      ]

  const visibleCards = showPotentialRevenue
    ? cards
    : cards.filter((c) => c.title !== 'Potential Revenue')

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
      {visibleCards.map((card) => (
        <KpiCard key={card.title} {...card} />
      ))}
    </div>
  )
}

/** Skeleton placeholder matching the 4-card KPI grid layout. */
export function KpiCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-10 w-10 rounded-xl" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
