'use client'

/**
 * MissedCallRecoveryCard — shows missed calls that were recovered.
 *
 * Identifies inbound calls with disposition = 'no_answer' | 'voicemail'
 * where a later call to the same phone resulted in a booking.
 * This demonstrates the value of outbound follow-up and AI persistence.
 */

import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import {
  PhoneOff,
  PhoneIncoming,
  ArrowRight,
  DollarSign,
  Clock,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import {
  computeMissedCallRecovery,
  filterLogsToWindow,
} from '@/lib/dashboard/roi-proof'
import type { CallLog } from '@/types/database'

// ── Props ────────────────────────────────────────────────────────────────────

interface MissedCallRecoveryCardProps {
  callLogs: CallLog[]
  currency?: string
  /** Days to include (default 30) */
  days?: number
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatRecoveryTime(ms: number): string {
  const hours = ms / 3_600_000
  if (hours < 1) return `${Math.round(ms / 60_000)}min`
  if (hours < 24) return `${Math.round(hours)}h`
  return `${Math.round(hours / 24)}d`
}

// ── Component ────────────────────────────────────────────────────────────────

export function MissedCallRecoveryCard({
  callLogs,
  currency = 'USD',
  days = 30,
}: MissedCallRecoveryCardProps) {
  const recovery = useMemo(() => {
    const windowLogs = filterLogsToWindow(callLogs, days)
    return computeMissedCallRecovery(windowLogs)
  }, [callLogs, days])

  const avgRecoveryTime = recovery.recoveredCalls.length > 0
    ? recovery.recoveredCalls.reduce((s, r) => s + r.recoveryTimeMs, 0) / recovery.recoveredCalls.length
    : 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <PhoneOff className="h-4 w-4 text-[var(--brand-muted)]" />
            Missed Call Recovery
          </CardTitle>
          <CardDescription className="mt-0.5">
            Revenue recovered from missed calls via outbound follow-up · Last {days} days
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {recovery.totalMissed === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <PhoneOff className="h-6 w-6 text-[var(--brand-muted)] opacity-40" />
            <p className="text-xs text-[var(--brand-muted)]">No missed calls in this period</p>
            <p className="text-[10px] text-[var(--brand-muted)] opacity-60">
              Great — all calls were handled by AI.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-[var(--brand-border)] p-3 text-center">
                <p className="text-lg font-bold text-[var(--brand-text)] tabular-nums">{recovery.totalMissed}</p>
                <p className="text-[10px] text-[var(--brand-muted)]">Missed calls</p>
              </div>
              <div className="rounded-lg border border-[var(--brand-border)] p-3 text-center">
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {recovery.recoveredCalls.length}
                </p>
                <p className="text-[10px] text-[var(--brand-muted)]">Recovered</p>
              </div>
              <div className="rounded-lg border border-[var(--brand-border)] p-3 text-center">
                <p className="text-lg font-bold text-[var(--brand-text)] tabular-nums">{recovery.recoveryRate}%</p>
                <p className="text-[10px] text-[var(--brand-muted)]">Recovery rate</p>
              </div>
              <div className="rounded-lg border border-[var(--brand-border)] p-3 text-center">
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatCurrency(recovery.totalRecoveredRevenue, currency)}
                </p>
                <p className="text-[10px] text-[var(--brand-muted)]">Revenue recovered</p>
              </div>
            </div>

            {/* Recovery timeline */}
            {recovery.recoveredCalls.length > 0 && (
              <div className="rounded-xl border border-[var(--brand-border)] overflow-hidden divide-y divide-[var(--brand-border)]">
                {recovery.recoveredCalls.slice(0, 8).map((r) => (
                  <div key={r.missedCall.id} className="flex items-center gap-3 px-3 py-2.5">
                    {/* Missed call */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <PhoneOff className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-[var(--brand-text)] truncate">
                          {r.missedCall.caller_name ?? r.missedCall.caller_phone ?? 'Unknown'}
                        </p>
                        <p className="text-[10px] text-[var(--brand-muted)]">
                          {format(parseISO(r.missedCall.created_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>

                    {/* Arrow + recovery time */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <ArrowRight className="h-3 w-3 text-[var(--brand-muted)]" />
                      <Badge variant="muted" className="text-[9px] gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {formatRecoveryTime(r.recoveryTimeMs)}
                      </Badge>
                      <ArrowRight className="h-3 w-3 text-[var(--brand-muted)]" />
                    </div>

                    {/* Recovered booking */}
                    <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                      <div className="min-w-0 text-right">
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium truncate">
                          Booked
                        </p>
                        <p className="text-[10px] text-[var(--brand-muted)]">
                          {format(parseISO(r.bookedCall.created_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                      <PhoneIncoming className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    </div>

                    {/* Revenue */}
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0 ml-2">
                      {(r.bookedCall.booked_value ?? r.bookedCall.potential_revenue ?? 0) > 0
                        ? formatCurrency(r.bookedCall.booked_value ?? r.bookedCall.potential_revenue ?? 0, currency)
                        : '—'}
                    </span>
                  </div>
                ))}

                {recovery.recoveredCalls.length > 8 && (
                  <p className="px-3 py-2 text-[10px] text-[var(--brand-muted)] text-center">
                    +{recovery.recoveredCalls.length - 8} more recovered calls
                  </p>
                )}
              </div>
            )}

            {/* Avg recovery time */}
            {avgRecoveryTime > 0 && (
              <p className="text-[10px] text-[var(--brand-muted)] flex items-center gap-1">
                <Clock className="h-3 w-3 shrink-0" />
                Average recovery time: {formatRecoveryTime(avgRecoveryTime)}
              </p>
            )}

            <p className="text-[10px] text-[var(--brand-muted)] opacity-60 flex items-center gap-1">
              <Info className="h-3 w-3 shrink-0" />
              Recovery detected by matching missed calls to later bookings from the same phone number (estimated).
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
