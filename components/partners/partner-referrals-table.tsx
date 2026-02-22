'use client'

import { cn } from '@/lib/utils'
import type { PartnerReferral, ReferralStatus } from '@/lib/partners/types'

interface PartnerReferralsTableProps {
  referrals: PartnerReferral[]
}

const STATUS_CONFIG: Record<ReferralStatus, { label: string; bg: string; text: string }> = {
  lead: {
    label: 'Lead',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    text: 'text-blue-700 dark:text-blue-400',
  },
  qualified: {
    label: 'Qualified',
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    text: 'text-violet-700 dark:text-violet-400',
  },
  won: {
    label: 'Won',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  lost: {
    label: 'Lost',
    bg: 'bg-gray-50 dark:bg-gray-950/30',
    text: 'text-gray-500 dark:text-gray-400',
  },
  duplicate: {
    label: 'Duplicate',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-400',
  },
  invalid: {
    label: 'Invalid',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    text: 'text-rose-700 dark:text-rose-400',
  },
}

export function PartnerReferralsTable({ referrals }: PartnerReferralsTableProps) {
  if (referrals.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-8 text-center">
        <p className="text-sm text-[var(--brand-muted)]">No referrals yet</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[var(--brand-border)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--brand-border)] bg-[var(--brand-surface)]">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--brand-muted)]">Lead</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--brand-muted)]">Status</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--brand-muted)]">Referred</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-[var(--brand-muted)]">Est. Value</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--brand-muted)]">Client</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--brand-border)]">
            {referrals.map((ref) => {
              const statusCfg = STATUS_CONFIG[ref.status]
              return (
                <tr key={ref.id} className="hover:bg-[var(--brand-surface)]/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--brand-text)] truncate">
                        {ref.leadName ?? 'Unnamed lead'}
                      </p>
                      {ref.leadEmail && (
                        <p className="text-[10px] text-[var(--brand-muted)]">{ref.leadEmail}</p>
                      )}
                    </div>
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
                      {new Date(ref.referredAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm tabular-nums text-[var(--brand-text)]">
                      {ref.estimatedValueCents != null
                        ? `$${(ref.estimatedValueCents / 100).toLocaleString()}`
                        : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-[var(--brand-muted)]">
                      {ref.clientName ?? (ref.clientId ? ref.clientId.slice(0, 8) : '—')}
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
