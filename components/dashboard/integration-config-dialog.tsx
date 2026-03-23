'use client'

import { useState } from 'react'
import { Loader2, AlertCircle, Webhook, Globe, Key } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ClientIntegration, IntegrationProvider } from '@/lib/types/domain'

// ── Types ──────────────────────────────────────────────────────────────────────

interface IntegrationConfigDialogProps {
  open: boolean
  onClose: () => void
  onSave: (result: ClientIntegration) => void
  /** null = create mode, existing = edit mode */
  existing: ClientIntegration | null
  /** Force a specific provider in create mode */
  provider?: IntegrationProvider
}

interface FormState {
  name: string
  webhookUrl: string
  webhookSecret: string
  timeoutMs: string
  apiKey: string
  portalId: string
  locationId: string
  baseUrl: string
}

// ── Provider metadata ────────────────────────────────────────────────────────

const PROVIDER_META: Record<IntegrationProvider, {
  label: string
  icon: typeof Webhook
  color: string
  description: string
}> = {
  custom_webhook: {
    label: 'Custom Webhook',
    icon: Webhook,
    color: 'var(--brand-primary)',
    description: 'Send CRM events to your own endpoint.',
  },
  hubspot: {
    label: 'HubSpot',
    icon: Globe,
    color: '#FF7A59',
    description: 'Sync contacts, deals and notes to HubSpot CRM.',
  },
  ghl: {
    label: 'GoHighLevel',
    icon: Globe,
    color: '#2196F3',
    description: 'Push leads, calls and bookings to your GHL pipeline.',
  },
  pipedrive: {
    label: 'Pipedrive',
    icon: Globe,
    color: '#1A1A2E',
    description: 'Create deals and activities in Pipedrive.',
  },
  jane_app: {
    label: 'Jane App',
    icon: Globe,
    color: '#5A67D8',
    description: 'Sync patients, appointments and availability with Jane App.',
  },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function emptyForm(provider: IntegrationProvider, existing: ClientIntegration | null): FormState {
  if (existing) {
    const masked = existing.secretsMasked ?? {}
    return {
      name: existing.name,
      webhookUrl: (masked.webhookUrl as string) ?? '',
      webhookSecret: '',  // Never pre-fill secrets
      timeoutMs: (masked.timeoutMs as string) ?? '',
      apiKey: '',
      portalId: (masked.portalId as string) ?? '',
      locationId: (masked.locationId as string) ?? '',
      baseUrl: (masked.baseUrl as string) ?? '',
    }
  }
  return {
    name: PROVIDER_META[provider]?.label ?? provider,
    webhookUrl: '',
    webhookSecret: '',
    timeoutMs: '',
    apiKey: '',
    portalId: '',
    locationId: '',
    baseUrl: '',
  }
}

function buildConfig(provider: IntegrationProvider, form: FormState): Record<string, unknown> {
  switch (provider) {
    case 'custom_webhook': {
      const config: Record<string, unknown> = { webhookUrl: form.webhookUrl.trim() }
      if (form.webhookSecret.trim()) config.secret = form.webhookSecret.trim()
      const timeout = parseInt(form.timeoutMs.trim(), 10)
      if (!isNaN(timeout) && timeout > 0) config.timeoutMs = timeout
      return config
    }
    case 'hubspot': {
      const config: Record<string, unknown> = {}
      if (form.apiKey.trim()) config.privateAppToken = form.apiKey.trim()
      if (form.portalId.trim()) config.portalId = form.portalId.trim()
      return config
    }
    case 'ghl': {
      const config: Record<string, unknown> = {}
      if (form.apiKey.trim()) config.apiKey = form.apiKey.trim()
      if (form.locationId.trim()) config.locationId = form.locationId.trim()
      if (form.baseUrl.trim()) config.baseUrl = form.baseUrl.trim()
      return config
    }
    default:
      return {}
  }
}

function validateForm(provider: IntegrationProvider, form: FormState): string | null {
  if (!form.name.trim()) return 'Integration name is required.'
  switch (provider) {
    case 'custom_webhook':
      if (!form.webhookUrl.trim()) return 'Webhook URL is required.'
      if (!form.webhookUrl.trim().startsWith('http')) return 'Webhook URL must start with http:// or https://'
      break
    case 'hubspot':
      if (!form.apiKey.trim()) return 'Private App Token is required.'
      break
    case 'ghl':
      if (!form.apiKey.trim()) return 'API Key is required.'
      break
  }
  return null
}

// ── Component ────────────────────────────────────────────────────────────────

export function IntegrationConfigDialog({
  open,
  onClose,
  onSave,
  existing,
  provider: forcedProvider,
}: IntegrationConfigDialogProps) {
  const provider = existing?.provider ?? forcedProvider ?? 'custom_webhook'
  const meta = PROVIDER_META[provider] ?? PROVIDER_META.custom_webhook
  const isEdit = !!existing
  const isStubProvider = provider === 'hubspot' || provider === 'ghl'

  const [form, setForm] = useState<FormState>(() => emptyForm(provider, existing))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function field(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleClose() {
    if (saving) return
    setError(null)
    onClose()
  }

  async function handleSave() {
    const validationError = validateForm(provider, form)
    if (validationError) { setError(validationError); return }
    setError(null)
    setSaving(true)

    try {
      const config = buildConfig(provider, form)
      const url = isEdit ? `/api/integrations/${existing.id}` : '/api/integrations'
      const method = isEdit ? 'PATCH' : 'POST'
      const body: Record<string, unknown> = isEdit
        ? { name: form.name.trim(), config }
        : { provider, name: form.name.trim(), config }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to save integration.'); return }
      onSave(json.integration)
      handleClose()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  // Reset form when dialog opens with different data
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setForm(emptyForm(provider, existing))
      setError(null)
    } else {
      handleClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ background: meta.color + '18' }}
            >
              <meta.icon className="h-4.5 w-4.5" style={{ color: meta.color }} />
            </div>
            <div>
              <DialogTitle>{isEdit ? `Configure ${meta.label}` : `Add ${meta.label}`}</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">{meta.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Stub provider warning */}
          {isStubProvider && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 px-3 py-2.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Provider API not implemented yet</p>
                <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
                  You can save your configuration now. Delivery will return NOT_IMPLEMENTED until the adapter is built.
                </p>
              </div>
            </div>
          )}

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--brand-muted)]">
              Display Name <span className="text-rose-500">*</span>
            </label>
            <Input
              placeholder="e.g. HubSpot Main"
              value={form.name}
              onChange={(e) => field('name', e.target.value)}
              autoFocus
            />
          </div>

          {/* Provider-specific fields */}
          {provider === 'custom_webhook' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--brand-muted)]">
                  Webhook URL <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="url"
                  placeholder="https://hooks.example.com/crm"
                  value={form.webhookUrl}
                  onChange={(e) => field('webhookUrl', e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--brand-muted)]">
                  Webhook Secret <span className="text-[var(--brand-muted)] font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--brand-muted)]" />
                  <Input
                    type="password"
                    placeholder={isEdit ? '••••••••  (leave blank to keep current)' : 'Optional shared secret'}
                    value={form.webhookSecret}
                    onChange={(e) => field('webhookSecret', e.target.value)}
                    className="pl-9 font-mono text-xs"
                  />
                </div>
                <p className="text-[10px] text-[var(--brand-muted)]">Sent as x-webhook-secret header. Never displayed after save.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--brand-muted)]">
                  Timeout (ms) <span className="text-[var(--brand-muted)] font-normal">(default 8000)</span>
                </label>
                <Input
                  type="number"
                  min={1000}
                  max={30000}
                  step={1000}
                  placeholder="8000"
                  value={form.timeoutMs}
                  onChange={(e) => field('timeoutMs', e.target.value)}
                />
              </div>
            </>
          )}

          {provider === 'hubspot' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--brand-muted)]">
                  Private App Token <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--brand-muted)]" />
                  <Input
                    type="password"
                    placeholder={isEdit ? '••••••••  (leave blank to keep current)' : 'pat-na1-xxxxxxxx-xxxx...'}
                    value={form.apiKey}
                    onChange={(e) => field('apiKey', e.target.value)}
                    className="pl-9 font-mono text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--brand-muted)]">
                  Portal ID <span className="text-[var(--brand-muted)] font-normal">(optional)</span>
                </label>
                <Input
                  placeholder="e.g. 12345678"
                  value={form.portalId}
                  onChange={(e) => field('portalId', e.target.value)}
                />
              </div>
            </>
          )}

          {provider === 'ghl' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--brand-muted)]">
                  API Key <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--brand-muted)]" />
                  <Input
                    type="password"
                    placeholder={isEdit ? '••••••••  (leave blank to keep current)' : 'Your GHL API key'}
                    value={form.apiKey}
                    onChange={(e) => field('apiKey', e.target.value)}
                    className="pl-9 font-mono text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--brand-muted)]">
                  Location ID <span className="text-[var(--brand-muted)] font-normal">(optional)</span>
                </label>
                <Input
                  placeholder="e.g. abcdef123456"
                  value={form.locationId}
                  onChange={(e) => field('locationId', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--brand-muted)]">
                  Base URL <span className="text-[var(--brand-muted)] font-normal">(optional override)</span>
                </label>
                <Input
                  type="url"
                  placeholder="https://services.leadconnectorhq.com"
                  value={form.baseUrl}
                  onChange={(e) => field('baseUrl', e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </>
          )}

          {/* Masked secrets display (edit mode) */}
          {isEdit && existing.secretsMasked && Object.keys(existing.secretsMasked).length > 0 && (
            <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)]/50 p-3">
              <p className="text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider mb-2">Saved configuration</p>
              {Object.entries(existing.secretsMasked).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2 py-1">
                  <span className="text-[10px] text-[var(--brand-muted)] font-mono">{k}</span>
                  <Badge variant="muted" className="text-[10px] font-mono">{String(v)}</Badge>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/30 px-3 py-2 text-xs text-rose-700 dark:text-rose-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm" disabled={saving} onClick={handleClose}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="brand"
            size="sm"
            disabled={saving || !form.name.trim()}
            onClick={handleSave}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Add integration'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
