'use client'

import { useState, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PAYMENT_TYPE_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/ops-financials/types'
import type { PaymentType, PaymentStatus } from '@/lib/ops-financials/types'

// ── Props ─────────────────────────────────────────────────────────────────

interface AddManualPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string
  clientName: string
  onSaved: () => void
}

// ── Option types ──────────────────────────────────────────────────────────

type PillOption<T extends string> = { value: T; label: string }

const PAYMENT_TYPE_OPTIONS: PillOption<PaymentType>[] = [
  { value: 'setup_fee', label: PAYMENT_TYPE_LABELS.setup_fee },
  { value: 'retainer', label: PAYMENT_TYPE_LABELS.retainer },
  { value: 'overage', label: PAYMENT_TYPE_LABELS.overage },
  { value: 'other', label: PAYMENT_TYPE_LABELS.other },
]

const PAYMENT_STATUS_OPTIONS: PillOption<PaymentStatus>[] = [
  { value: 'paid', label: PAYMENT_STATUS_LABELS.paid },
  { value: 'pending', label: PAYMENT_STATUS_LABELS.pending },
  { value: 'partial', label: PAYMENT_STATUS_LABELS.partial },
  { value: 'failed', label: PAYMENT_STATUS_LABELS.failed },
  { value: 'refunded', label: PAYMENT_STATUS_LABELS.refunded },
]

// ── Main component ────────────────────────────────────────────────────────

export function AddManualPaymentDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  onSaved,
}: AddManualPaymentDialogProps) {
  const [paymentType, setPaymentType] = useState<PaymentType>('retainer')
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState<PaymentStatus>('paid')
  const [paidAt, setPaidAt] = useState(new Date().toISOString().split('T')[0])
  const [dueAt, setDueAt] = useState('')
  const [notes, setNotes] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Amount must be positive')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/ops/financials/${clientId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentType,
          amount: parseFloat(amount),
          status,
          paidAt: paidAt || null,
          dueAt: dueAt || null,
          notes: notes || null,
          source: 'manual',
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to create payment')
      }

      // Reset form
      setAmount('')
      setNotes('')
      onSaved()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create payment')
    } finally {
      setSaving(false)
    }
  }, [clientId, paymentType, amount, status, paidAt, dueAt, notes, onSaved, onOpenChange])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--brand-border)]">
            <div>
              <Dialog.Title className="text-sm font-semibold text-[var(--brand-text)]">
                Add Manual Payment
              </Dialog.Title>
              <Dialog.Description className="text-[11px] text-[var(--brand-muted)] mt-0.5">
                {clientName} · Source: Manual
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded-lg p-1 hover:bg-[var(--brand-border)]/30 transition-colors">
              <X className="h-4 w-4 text-[var(--brand-muted)]" />
            </Dialog.Close>
          </div>

          <div className="p-5 space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-3 py-2">
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Payment Type */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium text-[var(--brand-text)]">Payment Type</label>
              <div className="flex flex-wrap gap-1.5">
                {PAYMENT_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPaymentType(opt.value)}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors border',
                      paymentType === opt.value
                        ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                        : 'border-[var(--brand-border)] text-[var(--brand-muted)] hover:border-[var(--brand-text)]/20',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium text-[var(--brand-text)]">Amount (USD)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-1.5 text-xs text-[var(--brand-text)] placeholder:text-[var(--brand-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
              />
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium text-[var(--brand-text)]">Status</label>
              <div className="flex flex-wrap gap-1.5">
                {PAYMENT_STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors border',
                      status === opt.value
                        ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                        : 'border-[var(--brand-border)] text-[var(--brand-muted)] hover:border-[var(--brand-text)]/20',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-[var(--brand-text)]">
                  {status === 'paid' ? 'Paid Date' : 'Paid Date (optional)'}
                </label>
                <input
                  type="date"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                  className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-1.5 text-xs text-[var(--brand-text)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-[var(--brand-text)]">Due Date (optional)</label>
                <input
                  type="date"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-1.5 text-xs text-[var(--brand-text)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium text-[var(--brand-text)]">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Payment notes..."
                rows={2}
                maxLength={1000}
                className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-1.5 text-xs text-[var(--brand-text)] placeholder:text-[var(--brand-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--brand-border)]">
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-lg border border-[var(--brand-border)] px-3 py-1.5 text-xs font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !amount}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              {saving ? 'Adding...' : 'Add Payment'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
