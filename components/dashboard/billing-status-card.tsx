'use client'

import { ExternalLink, CreditCard, Calendar, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  getDaysRemaining,
  formatDaysRemaining,
  getBillingStatusConfig,
  formatBillingAmount,
} from '@/lib/dashboard/billing'
import type { BillingSummary } from '@/lib/types/domain'
import { cn } from '@/lib/utils'

interface BillingStatusCardProps {
  billing: BillingSummary | null
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-[var(--brand-border)] last:border-0">
      <span className="text-xs text-[var(--brand-muted)] shrink-0">{label}</span>
      <div className="text-xs font-medium text-[var(--brand-text)] text-right">{children}</div>
    </div>
  )
}

export function BillingStatusCard({ billing }: BillingStatusCardProps) {
  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!billing) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-[var(--brand-muted)]" />
            Billing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-border)]/40">
              <CreditCard className="h-5 w-5 text-[var(--brand-muted)] opacity-50" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--brand-text)]">No billing configured</p>
              <p className="text-xs text-[var(--brand-muted)] mt-0.5">
                Contact support to set up your subscription.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const statusConfig = getBillingStatusConfig(billing.status)
  const days = getDaysRemaining(billing.nextBillingAt)
  const daysLabel = formatDaysRemaining(days)
  const isUrgent = days !== null && days <= 3

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-[var(--brand-muted)]" />
            Billing
          </CardTitle>
          <Badge variant={statusConfig.variant as 'success' | 'warning' | 'destructive' | 'muted' | 'brand'}>
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-1 mb-4">
          <Row label="Plan">
            <span className="flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-[var(--brand-primary)]" />
              {billing.planName}
            </span>
          </Row>

          <Row label="Amount">
            {formatBillingAmount(billing.amountCents, billing.currency)}
            <span className="text-[var(--brand-muted)] font-normal ml-1">/ {billing.interval}</span>
          </Row>

          {billing.nextBillingAt && (
            <Row label="Next renewal">
              <span className="flex items-center gap-2">
                <Calendar className="h-3 w-3 text-[var(--brand-muted)]" />
                {new Date(billing.nextBillingAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
                <span
                  className={cn(
                    'text-[10px] font-normal px-1.5 py-0.5 rounded-full',
                    isUrgent
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                      : 'text-[var(--brand-muted)]',
                  )}
                >
                  {daysLabel}
                </span>
              </span>
            </Row>
          )}

          {billing.paymentMethodLast4 && (
            <Row label="Payment method">
              <span className="flex items-center gap-1.5">
                <span className="capitalize">{billing.paymentMethodBrand ?? 'Card'}</span>
                <span className="font-mono tracking-widest">••••&nbsp;{billing.paymentMethodLast4}</span>
              </span>
            </Row>
          )}
        </div>

        {/* Manage billing CTA */}
        <a
          href={billing.customerPortalUrl ?? '#'}
          target={billing.customerPortalUrl ? '_blank' : undefined}
          rel="noopener noreferrer"
          aria-disabled={!billing.customerPortalUrl}
          className={cn(
            'flex items-center justify-center gap-1.5 w-full rounded-lg py-2 text-xs font-medium transition-colors duration-150',
            billing.customerPortalUrl
              ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/20 border border-[var(--brand-primary)]/20'
              : 'bg-[var(--brand-border)]/40 text-[var(--brand-muted)] cursor-not-allowed border border-[var(--brand-border)]',
          )}
        >
          Manage Billing
          {billing.customerPortalUrl && <ExternalLink className="h-3 w-3" />}
        </a>
      </CardContent>
    </Card>
  )
}
