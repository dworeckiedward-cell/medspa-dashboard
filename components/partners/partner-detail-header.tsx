'use client'

import { ArrowLeft, Mail, Calendar, Hash } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Partner, PartnerSummary } from '@/lib/partners/types'
import type { PartnerStatus } from '@/lib/partners/types'

interface PartnerDetailHeaderProps {
  summary: PartnerSummary
}

const STATUS_BADGE: Record<PartnerStatus, { label: string; bg: string; text: string }> = {
  active: {
    label: 'Active',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  paused: {
    label: 'Paused',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-400',
  },
  onboarding: {
    label: 'Onboarding',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    text: 'text-blue-700 dark:text-blue-400',
  },
  blocked: {
    label: 'Blocked',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    text: 'text-rose-700 dark:text-rose-400',
  },
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function PartnerDetailHeader({ summary }: PartnerDetailHeaderProps) {
  const { partner } = summary
  const badge = STATUS_BADGE[partner.status]

  return (
    <div className="space-y-4">
      {/* Back link */}
      <a
        href="/ops/partners"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Partners
      </a>

      {/* Header card */}
      <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Left — Partner info */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 text-sm font-bold">
                {partner.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-lg font-semibold text-[var(--brand-text)]">
                  {partner.name}
                </h1>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
                    badge.bg,
                    badge.text,
                  )}
                >
                  {badge.label}
                </span>
              </div>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--brand-muted)]">
              <span className="capitalize">{partner.type}</span>
              {partner.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {partner.email}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Hash className="h-3 w-3" />
                {partner.referralCode}
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Joined {new Date(partner.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Right — Quick stats */}
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-xl font-bold text-[var(--brand-text)] tabular-nums">
                {summary.referralCount}
              </p>
              <p className="text-[10px] text-[var(--brand-muted)]">Referrals</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-[var(--brand-text)] tabular-nums">
                {summary.clientCount}
              </p>
              <p className="text-[10px] text-[var(--brand-muted)]">Clients</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-[var(--brand-text)] tabular-nums">
                {summary.closeRate}%
              </p>
              <p className="text-[10px] text-[var(--brand-muted)]">Close rate</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatCents(summary.paidCommissionCents)}
              </p>
              <p className="text-[10px] text-[var(--brand-muted)]">Paid</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
