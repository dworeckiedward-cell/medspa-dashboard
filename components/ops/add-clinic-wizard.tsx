'use client'

import { useState, useCallback, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  X,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Check,
  Globe,
  Building2,
  Bot,
  DollarSign,
  Rocket,
  Phone,
  Stethoscope,
  Megaphone,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Props ────────────────────────────────────────────────────────────────────

interface AddClinicWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (tenantId: string) => void
}

// ── Steps ────────────────────────────────────────────────────────────────────

const STEPS = [
  { key: 'basics', label: 'Basics', icon: Building2 },
  { key: 'ai', label: 'AI Config', icon: Bot },
  { key: 'commercials', label: 'Commercials', icon: DollarSign },
  { key: 'review', label: 'Create', icon: Rocket },
] as const

type StepKey = (typeof STEPS)[number]['key']

// ── Slug helper ──────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

// ── Field component ──────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-medium text-[var(--brand-text)]">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-[var(--brand-muted)]">{hint}</p>}
    </div>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-1.5 text-xs text-[var(--brand-text)] placeholder:text-[var(--brand-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
    />
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function AddClinicWizard({ open, onOpenChange, onCreated }: AddClinicWizardProps) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [createdTenantId, setCreatedTenantId] = useState<string | null>(null)

  // Step 1: Basics
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManual, setSlugManual] = useState(false)
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [primaryContactEmail, setPrimaryContactEmail] = useState('')
  const [clientType, setClientType] = useState<'clinic' | 'outbound' | 'fb_leads'>('clinic')

  // Step 2: AI Config (optional)
  const [retellPhoneNumber, setRetellPhoneNumber] = useState('')
  const [inboundAgentId, setInboundAgentId] = useState('')
  const [outboundAgentId, setOutboundAgentId] = useState('')
  const [notes, setNotes] = useState('')

  // Step 3: Commercials (optional)
  const [setupFeeAmount, setSetupFeeAmount] = useState('')
  const [retainerAmount, setRetainerAmount] = useState('')

  // Auto-generate slug from name
  useEffect(() => {
    if (!slugManual && name) {
      setSlug(toSlug(name))
    }
  }, [name, slugManual])

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(0)
      setName('')
      setSlug('')
      setSlugManual(false)
      setWebsiteUrl('')
      setPrimaryContactEmail('')
      setRetellPhoneNumber('')
      setInboundAgentId('')
      setOutboundAgentId('')
      setNotes('')
      setSetupFeeAmount('')
      setRetainerAmount('')
      setClientType('clinic')
      setError(null)
      setWarning(null)
      setSaving(false)
      setCreatedTenantId(null)
    }
  }, [open])

  const canProceed = useCallback(() => {
    if (step === 0) {
      return name.trim().length > 0 && slug.trim().length > 0 && websiteUrl.trim().length > 0 && primaryContactEmail.trim().length > 0
    }
    return true // Steps 1-2 are optional, step 3 is review
  }, [step, name, slug, websiteUrl, primaryContactEmail])

  const handleCreate = useCallback(async () => {
    setSaving(true)
    setError(null)

    const payload: Record<string, unknown> = {
      name: name.trim(),
      slug: slug.trim(),
      websiteUrl: websiteUrl.trim(),
      primaryContactEmail: primaryContactEmail.trim().toLowerCase(),
      clientType,
    }

    if (retellPhoneNumber.trim()) payload.retellPhoneNumber = retellPhoneNumber.trim()
    if (inboundAgentId.trim()) payload.inboundAgentId = inboundAgentId.trim()
    if (outboundAgentId.trim()) payload.outboundAgentId = outboundAgentId.trim()
    if (notes.trim()) payload.notes = notes.trim()
    if (setupFeeAmount) {
      const parsed = parseFloat(setupFeeAmount)
      if (!isNaN(parsed)) payload.setupFeeAmount = parsed
    }
    if (retainerAmount) {
      const parsed = parseFloat(retainerAmount)
      if (!isNaN(parsed)) payload.retainerAmount = parsed
    }

    try {
      const res = await fetch('/api/ops/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        // Surface field-level details when available
        let msg = data.error ?? 'Failed to create client'
        if (data.details?.fieldErrors) {
          const fields = Object.entries(data.details.fieldErrors)
            .map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`)
            .join('; ')
          if (fields) msg += ` — ${fields}`
        }
        throw new Error(msg)
      }

      setCreatedTenantId(data.tenantId)
      if (data.warning) setWarning(data.warning as string)

      // Auto-generate prompts
      try {
        await fetch(`/api/ops/tenants/${data.tenantId}/generate-retell-prompts`, {
          method: 'POST',
        })
      } catch {
        // Prompts are best-effort
      }

      onCreated(data.tenantId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create client')
    } finally {
      setSaving(false)
    }
  }, [
    name, slug, websiteUrl, primaryContactEmail, clientType,
    retellPhoneNumber, inboundAgentId, outboundAgentId, notes,
    setupFeeAmount, retainerAmount, onCreated,
  ])

  const currentStep = STEPS[step]

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-xl">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-[var(--brand-border)] bg-[var(--brand-surface)]">
            <div>
              <Dialog.Title className="text-sm font-semibold text-[var(--brand-text)]">
                Add New Client
              </Dialog.Title>
              <Dialog.Description className="text-[11px] text-[var(--brand-muted)] mt-0.5">
                Step {step + 1} of {STEPS.length}: {currentStep.label}
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded-lg p-1 hover:bg-[var(--brand-border)]/30 transition-colors">
              <X className="h-4 w-4 text-[var(--brand-muted)]" />
            </Dialog.Close>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-1 px-5 py-3 border-b border-[var(--brand-border)]">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              const isActive = i === step
              const isDone = i < step || !!createdTenantId
              return (
                <div key={s.key} className="flex items-center gap-1 flex-1">
                  <div
                    className={cn(
                      'flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold transition-colors',
                      isDone
                        ? 'bg-emerald-500 text-white'
                        : isActive
                          ? 'bg-[var(--brand-primary)] text-white'
                          : 'bg-[var(--brand-border)]/50 text-[var(--brand-muted)]',
                    )}
                  >
                    {isDone ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={cn(
                        'flex-1 h-0.5 rounded-full',
                        isDone ? 'bg-emerald-500' : 'bg-[var(--brand-border)]',
                      )}
                    />
                  )}
                </div>
              )
            })}
          </div>

          {/* Content */}
          <div className="p-5 space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-3 py-2">
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
            {warning && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
                <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">Migration required</p>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">{warning}</p>
              </div>
            )}

            {/* Success state */}
            {createdTenantId && (
              <div className="text-center space-y-3 py-4">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/30">
                  <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--brand-text)]">Client Created</p>
                  <p className="text-xs text-[var(--brand-muted)] mt-1">
                    {name} has been set up. Prompts are being generated.
                  </p>
                </div>
                <div className="flex flex-col gap-2 mt-4">
                  <p className="text-[10px] text-[var(--brand-muted)] font-medium uppercase tracking-wide">
                    Next Steps
                  </p>
                  <div className="space-y-1.5 text-left">
                    <NextStepItem done label="Client created" />
                    <NextStepItem done label="Prompts generated" />
                    <NextStepItem label="Copy prompts to Retell" />
                    <NextStepItem label="Paste Agent IDs back" />
                    <NextStepItem label="Connect phone number" />
                    <NextStepItem label="Invite client to workspace" />
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Basics */}
            {step === 0 && !createdTenantId && (
              <div className="space-y-4">
                {/* Client Type */}
                <Field label="Dashboard Type" hint="Determines which dashboard this client will see">
                  <div className="grid grid-cols-3 gap-2 mt-0.5">
                    {([
                      { value: 'clinic', icon: Stethoscope, title: 'Inbound Clinic', desc: 'Inbound-focused dashboard with bookings, AI insights, and call logs' },
                      { value: 'outbound', icon: Phone, title: 'Outbound DB', desc: 'Lead-calling dashboard with contact rates, funnels, and outbound KPIs' },
                      { value: 'fb_leads', icon: Megaphone, title: 'FB Ads Leads', desc: 'Speed-to-lead dashboard with ad ROI, cost per lead, and conversion tracking' },
                    ] as const).map(({ value, icon: Icon, title, desc }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setClientType(value)}
                        className={cn(
                          'flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors',
                          clientType === value
                            ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                            : 'border-[var(--brand-border)] hover:border-[var(--brand-primary)]/40',
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <Icon className={cn('h-3.5 w-3.5', clientType === value ? 'text-[var(--brand-primary)]' : 'text-[var(--brand-muted)]')} />
                          <span className={cn('text-[11px] font-medium', clientType === value ? 'text-[var(--brand-primary)]' : 'text-[var(--brand-text)]')}>
                            {title}
                          </span>
                        </div>
                        <p className="text-[10px] text-[var(--brand-muted)] leading-snug">{desc}</p>
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Client Name" required>
                  <TextInput
                    value={name}
                    onChange={setName}
                    placeholder="e.g. Glow Medical Spa"
                  />
                </Field>
                <Field label="URL Slug" required hint={`Dashboard URL: ${slug || '...'}.servify.ai`}>
                  <TextInput
                    value={slug}
                    onChange={(v) => {
                      setSlugManual(true)
                      setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                    }}
                    placeholder="glow-medical-spa"
                  />
                </Field>
                <Field label="Website URL" required hint="Used to generate Retell agent prompts">
                  <TextInput
                    value={websiteUrl}
                    onChange={setWebsiteUrl}
                    placeholder="https://glowmedicalspa.com"
                  />
                </Field>
                <Field label="Primary Contact Email" required hint="Receives the workspace invite">
                  <TextInput
                    type="email"
                    value={primaryContactEmail}
                    onChange={setPrimaryContactEmail}
                    placeholder="owner@glowmedicalspa.com"
                  />
                </Field>
              </div>
            )}

            {/* Step 2: AI Config */}
            {step === 1 && !createdTenantId && (
              <div className="space-y-4">
                <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/20 px-3 py-2">
                  <p className="text-[11px] text-blue-700 dark:text-blue-400">
                    These fields are optional. Agent IDs can be added later after prompts are generated and pasted into Retell.
                  </p>
                </div>
                <Field label="Retell Phone Number" hint="Forwarding number for AI calls">
                  <TextInput
                    value={retellPhoneNumber}
                    onChange={setRetellPhoneNumber}
                    placeholder="+1 (555) 123-4567"
                  />
                </Field>
                <Field label="Inbound Agent ID" hint="From Retell dashboard (add later)">
                  <TextInput
                    value={inboundAgentId}
                    onChange={setInboundAgentId}
                    placeholder="agent_..."
                  />
                </Field>
                <Field label="Outbound Agent ID" hint="From Retell dashboard (add later)">
                  <TextInput
                    value={outboundAgentId}
                    onChange={setOutboundAgentId}
                    placeholder="agent_..."
                  />
                </Field>
                <Field label="Internal Notes">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Internal notes about this client..."
                    rows={2}
                    maxLength={2000}
                    className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-1.5 text-xs text-[var(--brand-text)] placeholder:text-[var(--brand-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] resize-none"
                  />
                </Field>
              </div>
            )}

            {/* Step 3: Commercials */}
            {step === 2 && !createdTenantId && (
              <div className="space-y-4">
                <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    Manual entry — not synced to Stripe. These can be edited later from the financial profile.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Setup Fee ($)" hint="One-time onboarding fee">
                    <TextInput
                      type="number"
                      value={setupFeeAmount}
                      onChange={setSetupFeeAmount}
                      placeholder="0.00"
                    />
                  </Field>
                  <Field label="Monthly Retainer ($)" hint="Recurring monthly charge">
                    <TextInput
                      type="number"
                      value={retainerAmount}
                      onChange={setRetainerAmount}
                      placeholder="0.00"
                    />
                  </Field>
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {step === 3 && !createdTenantId && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-[var(--brand-text)]">Review & Create</p>
                <div className="rounded-lg border border-[var(--brand-border)] divide-y divide-[var(--brand-border)]">
                  <ReviewRow label="Type" value={clientType === 'outbound' ? 'Outbound DB' : clientType === 'fb_leads' ? 'FB Ads Leads' : 'Inbound Clinic'} />
                  <ReviewRow label="Name" value={name} />
                  <ReviewRow label="Slug" value={slug} mono />
                  <ReviewRow label="Website" value={websiteUrl} />
                  <ReviewRow label="Contact" value={primaryContactEmail} />
                  {retellPhoneNumber && <ReviewRow label="Phone" value={retellPhoneNumber} />}
                  {inboundAgentId && <ReviewRow label="Inbound Agent" value={inboundAgentId} mono />}
                  {outboundAgentId && <ReviewRow label="Outbound Agent" value={outboundAgentId} mono />}
                  {setupFeeAmount && <ReviewRow label="Setup Fee" value={`$${setupFeeAmount}`} />}
                  {retainerAmount && <ReviewRow label="Retainer" value={`$${retainerAmount}/mo`} />}
                </div>
                <p className="text-[10px] text-[var(--brand-muted)]">
                  This will create the tenant, financial profile, onboarding assets, and workspace invite.
                  Retell agent prompts will be auto-generated from the website URL.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 flex items-center justify-between gap-2 px-5 py-3 border-t border-[var(--brand-border)] bg-[var(--brand-surface)]">
            {createdTenantId ? (
              <div className="flex-1 flex justify-end">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-4 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity"
                  >
                    Done
                  </button>
                </Dialog.Close>
              </div>
            ) : (
              <>
                <div>
                  {step > 0 && (
                    <button
                      type="button"
                      onClick={() => setStep((s) => s - 1)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--brand-border)] px-3 py-1.5 text-xs font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
                    >
                      <ChevronLeft className="h-3 w-3" />
                      Back
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="rounded-lg border border-[var(--brand-border)] px-3 py-1.5 text-xs font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
                    >
                      Cancel
                    </button>
                  </Dialog.Close>
                  {step < STEPS.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => setStep((s) => s + 1)}
                      disabled={!canProceed()}
                      className="inline-flex items-center gap-1 rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      Next
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Rocket className="h-3 w-3" />
                          Create Client
                        </>
                      )}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ReviewRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className="text-[11px] text-[var(--brand-muted)]">{label}</span>
      <span
        className={cn(
          'text-xs text-[var(--brand-text)] text-right max-w-[60%] truncate',
          mono && 'font-mono text-[11px]',
        )}
      >
        {value}
      </span>
    </div>
  )
}

function NextStepItem({ label, done }: { label: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div
        className={cn(
          'flex h-4 w-4 items-center justify-center rounded-full',
          done
            ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
            : 'bg-[var(--brand-border)]/50 text-[var(--brand-muted)]',
        )}
      >
        {done ? <Check className="h-2.5 w-2.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      </div>
      <span className={cn(done ? 'text-[var(--brand-muted)] line-through' : 'text-[var(--brand-text)]')}>
        {label}
      </span>
    </div>
  )
}
