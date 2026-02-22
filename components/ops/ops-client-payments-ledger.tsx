'use client'

import { CreditCard, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMoney, formatShortDate } from '@/lib/ops-financials/format'
import {
  PAYMENT_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  PAYMENT_SOURCE_LABELS,
} from '@/lib/ops-financials/types'
import type { ClientPaymentLog, PaymentStatus } from '@/lib/ops-financials/types'

interface OpsClientPaymentsLedgerProps {
  payments: ClientPaymentLog[]
  onAddPayment?: () => void
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  const colors = PAYMENT_STATUS_COLORS[status]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium', colors.bg, colors.text)}>
      <span className={cn('h-1 w-1 rounded-full', colors.dot)} />
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  )
}

export function OpsClientPaymentsLedger({ payments, onAddPayment }: OpsClientPaymentsLedgerProps) {
  return (
    <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--brand-border)]">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
            <CreditCard className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--brand-text)]">Payment History</h3>
          <span className="text-[10px] text-[var(--brand-muted)]">
            {payments.length} {payments.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
        {onAddPayment && (
          <button
            type="button"
            onClick={onAddPayment}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-2.5 py-1 text-[10px] font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:border-[var(--brand-primary)]/50 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add Payment
          </button>
        )}
      </div>

      {payments.length === 0 ? (
        <div className="px-5 py-6 text-center">
          <p className="text-xs text-[var(--brand-muted)]">
            No payment records yet. Add a manual entry to start tracking.
          </p>
        </div>
      ) : (
        <>
          {/* Table header */}
          <div className="grid grid-cols-[1fr_80px_80px_60px_70px] gap-2 px-5 py-2 border-b border-[var(--brand-border)] bg-[var(--brand-bg)]/50">
            <span className="text-[10px] font-medium text-[var(--brand-muted)]">Date</span>
            <span className="text-[10px] font-medium text-[var(--brand-muted)]">Type</span>
            <span className="text-[10px] font-medium text-[var(--brand-muted)] text-right">Amount</span>
            <span className="text-[10px] font-medium text-[var(--brand-muted)] text-center">Status</span>
            <span className="text-[10px] font-medium text-[var(--brand-muted)] text-right">Source</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-[var(--brand-border)] max-h-64 overflow-y-auto">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="grid grid-cols-[1fr_80px_80px_60px_70px] gap-2 px-5 py-2 hover:bg-[var(--brand-border)]/10 transition-colors"
              >
                <div>
                  <span className="text-xs text-[var(--brand-text)]">
                    {formatShortDate(payment.paidAt ?? payment.createdAt)}
                  </span>
                  {payment.notes && (
                    <span className="block text-[10px] text-[var(--brand-muted)] truncate max-w-[160px]">
                      {payment.notes}
                    </span>
                  )}
                </div>
                <span className="text-xs text-[var(--brand-text)] self-center">
                  {PAYMENT_TYPE_LABELS[payment.paymentType]}
                </span>
                <span className="text-xs font-medium tabular-nums text-[var(--brand-text)] text-right self-center">
                  {formatMoney(payment.amount)}
                </span>
                <div className="flex justify-center self-center">
                  <StatusBadge status={payment.status} />
                </div>
                <span className="text-[10px] text-[var(--brand-muted)] text-right self-center">
                  {PAYMENT_SOURCE_LABELS[payment.source]}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
