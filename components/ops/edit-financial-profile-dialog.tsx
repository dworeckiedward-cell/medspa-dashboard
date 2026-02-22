'use client'

import { useState, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Loader2, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  SETUP_FEE_STATUS_LABELS,
  RETAINER_STATUS_LABELS,
} from '@/lib/ops-financials/types'
import type {
  ClientFinancialProfile,
  SetupFeeStatus,
  RetainerStatus,
  LtvMode,
} from '@/lib/ops-financials/types'

// ── Props ─────────────────────────────────────────────────────────────────

interface EditFinancialProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string
  clientName: string
  profile: ClientFinancialProfile
  onSaved: () => void
}

// ── Field components ──────────────────────────────────────────────────────

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-medium text-[var(--brand-text)]">{label}</label>
      {children}
    </div>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  className?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-1.5 text-xs text-[var(--brand-text)] placeholder:text-[var(--brand-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]',
        className,
      )}
    />
  )
}

type StatusOption<T extends string> = { value: T; label: string }

function StatusPills<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: StatusOption<T>[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors border',
            value === opt.value
              ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
              : 'border-[var(--brand-border)] text-[var(--brand-muted)] hover:border-[var(--brand-text)]/20',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── Setup Fee status options ──────────────────────────────────────────────

const SETUP_FEE_OPTIONS: StatusOption<SetupFeeStatus>[] = [
  { value: 'not_set', label: SETUP_FEE_STATUS_LABELS.not_set },
  { value: 'unpaid', label: SETUP_FEE_STATUS_LABELS.unpaid },
  { value: 'partial', label: SETUP_FEE_STATUS_LABELS.partial },
  { value: 'paid', label: SETUP_FEE_STATUS_LABELS.paid },
  { value: 'waived', label: SETUP_FEE_STATUS_LABELS.waived },
]

const RETAINER_OPTIONS: StatusOption<RetainerStatus>[] = [
  { value: 'not_set', label: RETAINER_STATUS_LABELS.not_set },
  { value: 'active_paid', label: RETAINER_STATUS_LABELS.active_paid },
  { value: 'due', label: RETAINER_STATUS_LABELS.due },
  { value: 'overdue', label: RETAINER_STATUS_LABELS.overdue },
  { value: 'partial', label: RETAINER_STATUS_LABELS.partial },
  { value: 'paused', label: RETAINER_STATUS_LABELS.paused },
  { value: 'canceled', label: RETAINER_STATUS_LABELS.canceled },
]

const LTV_MODE_OPTIONS: StatusOption<LtvMode>[] = [
  { value: 'auto', label: 'Auto (derived)' },
  { value: 'manual', label: 'Manual override' },
]

// ── Main component ────────────────────────────────────────────────────────

export function EditFinancialProfileDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  profile,
  onSaved,
}: EditFinancialProfileDialogProps) {
  // Form state
  const [ltvMode, setLtvMode] = useState<LtvMode>(profile.ltvMode)
  const [ltvManual, setLtvManual] = useState(profile.ltvManualAmount?.toString() ?? '')
  const [mrrIncluded, setMrrIncluded] = useState(profile.mrrIncluded)

  const [setupFeeAmount, setSetupFeeAmount] = useState(profile.setupFeeAmount?.toString() ?? '')
  const [setupFeeStatus, setSetupFeeStatus] = useState<SetupFeeStatus>(profile.setupFeeStatus)
  const [setupFeePaidAmount, setSetupFeePaidAmount] = useState(profile.setupFeePaidAmount?.toString() ?? '')
  const [setupFeeInvoicedAt, setSetupFeeInvoicedAt] = useState(profile.setupFeeInvoicedAt?.split('T')[0] ?? '')
  const [setupFeePaidAt, setSetupFeePaidAt] = useState(profile.setupFeePaidAt?.split('T')[0] ?? '')

  const [retainerAmount, setRetainerAmount] = useState(profile.retainerAmount?.toString() ?? '')
  const [retainerStatus, setRetainerStatus] = useState<RetainerStatus>(profile.retainerStatus)
  const [billingCycleDay, setBillingCycleDay] = useState(profile.billingCycleDay?.toString() ?? '')
  const [lastPaidAt, setLastPaidAt] = useState(profile.lastPaidAt?.split('T')[0] ?? '')
  const [nextDueAt, setNextDueAt] = useState(profile.nextDueAt?.split('T')[0] ?? '')
  const [billingNotes, setBillingNotes] = useState(profile.billingNotes ?? '')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)

    const payload: Record<string, unknown> = {
      ltvMode,
      ltvManualAmount: ltvManual ? parseFloat(ltvManual) : null,
      mrrIncluded,
      setupFeeAmount: setupFeeAmount ? parseFloat(setupFeeAmount) : null,
      setupFeeStatus,
      setupFeePaidAmount: setupFeePaidAmount ? parseFloat(setupFeePaidAmount) : null,
      setupFeeInvoicedAt: setupFeeInvoicedAt || null,
      setupFeePaidAt: setupFeePaidAt || null,
      retainerAmount: retainerAmount ? parseFloat(retainerAmount) : null,
      retainerStatus,
      billingCycleDay: billingCycleDay ? parseInt(billingCycleDay, 10) : null,
      lastPaidAt: lastPaidAt || null,
      nextDueAt: nextDueAt || null,
      billingNotes: billingNotes || null,
    }

    try {
      const res = await fetch(`/api/ops/financials/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to save')
      }

      onSaved()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }, [
    clientId, ltvMode, ltvManual, mrrIncluded,
    setupFeeAmount, setupFeeStatus, setupFeePaidAmount, setupFeeInvoicedAt, setupFeePaidAt,
    retainerAmount, retainerStatus, billingCycleDay, lastPaidAt, nextDueAt, billingNotes,
    onSaved, onOpenChange,
  ])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-xl">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-[var(--brand-border)] bg-[var(--brand-surface)]">
            <div>
              <Dialog.Title className="text-sm font-semibold text-[var(--brand-text)]">
                Edit Financial Profile
              </Dialog.Title>
              <Dialog.Description className="text-[11px] text-[var(--brand-muted)] mt-0.5">
                {clientName}
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded-lg p-1 hover:bg-[var(--brand-border)]/30 transition-colors">
              <X className="h-4 w-4 text-[var(--brand-muted)]" />
            </Dialog.Close>
          </div>

          <div className="p-5 space-y-5">
            {error && (
              <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-3 py-2">
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* LTV Section */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-[var(--brand-text)]">LTV Override</p>
              <FieldGroup label="LTV Mode">
                <StatusPills value={ltvMode} options={LTV_MODE_OPTIONS} onChange={setLtvMode} />
              </FieldGroup>
              {ltvMode === 'manual' && (
                <FieldGroup label="Manual LTV ($)">
                  <TextInput
                    type="number"
                    value={ltvManual}
                    onChange={setLtvManual}
                    placeholder="0.00"
                  />
                </FieldGroup>
              )}
            </div>

            {/* MRR */}
            <div className="flex items-center justify-between py-2 border-t border-[var(--brand-border)]">
              <div>
                <p className="text-xs font-medium text-[var(--brand-text)]">MRR Included</p>
                <p className="text-[10px] text-[var(--brand-muted)]">Count toward active MRR total</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={mrrIncluded}
                onClick={() => setMrrIncluded(!mrrIncluded)}
                className={cn(
                  'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                  mrrIncluded ? 'bg-emerald-500' : 'bg-[var(--brand-border)]',
                )}
              >
                <span className={cn(
                  'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition',
                  mrrIncluded ? 'translate-x-4' : 'translate-x-0',
                )} />
              </button>
            </div>

            {/* Setup Fee Section */}
            <div className="space-y-3 border-t border-[var(--brand-border)] pt-4">
              <p className="text-xs font-semibold text-[var(--brand-text)]">Setup Fee</p>
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="Amount ($)">
                  <TextInput type="number" value={setupFeeAmount} onChange={setSetupFeeAmount} placeholder="0.00" />
                </FieldGroup>
                <FieldGroup label="Paid Amount ($)">
                  <TextInput type="number" value={setupFeePaidAmount} onChange={setSetupFeePaidAmount} placeholder="0.00" />
                </FieldGroup>
              </div>
              <FieldGroup label="Status">
                <StatusPills value={setupFeeStatus} options={SETUP_FEE_OPTIONS} onChange={setSetupFeeStatus} />
              </FieldGroup>
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="Invoiced Date">
                  <TextInput type="date" value={setupFeeInvoicedAt} onChange={setSetupFeeInvoicedAt} />
                </FieldGroup>
                <FieldGroup label="Paid Date">
                  <TextInput type="date" value={setupFeePaidAt} onChange={setSetupFeePaidAt} />
                </FieldGroup>
              </div>
            </div>

            {/* Retainer Section */}
            <div className="space-y-3 border-t border-[var(--brand-border)] pt-4">
              <p className="text-xs font-semibold text-[var(--brand-text)]">Retainer</p>
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="Monthly Amount ($)">
                  <TextInput type="number" value={retainerAmount} onChange={setRetainerAmount} placeholder="0.00" />
                </FieldGroup>
                <FieldGroup label="Billing Cycle Day">
                  <TextInput type="number" value={billingCycleDay} onChange={setBillingCycleDay} placeholder="1–31" />
                </FieldGroup>
              </div>
              <FieldGroup label="Status">
                <StatusPills value={retainerStatus} options={RETAINER_OPTIONS} onChange={setRetainerStatus} />
              </FieldGroup>
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="Last Paid">
                  <TextInput type="date" value={lastPaidAt} onChange={setLastPaidAt} />
                </FieldGroup>
                <FieldGroup label="Next Due">
                  <TextInput type="date" value={nextDueAt} onChange={setNextDueAt} />
                </FieldGroup>
              </div>
            </div>

            {/* Notes */}
            <div className="border-t border-[var(--brand-border)] pt-4">
              <FieldGroup label="Billing Notes">
                <textarea
                  value={billingNotes}
                  onChange={(e) => setBillingNotes(e.target.value)}
                  placeholder="Internal billing notes..."
                  rows={2}
                  maxLength={2000}
                  className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-1.5 text-xs text-[var(--brand-text)] placeholder:text-[var(--brand-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] resize-none"
                />
              </FieldGroup>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--brand-border)] bg-[var(--brand-surface)]">
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
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
