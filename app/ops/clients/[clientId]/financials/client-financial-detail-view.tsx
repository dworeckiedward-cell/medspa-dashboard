'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Info } from 'lucide-react'
import { OpsClientCommercialSnapshot } from '@/components/ops/ops-client-commercial-snapshot'
import { OpsClientSetupFeeCard } from '@/components/ops/ops-client-setup-fee-card'
import { OpsClientRetainerCard } from '@/components/ops/ops-client-retainer-card'
import { OpsClientPaymentsLedger } from '@/components/ops/ops-client-payments-ledger'
import { EditFinancialProfileDialog } from '@/components/ops/edit-financial-profile-dialog'
import { AddManualPaymentDialog } from '@/components/ops/add-manual-payment-dialog'
import type { ClientCommercialSnapshot, ClientFinancialProfile, ClientPaymentLog } from '@/lib/ops-financials/types'

interface ClientFinancialDetailViewProps {
  clientId: string
  clientName: string
  snapshot: ClientCommercialSnapshot
  profile: ClientFinancialProfile
  payments: ClientPaymentLog[]
}

export function ClientFinancialDetailView({
  clientId,
  clientName,
  snapshot,
  profile,
  payments,
}: ClientFinancialDetailViewProps) {
  const router = useRouter()
  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [addPaymentOpen, setAddPaymentOpen] = useState(false)

  const handleSaved = useCallback(() => {
    router.refresh()
  }, [router])

  return (
    <div className="space-y-6">
      {/* Commercial Snapshot + Edit profile button */}
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-sm font-semibold text-[var(--brand-text)]">Financial Profile</h2>
        <button
          type="button"
          onClick={() => setEditProfileOpen(true)}
          className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-1.5 text-xs font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:border-[var(--brand-primary)]/50 transition-colors"
        >
          Edit Profile
        </button>
      </div>

      {/* Top cards grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <OpsClientCommercialSnapshot snapshot={snapshot} />
        <OpsClientSetupFeeCard
          profile={profile}
          onEdit={() => setEditProfileOpen(true)}
        />
        <OpsClientRetainerCard
          profile={profile}
          onEdit={() => setEditProfileOpen(true)}
        />
      </div>

      {/* Payment ledger */}
      <OpsClientPaymentsLedger
        payments={payments}
        onAddPayment={() => setAddPaymentOpen(true)}
      />

      {/* Stripe-ready notice */}
      <div className="flex items-start gap-2 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3">
        <Info className="h-3.5 w-3.5 shrink-0 text-[var(--brand-muted)] mt-0.5" />
        <div className="text-[11px] text-[var(--brand-muted)] leading-relaxed space-y-1">
          <p>
            <strong>Stripe-ready:</strong> Payment logs support <code className="text-[10px] bg-[var(--brand-border)]/40 rounded px-1">source: &apos;stripe&apos;</code> and <code className="text-[10px] bg-[var(--brand-border)]/40 rounded px-1">external_payment_id</code> for
            future webhook sync. When connected:
          </p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><code className="text-[10px]">invoice.paid</code> → retainer/overage payment log + profile date updates</li>
            <li><code className="text-[10px]">checkout.session.completed</code> → setup fee payment log</li>
            <li><code className="text-[10px]">invoice.payment_failed</code> → failed log + overdue status</li>
          </ul>
        </div>
      </div>

      {/* Dialogs */}
      <EditFinancialProfileDialog
        open={editProfileOpen}
        onOpenChange={setEditProfileOpen}
        clientId={clientId}
        clientName={clientName}
        profile={profile}
        onSaved={handleSaved}
      />
      <AddManualPaymentDialog
        open={addPaymentOpen}
        onOpenChange={setAddPaymentOpen}
        clientId={clientId}
        clientName={clientName}
        onSaved={handleSaved}
      />
    </div>
  )
}
