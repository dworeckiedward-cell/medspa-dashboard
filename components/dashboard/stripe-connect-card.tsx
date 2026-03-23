'use client'

import { useState } from 'react'
import { CreditCard, CheckCircle2, ExternalLink, AlertCircle, Loader2 } from 'lucide-react'

interface StripeConnectCardProps {
  tenantId: string
  isConnected: boolean
  accountId: string | null
}

export function StripeConnectCard({ tenantId, isConnected: initialConnected, accountId }: StripeConnectCardProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isConnected] = useState(initialConnected)

  async function handleConnect() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/connect/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error ?? 'Failed to start onboarding')
        setLoading(false)
      }
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#635BFF]/10 shrink-0">
            <CreditCard className="h-4 w-4 text-[#635BFF]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--brand-text)]">Payment Account</p>
            <p className="text-xs text-[var(--brand-muted)] mt-0.5">
              {isConnected
                ? 'Stripe Connect active — patients pay online, funds transfer to your bank'
                : 'Connect your Stripe account to accept online payments from the booking page'}
            </p>
          </div>
        </div>
        {isConnected && (
          <div className="flex items-center gap-1.5 shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" />
            Connected
          </div>
        )}
      </div>

      {!isConnected && (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-amber-800">Payments not connected</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Bookings are saved, but patients cannot pay online. Collect payment at the clinic until connected.
                </p>
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            onClick={handleConnect}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-[#635BFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#4F46E5] disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            {loading ? 'Opening Stripe…' : 'Connect Payment Account'}
          </button>

          <p className="text-xs text-[var(--brand-muted)]">
            Takes 3 minutes. Need: business name, bank account, and ID. Powered by Stripe Express.
          </p>
        </div>
      )}

      {isConnected && accountId && (
        <div className="mt-3 flex items-center justify-between border-t border-[var(--brand-border)] pt-3">
          <span className="text-xs text-[var(--brand-muted)] font-mono">{accountId.slice(0, 14)}…</span>
          <button
            onClick={handleConnect}
            disabled={loading}
            className="text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors disabled:opacity-50"
          >
            {loading ? 'Opening…' : 'Manage account →'}
          </button>
        </div>
      )}
    </div>
  )
}
