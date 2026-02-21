'use client'

import { useState, useCallback } from 'react'
import {
  Plus,
  Pencil,
  ChevronUp,
  ChevronDown,
  Trash2,
  Loader2,
  Tag,
  DollarSign,
  Clock,
  AlertCircle,
  PackageOpen,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ClientService } from '@/lib/types/domain'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ServicesPricingManagerProps {
  /** Initial service list fetched server-side */
  initialServices: ClientService[]
  currency: string
}

interface FormState {
  name: string
  category: string
  priceCents: string   // raw input; parsed on submit
  durationMin: string  // raw input; parsed on submit
}

const EMPTY_FORM: FormState = { name: '', category: '', priceCents: '', durationMin: '' }

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatPrice(cents: number | null, currency: string): string {
  if (cents === null) return 'Quote'
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(0)} ${currency.toUpperCase()}`
  }
}

// ── Service row ────────────────────────────────────────────────────────────────

function ServiceRow({
  service,
  currency,
  isFirst,
  isLast,
  onEdit,
  onDeactivate,
  onReorder,
  disabled,
}: {
  service: ClientService
  currency: string
  isFirst: boolean
  isLast: boolean
  onEdit: () => void
  onDeactivate: () => void
  onReorder: (dir: 'up' | 'down') => void
  disabled: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3',
        'border-b border-[var(--brand-border)] last:border-0',
        !service.isActive && 'opacity-50',
      )}
    >
      {/* Reorder arrows */}
      <div className="flex flex-col shrink-0">
        <button
          onClick={() => onReorder('up')}
          disabled={isFirst || disabled}
          className="p-0.5 rounded hover:bg-[var(--brand-border)]/60 disabled:opacity-20 disabled:cursor-not-allowed text-[var(--brand-muted)] transition-colors"
          title="Move up"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onReorder('down')}
          disabled={isLast || disabled}
          className="p-0.5 rounded hover:bg-[var(--brand-border)]/60 disabled:opacity-20 disabled:cursor-not-allowed text-[var(--brand-muted)] transition-colors"
          title="Move down"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Service info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-[var(--brand-text)] truncate">
            {service.name}
          </span>
          {!service.isActive && (
            <Badge variant="muted" className="text-[10px] py-0">
              Inactive
            </Badge>
          )}
          {service.category && (
            <span className="text-xs text-[var(--brand-muted)] flex items-center gap-1">
              <Tag className="h-3 w-3" />
              {service.category}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-xs text-[var(--brand-muted)] flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            {formatPrice(service.priceCents, currency)}
          </span>
          {service.durationMin && (
            <span className="text-xs text-[var(--brand-muted)] flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {service.durationMin} min
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onEdit}
          disabled={disabled}
          className="p-1.5 rounded hover:bg-[var(--brand-border)]/60 text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Edit service"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDeactivate}
          disabled={disabled || !service.isActive}
          className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 text-[var(--brand-muted)] hover:text-rose-600 dark:hover:text-rose-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Deactivate service"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Add / Edit dialog ──────────────────────────────────────────────────────────

function ServiceFormDialog({
  open,
  onClose,
  onSave,
  saving,
  formError,
  form,
  setForm,
  mode,
}: {
  open: boolean
  onClose: () => void
  onSave: () => void
  saving: boolean
  formError: string | null
  form: FormState
  setForm: (f: FormState) => void
  mode: 'add' | 'edit'
}) {
  function field(key: keyof FormState, value: string) {
    setForm({ ...form, [key]: value })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'add' ? 'Add service' : 'Edit service'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--brand-muted)]">
              Service name <span className="text-rose-500">*</span>
            </label>
            <Input
              placeholder="e.g. Botox — Forehead Lines"
              value={form.name}
              onChange={(e) => field('name', e.target.value)}
              autoFocus
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--brand-muted)]">
              Category <span className="text-[var(--brand-muted)] font-normal">(optional)</span>
            </label>
            <Input
              placeholder="e.g. Injectables, Laser, Skin Care"
              value={form.category}
              onChange={(e) => field('category', e.target.value)}
            />
          </div>

          {/* Price + Duration side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--brand-muted)]">
                Price ($ whole)
              </label>
              <Input
                type="number"
                min={0}
                step={1}
                placeholder="e.g. 299"
                value={form.priceCents}
                onChange={(e) => field('priceCents', e.target.value)}
              />
              <p className="text-[10px] text-[var(--brand-muted)]">Leave blank for quote-based</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--brand-muted)]">
                Duration (min)
              </label>
              <Input
                type="number"
                min={1}
                step={5}
                placeholder="e.g. 45"
                value={form.durationMin}
                onChange={(e) => field('durationMin', e.target.value)}
              />
            </div>
          </div>

          {formError && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/30 px-3 py-2 text-xs text-rose-700 dark:text-rose-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {formError}
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="brand"
            size="sm"
            disabled={saving || !form.name.trim()}
            onClick={onSave}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {saving ? 'Saving…' : mode === 'add' ? 'Add service' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ServicesPricingManager({ initialServices, currency }: ServicesPricingManagerProps) {
  const [services, setServices] = useState<ClientService[]>(initialServices)
  const [busy, setBusy] = useState<string | null>(null)   // id of row being mutated
  const [listError, setListError] = useState<string | null>(null)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // ── Open add / edit ──────────────────────────────────────────────────────────

  function openAdd() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setDialogMode('add')
    setFormError(null)
    setDialogOpen(true)
  }

  function openEdit(service: ClientService) {
    setForm({
      name: service.name,
      category: service.category ?? '',
      priceCents: service.priceCents !== null ? String(Math.round(service.priceCents / 100)) : '',
      durationMin: service.durationMin !== null ? String(service.durationMin) : '',
    })
    setEditingId(service.id)
    setDialogMode('edit')
    setFormError(null)
    setDialogOpen(true)
  }

  function closeDialog() {
    if (saving) return
    setDialogOpen(false)
    setEditingId(null)
    setFormError(null)
  }

  // ── Parse form ───────────────────────────────────────────────────────────────

  function parseForm(): { ok: false; error: string } | { ok: true; payload: Record<string, unknown> } {
    const name = form.name.trim()
    if (!name) return { ok: false, error: 'Service name is required.' }

    const rawPrice = form.priceCents.trim()
    let priceCents: number | null = null
    if (rawPrice) {
      const dollars = parseFloat(rawPrice)
      if (isNaN(dollars) || dollars < 0) return { ok: false, error: 'Price must be a positive number.' }
      priceCents = Math.round(dollars * 100)
    }

    const rawDur = form.durationMin.trim()
    let durationMin: number | null = null
    if (rawDur) {
      const d = parseInt(rawDur, 10)
      if (isNaN(d) || d < 1) return { ok: false, error: 'Duration must be at least 1 minute.' }
      durationMin = d
    }

    return {
      ok: true,
      payload: {
        name,
        category: form.category.trim() || null,
        priceCents,
        durationMin,
      },
    }
  }

  // ── Save (create or update) ──────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    const parsed = parseForm()
    if (!parsed.ok) { setFormError(parsed.error); return }
    setFormError(null)
    setSaving(true)

    try {
      if (dialogMode === 'add') {
        const res = await fetch('/api/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.payload),
        })
        const json = await res.json()
        if (!res.ok) { setFormError(json.error ?? 'Failed to create service.'); return }
        setServices((prev) => [...prev, json.service])
      } else {
        if (!editingId) return
        const res = await fetch(`/api/services/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.payload),
        })
        const json = await res.json()
        if (!res.ok) { setFormError(json.error ?? 'Failed to update service.'); return }
        setServices((prev) => prev.map((s) => s.id === editingId ? json.service : s))
      }
      closeDialog()
    } catch {
      setFormError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogMode, editingId, form])

  // ── Deactivate ───────────────────────────────────────────────────────────────

  async function handleDeactivate(id: string) {
    setBusy(id)
    setListError(null)
    try {
      const res = await fetch(`/api/services/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        setListError(json.error ?? 'Failed to deactivate service.')
        return
      }
      setServices((prev) => prev.map((s) => s.id === id ? { ...s, isActive: false } : s))
    } catch {
      setListError('Network error — please try again.')
    } finally {
      setBusy(null)
    }
  }

  // ── Reorder ──────────────────────────────────────────────────────────────────

  async function handleReorder(id: string, direction: 'up' | 'down') {
    setBusy(id)
    setListError(null)
    try {
      const res = await fetch(`/api/services/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reorder: direction }),
      })
      if (!res.ok) {
        const json = await res.json()
        setListError(json.error ?? 'Failed to reorder service.')
        return
      }
      // Optimistically swap in local state
      setServices((prev) => {
        const active = prev.filter((s) => s.isActive)
        const idx = active.findIndex((s) => s.id === id)
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1
        if (idx === -1 || swapIdx < 0 || swapIdx >= active.length) return prev

        const result = [...prev]
        const aIdx = result.findIndex((s) => s.id === active[idx].id)
        const bIdx = result.findIndex((s) => s.id === active[swapIdx].id)
        const aOrder = result[aIdx].sortOrder
        const bOrder = result[bIdx].sortOrder
        result[aIdx] = { ...result[aIdx], sortOrder: bOrder }
        result[bIdx] = { ...result[bIdx], sortOrder: aOrder }
        return [...result].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      })
    } catch {
      setListError('Network error — please try again.')
    } finally {
      setBusy(null)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const active = services.filter((s) => s.isActive)
  const inactive = services.filter((s) => !s.isActive)

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Services & Pricing</CardTitle>
              <CardDescription className="mt-1">
                Add or edit the services your practice offers. Price is used for revenue attribution.
              </CardDescription>
            </div>
            <Button variant="brand" size="sm" onClick={openAdd} className="shrink-0">
              <Plus className="h-3.5 w-3.5" />
              Add service
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {listError && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/30 px-3 py-2 mb-4 text-xs text-rose-700 dark:text-rose-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {listError}
            </div>
          )}

          {services.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-border)]/40">
                <PackageOpen className="h-6 w-6 text-[var(--brand-muted)] opacity-50" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--brand-text)]">No services yet</p>
                <p className="text-xs text-[var(--brand-muted)] mt-0.5 max-w-[240px] mx-auto">
                  Add your first service to start tracking revenue attribution.
                </p>
              </div>
              <Button variant="brand" size="sm" onClick={openAdd}>
                <Plus className="h-3.5 w-3.5" />
                Add your first service
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-[var(--brand-border)] overflow-hidden">
              {/* Active services */}
              {active.map((s, i) => (
                <ServiceRow
                  key={s.id}
                  service={s}
                  currency={currency}
                  isFirst={i === 0}
                  isLast={i === active.length - 1}
                  disabled={busy !== null}
                  onEdit={() => openEdit(s)}
                  onDeactivate={() => handleDeactivate(s.id)}
                  onReorder={(dir) => handleReorder(s.id, dir)}
                />
              ))}

              {/* Inactive services — collapsed section */}
              {inactive.length > 0 && (
                <div className="border-t border-[var(--brand-border)] bg-[var(--brand-bg)]/50 px-4 py-2">
                  <p className="text-[11px] text-[var(--brand-muted)] font-medium">
                    {inactive.length} inactive service{inactive.length !== 1 ? 's' : ''} hidden from active list
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit dialog */}
      <ServiceFormDialog
        open={dialogOpen}
        onClose={closeDialog}
        onSave={handleSave}
        saving={saving}
        formError={formError}
        form={form}
        setForm={setForm}
        mode={dialogMode}
      />
    </>
  )
}
