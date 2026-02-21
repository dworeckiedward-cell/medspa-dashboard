'use client'

import { useMemo } from 'react'
import { TrendingUp, Package } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ConfidenceBadge } from './confidence-badge'
import { formatCurrency } from '@/lib/utils'
import { computeServicePerformance } from '@/lib/dashboard/service-performance'
import type { CallLog } from '@/types/database'
import type { ClientService } from '@/lib/types/domain'

interface ServicePerformanceCardProps {
  callLogs: CallLog[]
  services: ClientService[]
  currency: string
}

export function ServicePerformanceCard({
  callLogs,
  services,
  currency,
}: ServicePerformanceCardProps) {
  const perf = useMemo(
    () => computeServicePerformance(callLogs, services),
    [callLogs, services],
  )

  // Empty state
  if (services.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-border)]/50">
            <Package className="h-5 w-5 text-[var(--brand-muted)] opacity-50" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--brand-text)]">No services configured</p>
            <p className="text-xs text-[var(--brand-muted)] mt-1 max-w-xs">
              Add services in Settings to see per-service performance and revenue attribution.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (perf.entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[var(--brand-muted)]" />
            Service Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--brand-muted)] text-center py-6">
            No service matches found in recent calls. As bookings come in, performance data will appear here.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[var(--brand-muted)]" />
            Service Performance
          </CardTitle>
          <ConfidenceBadge type="estimated" label="Keyword match" />
        </div>
        <CardDescription>
          Bookings and estimated revenue by service
          {perf.unmatchedBookings > 0 && (
            <span className="ml-1 text-amber-600 dark:text-amber-400">
              ({perf.unmatchedBookings} unmatched)
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-[var(--brand-border)]">
          {perf.entries.map((entry) => (
            <div key={entry.service.id} className="flex items-center gap-4 px-6 py-3">
              {/* Service name + category */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--brand-text)] truncate">
                  {entry.service.name}
                </p>
                {entry.service.category && (
                  <p className="text-[10px] text-[var(--brand-muted)] mt-0.5">
                    {entry.service.category}
                  </p>
                )}
              </div>

              {/* Bookings count */}
              <div className="text-right shrink-0 w-16">
                <p className="text-sm font-semibold text-[var(--brand-text)] tabular-nums">
                  {entry.bookedCount}
                </p>
                <p className="text-[10px] text-[var(--brand-muted)]">
                  {entry.bookingSharePercent}% of total
                </p>
              </div>

              {/* Revenue bar + value */}
              <div className="text-right shrink-0 w-28">
                <p className="text-sm font-semibold text-[var(--brand-text)] tabular-nums">
                  {formatCurrency(entry.revenueEstimateCents / 100, currency)}
                </p>
                {/* Mini progress bar */}
                <div className="mt-1 h-1 w-full rounded-full bg-[var(--brand-border)]">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.max(entry.revenueSharePercent, 2)}%`,
                      background: 'var(--brand-primary)',
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary footer */}
        <div className="flex items-center justify-between border-t border-[var(--brand-border)] px-6 py-3 bg-[var(--brand-surface)]/50">
          <span className="text-xs text-[var(--brand-muted)]">
            {perf.totalBookings} total bookings
          </span>
          <span className="text-xs font-medium text-[var(--brand-text)]">
            {formatCurrency(perf.totalRevenueCents / 100, currency)} estimated
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
