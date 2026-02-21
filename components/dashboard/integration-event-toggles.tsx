'use client'

import { useState, useCallback } from 'react'
import { Loader2, Zap, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ClientIntegration } from '@/lib/types/domain'

// ── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  { key: 'call.completed',      label: 'Call Completed',      description: 'When an AI call ends' },
  { key: 'lead.created',        label: 'Lead Created',        description: 'When a new lead is identified' },
  { key: 'booking.created',     label: 'Booking Created',     description: 'When an appointment is booked' },
  { key: 'summary.created',     label: 'Summary Created',     description: 'When AI summary is generated' },
  { key: 'followup.required',   label: 'Follow-up Required',  description: 'When manual follow-up is needed' },
  { key: 'lead.status_updated', label: 'Status Updated',      description: 'When lead status changes' },
] as const

// Default remote event names per provider
const PROVIDER_DEFAULTS: Record<string, Record<string, string>> = {
  custom_webhook: {},
  hubspot: {
    'call.completed': 'hs_call_completed',
    'lead.created': 'hs_contact_created',
    'booking.created': 'hs_meeting_booked',
    'summary.created': 'hs_note_created',
    'followup.required': 'hs_task_created',
    'lead.status_updated': 'hs_deal_stage_changed',
  },
  ghl: {
    'call.completed': 'ghl_call_completed',
    'lead.created': 'ghl_contact_new',
    'booking.created': 'ghl_appointment_created',
    'summary.created': 'ghl_note_added',
    'followup.required': 'ghl_task_created',
    'lead.status_updated': 'ghl_pipeline_stage_changed',
  },
}

// ── Props ────────────────────────────────────────────────────────────────────

interface IntegrationEventTogglesProps {
  integration: ClientIntegration
  onUpdate: (updated: ClientIntegration) => void
}

// ── Toggle switch ────────────────────────────────────────────────────────────

function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled: boolean
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
        'transition-colors duration-200 ease-in-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-40',
        checked ? 'bg-[var(--brand-primary)]' : 'bg-[var(--brand-border)]',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm',
          'transform transition-transform duration-200 ease-in-out',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export function IntegrationEventToggles({ integration, onUpdate }: IntegrationEventTogglesProps) {
  const [saving, setSaving] = useState<string | null>(null)
  const [showMapping, setShowMapping] = useState(false)
  const [editingMapping, setEditingMapping] = useState<Record<string, string>>(
    () => ({ ...integration.eventMapping }),
  )

  const handleToggle = useCallback(async (eventKey: string, newValue: boolean) => {
    setSaving(eventKey)
    try {
      const updatedToggles = { ...integration.eventToggles, [eventKey]: newValue }
      const res = await fetch(`/api/integrations/${integration.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventToggles: updatedToggles }),
      })
      const json = await res.json()
      if (res.ok && json.integration) {
        onUpdate(json.integration)
      }
    } catch {
      // Silent failure — toggle will remain in previous state
    } finally {
      setSaving(null)
    }
  }, [integration, onUpdate])

  const handleSaveMapping = useCallback(async () => {
    setSaving('__mapping__')
    try {
      // Filter out empty values
      const cleaned: Record<string, string> = {}
      for (const [k, v] of Object.entries(editingMapping)) {
        if (v.trim()) cleaned[k] = v.trim()
      }
      const res = await fetch(`/api/integrations/${integration.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventMapping: cleaned }),
      })
      const json = await res.json()
      if (res.ok && json.integration) {
        onUpdate(json.integration)
        setEditingMapping(json.integration.eventMapping)
      }
    } catch {
      // Silent
    } finally {
      setSaving(null)
    }
  }, [integration.id, editingMapping, onUpdate])

  const enabledCount = EVENT_TYPES.filter(
    (e) => integration.eventToggles[e.key] !== false,
  ).length

  const defaults = PROVIDER_DEFAULTS[integration.provider] ?? {}
  const mappingDirty = JSON.stringify(editingMapping) !== JSON.stringify(integration.eventMapping)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-[var(--brand-muted)]" />
              Event Routing
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {enabledCount} of {EVENT_TYPES.length} events enabled
            </CardDescription>
          </div>
          <button
            onClick={() => setShowMapping((v) => !v)}
            className={cn(
              'text-[10px] font-medium px-2 py-1 rounded transition-colors',
              showMapping
                ? 'bg-[var(--user-accent-soft)] text-[var(--user-accent)]'
                : 'text-[var(--brand-muted)] hover:text-[var(--brand-text)]',
            )}
          >
            {showMapping ? 'Hide mapping' : 'Edit mapping'}
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="rounded-lg border border-[var(--brand-border)] overflow-hidden divide-y divide-[var(--brand-border)]">
          {EVENT_TYPES.map((event) => {
            const isEnabled = integration.eventToggles[event.key] !== false
            const isSaving = saving === event.key

            return (
              <div key={event.key} className="px-3 py-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[var(--brand-text)]">
                        {event.label}
                      </span>
                      {isSaving && (
                        <Loader2 className="h-3 w-3 animate-spin text-[var(--brand-muted)]" />
                      )}
                    </div>
                    <p className="text-[10px] text-[var(--brand-muted)] mt-0.5">
                      {event.description}
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={isEnabled}
                    onChange={(v) => handleToggle(event.key, v)}
                    disabled={isSaving || saving !== null}
                  />
                </div>

                {/* Inline event mapping row */}
                {showMapping && isEnabled && (
                  <div className="flex items-center gap-2 pl-1">
                    <code className="text-[9px] font-mono text-[var(--brand-muted)] bg-[var(--brand-bg)] rounded px-1.5 py-0.5 border border-[var(--brand-border)]">
                      {event.key}
                    </code>
                    <ArrowRight className="h-3 w-3 text-[var(--brand-muted)] shrink-0" />
                    <input
                      type="text"
                      value={editingMapping[event.key] ?? ''}
                      onChange={(e) => setEditingMapping((prev) => ({ ...prev, [event.key]: e.target.value }))}
                      placeholder={defaults[event.key] || event.key}
                      className="flex-1 rounded border border-[var(--brand-border)] bg-[var(--brand-bg)] text-[10px] font-mono text-[var(--brand-text)] px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] placeholder:text-[var(--brand-muted)] placeholder:opacity-40 max-w-[200px]"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Save mapping button */}
        {showMapping && mappingDirty && (
          <div className="flex justify-end mt-3">
            <button
              onClick={handleSaveMapping}
              disabled={saving !== null}
              className={cn(
                'text-xs font-medium px-3 py-1.5 rounded-lg transition-colors',
                'bg-[var(--user-accent)] text-white hover:opacity-90',
                'disabled:opacity-40 disabled:cursor-not-allowed',
              )}
            >
              {saving === '__mapping__' ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />Saving…
                </span>
              ) : (
                'Save Mapping'
              )}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
