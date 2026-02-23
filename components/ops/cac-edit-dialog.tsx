'use client'

import { useState } from 'react'
import { Loader2, DollarSign, Calendar, Tag, FileText, TrendingUp } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { CAC_SOURCE_LABELS, CAC_SOURCE_COLORS } from '@/lib/ops/unit-economics/types'
import type { CacSource, ClientUnitEconomics } from '@/lib/ops/unit-economics/types'

// ── Props ───────────────────────────────────────────────────────────────────

interface CacEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientEconomics: ClientUnitEconomics
  onSaved: () => void
}

const CAC_SOURCES: CacSource[] = ['ads', 'outbound', 'referral', 'organic', 'mixed', 'other']

// ── Component ───────────────────────────────────────────────────────────────

export function CacEditDialog({ open, onOpenChange, clientEconomics, onSaved }: CacEditDialogProps) {
  const [cacAmount, setCacAmount] = useState<string>(
    clientEconomics.cacAmount !== null ? String(clientEconomics.cacAmount) : '',
  )
  const [cacSource, setCacSource] = useState<CacSource | null>(clientEconomics.cacSource)
  const [cacNotes, setCacNotes] = useState(clientEconomics.cacNotes ?? '')
  const [acquiredDate, setAcquiredDate] = useState(
    clientEconomics.acquiredAt ? clientEconomics.acquiredAt.split('T')[0] : '',
  )
  const [ltvAmount, setLtvAmount] = useState<string>(
    clientEconomics.manualLtvUsd !== null && clientEconomics.ltvMode === 'manual'
      ? String(clientEconomics.manualLtvUsd)
      : '',
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    const cac = cacAmount.trim() === '' ? null : parseFloat(cacAmount)
    if (cac !== null && (isNaN(cac) || cac < 0)) {
      setError('CAC amount must be a positive number')
      setSaving(false)
      return
    }

    const ltv = ltvAmount.trim() === '' ? null : parseFloat(ltvAmount)
    if (ltv !== null && (isNaN(ltv) || ltv < 0)) {
      setError('LTV amount must be a positive number')
      setSaving(false)
      return
    }

    try {
      // Single API call for CAC + LTV (both stored in client_unit_economics)
      const payload = {
        cacUsd: cac,
        ltvUsd: ltv,
        ltvMode: ltv !== null ? 'manual' : 'auto',
        acquisitionSource: cacSource,
        acquiredDate: acquiredDate || null,
        notes: cacNotes.trim() || null,
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('[cac-dialog] Saving:', { clientId: clientEconomics.clientId, payload })
      }

      const res = await fetch(`/api/ops/unit-economics/${clientEconomics.clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))

      if (process.env.NODE_ENV === 'development') {
        console.log('[cac-dialog] Response:', { status: res.status, data })
      }

      if (!res.ok) {
        const detail = data.details
          ? ` (${JSON.stringify(data.details)})`
          : ''
        throw new Error((data.error ?? 'Failed to save') + detail)
      }

      onSaved()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/ops/unit-economics/${clientEconomics.clientId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Failed to clear')
      }

      onSaved()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Edit CAC & LTV — {clientEconomics.clientName}</DialogTitle>
          <DialogDescription className="text-xs">
            Set acquisition cost and lifetime value for internal financial tracking.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-3 py-2">
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* CAC + LTV side by side */}
          <div className="grid grid-cols-2 gap-3">
            {/* CAC Amount */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--brand-text)]">
                <DollarSign className="h-3.5 w-3.5 text-[var(--brand-muted)]" />
                CAC (USD)
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 500"
                value={cacAmount}
                onChange={(e) => setCacAmount(e.target.value)}
                disabled={saving}
                className="h-9"
              />
            </div>

            {/* LTV Amount */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--brand-text)]">
                <TrendingUp className="h-3.5 w-3.5 text-[var(--brand-muted)]" />
                LTV (USD)
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Manual override"
                value={ltvAmount}
                onChange={(e) => setLtvAmount(e.target.value)}
                disabled={saving}
                className="h-9"
              />
              <p className="text-[9px] text-[var(--brand-muted)]">
                Leave empty for auto-derived LTV
              </p>
            </div>
          </div>

          {/* CAC Source */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--brand-text)]">
              <Tag className="h-3.5 w-3.5 text-[var(--brand-muted)]" />
              Acquisition Source
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CAC_SOURCES.map((source) => (
                <button
                  key={source}
                  type="button"
                  onClick={() => setCacSource(cacSource === source ? null : source)}
                  disabled={saving}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium transition-colors border',
                    cacSource === source
                      ? 'border-transparent text-white'
                      : 'border-[var(--brand-border)] text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:border-[var(--brand-text)]/20',
                  )}
                  style={cacSource === source ? { backgroundColor: CAC_SOURCE_COLORS[source] } : undefined}
                >
                  {CAC_SOURCE_LABELS[source]}
                </button>
              ))}
            </div>
          </div>

          {/* Acquired Date */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--brand-text)]">
              <Calendar className="h-3.5 w-3.5 text-[var(--brand-muted)]" />
              Acquired Date (optional)
            </label>
            <Input
              type="date"
              value={acquiredDate}
              onChange={(e) => setAcquiredDate(e.target.value)}
              disabled={saving}
              className="h-9"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--brand-text)]">
              <FileText className="h-3.5 w-3.5 text-[var(--brand-muted)]" />
              Notes (optional)
            </label>
            <textarea
              value={cacNotes}
              onChange={(e) => setCacNotes(e.target.value)}
              placeholder="Any context about this acquisition..."
              rows={2}
              disabled={saving}
              className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-2 text-xs text-[var(--brand-text)] placeholder:text-[var(--brand-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-[var(--brand-border)]">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={saving || clientEconomics.cacAmount === null}
              className="text-xs text-[var(--brand-muted)] hover:text-red-600"
            >
              Clear CAC
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={saving}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="brand"
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="text-xs"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
