import { CalendarCheck, DollarSign, Clock, Target } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import type { DashboardMetrics } from '@/types/database'

interface KpiCardsProps {
  metrics: DashboardMetrics
  currency?: string
}

export function KpiCards({ metrics, currency = 'USD' }: KpiCardsProps) {
  const cards = [
    {
      label: 'Appointments Booked',
      value: metrics.appointmentsBooked.toLocaleString(),
      sub: 'Last 30 days',
      icon: CalendarCheck,
      color: 'var(--brand-primary)',
    },
    {
      label: 'Potential Revenue',
      value: formatCurrency(metrics.potentialRevenue, currency),
      sub: 'Estimated pipeline',
      icon: DollarSign,
      color: '#10B981', // emerald
    },
    {
      label: 'Hours Saved',
      value: `${metrics.hoursSaved}h`,
      sub: 'Calls handled by AI',
      icon: Clock,
      color: 'var(--brand-accent)',
    },
    {
      label: 'Lead Conversion',
      value: `${metrics.leadConversionRate}%`,
      sub: 'Leads → bookings',
      icon: Target,
      color: '#F59E0B', // amber
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card key={card.label} className="relative overflow-hidden">
            {/* Subtle gradient glow */}
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                background: `radial-gradient(ellipse at top left, ${card.color}, transparent 70%)`,
              }}
            />

            <CardContent className="p-5 relative">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] uppercase tracking-wider mb-2">
                    {card.label}
                  </p>
                  <p className="text-2xl font-bold text-[var(--brand-text)] tabular-nums leading-none">
                    {card.value}
                  </p>
                  <p className="text-xs text-[var(--brand-muted)] mt-1.5">{card.sub}</p>
                </div>
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: `${card.color}22`, color: card.color }}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
