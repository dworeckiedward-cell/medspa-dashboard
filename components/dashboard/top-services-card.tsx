'use client'

import { useState, useMemo } from 'react'
import { BarChart3, TrendingUp, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { computeTopBookedServices } from '@/lib/dashboard/revenue-attribution'
import type { CallLog } from '@/types/database'
import type { ClientService } from '@/lib/types/domain'
import { cn } from '@/lib/utils'

interface TopServicesCardProps {
  callLogs: CallLog[]
  services: ClientService[]
  currency: string
}

type Window = '7d' | '30d'

function filterByWindow(logs: CallLog[], window: Window): CallLog[] {
  const cutoff = Date.now() - (window === '7d' ? 7 : 30) * 24 * 60 * 60 * 1000
  return logs.filter((l) => Date.parse(l.created_at) >= cutoff)
}

function formatCents(cents: number): string {
  if (cents === 0) return '—'
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100)
  } catch {
    return `$${(cents / 100).toFixed(0)}`
  }
}

export function TopServicesCard({ callLogs, services, currency: _currency }: TopServicesCardProps) {
  const [window, setWindow] = useState<Window>('7d')

  const topServices = useMemo(() => {
    const filtered = filterByWindow(callLogs, window)
    return computeTopBookedServices(filtered, services, 5)
  }, [callLogs, services, window])

  const maxCount = topServices[0]?.bookedCount ?? 1

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[var(--brand-muted)]" />
            Top Services Booked
          </CardTitle>

          {/* 7d / 30d toggle */}
          <div className="flex items-center gap-0.5 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-0.5 text-xs">
            {(['7d', '30d'] as const).map((w) => (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className={cn(
                  'px-2.5 py-1 rounded-md font-medium transition-colors duration-100',
                  window === w
                    ? 'bg-[var(--brand-surface)] text-[var(--brand-text)] shadow-sm'
                    : 'text-[var(--brand-muted)] hover:text-[var(--brand-text)]',
                )}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-[var(--brand-muted)] mt-0.5">
          Estimated from booked call keyword matching
        </p>
      </CardHeader>

      <CardContent className="pt-0">
        {topServices.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-border)]/40">
              <TrendingUp className="h-5 w-5 text-[var(--brand-muted)] opacity-50" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--brand-text)]">No data for this period</p>
              <p className="text-xs text-[var(--brand-muted)] mt-0.5 max-w-[200px] mx-auto">
                Add services in Settings to start seeing attribution.
              </p>
            </div>
            <a
              href="/dashboard/settings"
              className="flex items-center gap-1 text-xs font-medium text-[var(--brand-primary)] hover:underline"
            >
              <Plus className="h-3 w-3" />
              Add services
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {topServices.map(({ service, bookedCount, revenueEstimateCents }, i) => {
              const barPct = Math.round((bookedCount / maxCount) * 100)
              return (
                <div key={service.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono text-[var(--brand-muted)] w-4 shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-xs font-medium text-[var(--brand-text)] truncate">
                        {service.name}
                      </span>
                      {service.category && (
                        <span className="text-[10px] text-[var(--brand-muted)] shrink-0">
                          {service.category}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-[var(--brand-muted)]">
                        {bookedCount} booked
                      </span>
                      <span className="text-xs font-medium text-[var(--brand-text)] font-mono">
                        {formatCents(revenueEstimateCents)}
                      </span>
                    </div>
                  </div>

                  {/* Bar */}
                  <div className="h-1.5 w-full rounded-full bg-[var(--brand-border)]/40 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--brand-primary)]/70 transition-all duration-300"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
