'use client'

/**
 * BookingProofTable — detailed proof of every AI-booked appointment.
 *
 * Shows each booked call with service attribution, revenue source,
 * and caller details. Designed for stakeholder-level proof that
 * the AI receptionist is generating real revenue.
 */

import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import {
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Phone,
  Tag,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import {
  computeBookingProof,
  filterLogsToWindow,
  type BookingProofEntry,
} from '@/lib/dashboard/roi-proof'
import type { CallLog } from '@/types/database'
import type { ClientService } from '@/lib/types/domain'

// ── Props ────────────────────────────────────────────────────────────────────

interface BookingProofTableProps {
  callLogs: CallLog[]
  services: ClientService[]
  currency?: string
  /** Days to include (default 30) */
  days?: number
}

// ── Revenue source badge ────────────────────────────────────────────────────

const SOURCE_CONFIG: Record<BookingProofEntry['revenueSource'], { label: string; variant: 'success' | 'warning' | 'muted' }> = {
  service_match:    { label: 'Service match',    variant: 'success' },
  booked_value:     { label: 'Reported',         variant: 'success' },
  potential_revenue:{ label: 'Estimated',         variant: 'warning' },
  none:             { label: 'No attribution',    variant: 'muted' },
}

// ── Component ────────────────────────────────────────────────────────────────

export function BookingProofTable({
  callLogs,
  services,
  currency = 'USD',
  days = 30,
}: BookingProofTableProps) {
  const [showAll, setShowAll] = useState(false)

  const proof = useMemo(() => {
    const windowLogs = filterLogsToWindow(callLogs, days)
    return computeBookingProof(windowLogs, services)
  }, [callLogs, services, days])

  const totalRevenue = proof.reduce((s, p) => s + p.revenueAttributed, 0)
  const displayEntries = showAll ? proof : proof.slice(0, 10)
  const hasMore = proof.length > 10

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-[var(--brand-muted)]" />
              Booking Proof
            </CardTitle>
            <CardDescription className="mt-0.5">
              {proof.length} appointment{proof.length !== 1 ? 's' : ''} booked by AI
              {' · '}
              {formatCurrency(totalRevenue, currency)} attributed revenue
              {' · '}
              Last {days} days
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {proof.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <CalendarCheck className="h-6 w-6 text-[var(--brand-muted)] opacity-40" />
            <p className="text-xs text-[var(--brand-muted)]">No bookings in this period</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--brand-border)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[var(--brand-border)] bg-[var(--brand-bg)]/50">
                      {['Date', 'Caller', 'Service', 'Revenue', 'Source', 'Lead Source'].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2 text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayEntries.map((entry) => (
                      <tr
                        key={entry.call.id}
                        className="border-b border-[var(--brand-border)] last:border-0 hover:bg-[var(--brand-bg)]/50 transition-colors"
                      >
                        <td className="px-3 py-2.5 text-[10px] text-[var(--brand-muted)] tabular-nums whitespace-nowrap">
                          {format(parseISO(entry.call.created_at), 'MMM d, h:mm a')}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-[var(--brand-text)] truncate max-w-[140px]">
                              {entry.call.caller_name ?? 'Unknown'}
                            </p>
                            {entry.call.caller_phone && (
                              <p className="text-[10px] text-[var(--brand-muted)] flex items-center gap-1">
                                <Phone className="h-2.5 w-2.5" />
                                {entry.call.caller_phone}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          {entry.matchedServiceName ? (
                            <div className="flex items-center gap-1">
                              <Tag className="h-2.5 w-2.5 text-[var(--brand-muted)]" />
                              <span className="text-xs text-[var(--brand-text)] truncate max-w-[120px]">
                                {entry.matchedServiceName}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-[var(--brand-muted)] italic truncate max-w-[120px] block">
                              {entry.call.semantic_title ?? '—'}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={cn(
                            'text-xs font-semibold tabular-nums',
                            entry.revenueAttributed > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--brand-muted)]',
                          )}>
                            {entry.revenueAttributed > 0
                              ? formatCurrency(entry.revenueAttributed, currency)
                              : '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant={SOURCE_CONFIG[entry.revenueSource].variant} className="text-[9px]">
                            {SOURCE_CONFIG[entry.revenueSource].label}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-[10px] text-[var(--brand-muted)] capitalize">
                            {entry.call.lead_source ?? '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Show more / less */}
            {hasMore && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="flex items-center gap-1 text-xs text-[var(--brand-primary)] hover:underline mx-auto"
              >
                {showAll ? (
                  <>Show less <ChevronUp className="h-3 w-3" /></>
                ) : (
                  <>Show all {proof.length} bookings <ChevronDown className="h-3 w-3" /></>
                )}
              </button>
            )}

            <p className="text-[10px] text-[var(--brand-muted)] opacity-60 flex items-center gap-1">
              <Info className="h-3 w-3 shrink-0" />
              Revenue attribution uses service catalog keyword matching. &quot;Reported&quot; values come directly from call log data.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
