'use client'

import { cn } from '@/lib/utils'
import type { PartnerCommission, CommissionStatus } from '@/lib/partners/types'

interface PartnerCommissionLedgerProps {
  commissions: PartnerCommission[]
}

const STATUS_CONFIG: Record<CommissionStatus, { label: string; bg: string; text: string }> = {
  pending: {
    label: 'Pending',
    bg: 'bg-gray-50 dark:bg-gray-950/30',
    text: 'text-gray-600 dark:text-gray-400',
  },
  eligible: {
    label: 'Eligible',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    text: 'text-blue-700 dark:text-blue-400',
  },
  approved: {
    label: 'Approved',
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    text: 'text-violet-700 dark:text-violet-400',
  },
  paid: {
    label: 'Paid',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  held: {
    label: 'Held',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-400',
  },
  canceled: {
    label: 'Canceled',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    text: 'text-rose-700 dark:text-rose-400',
  },
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function PartnerCommissionLedger({ commissions }: PartnerCommissionLedgerProps) {
  if (commissions.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-8 text-center">
        <p className="text-sm text-[var(--brand-muted)]">No commissions recorded</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[var(--brand-border)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--brand-border)] bg-[var(--brand-surface)]">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--brand-muted)]">Date</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--brand-muted)]">Basis</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-[var(--brand-muted)]">Revenue</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-[var(--brand-muted)]">Commission</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--brand-muted)]">Status</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--brand-muted)]">Client</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--brand-border)]">
            {commissions.map((c) => {
              const statusCfg = STATUS_CONFIG[c.status]
              return (
                <tr key={c.id} className="hover:bg-[var(--brand-surface)]/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-xs text-[var(--brand-muted)]">
                      {new Date(c.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-[var(--brand-text)] capitalize">
                      {c.basisType}
                    </span>
                    <span className="text-[10px] text-[var(--brand-muted)] ml-1">
                      {c.basisType === 'flat'
                        ? formatCents(c.basisValue)
                        : c.basisType === 'percent'
                          ? `${c.basisValue}%`
                          : `${formatCents(c.basisValue)} + %`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm tabular-nums text-[var(--brand-text)]">
                      {c.revenueAmountCents != null ? formatCents(c.revenueAmountCents) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm tabular-nums font-medium text-[var(--brand-text)]">
                      {formatCents(c.commissionAmountCents)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
                        statusCfg.bg,
                        statusCfg.text,
                      )}
                    >
                      {statusCfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-[var(--brand-muted)]">
                      {c.clientName ?? (c.clientId ? c.clientId.slice(0, 8) : '—')}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
