'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Power,
  Shield,
  Clock,
  AlertTriangle,
  Loader2,
  ChevronDown,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildTenantApiUrl } from '@/lib/dashboard/tenant-api'
import { deriveEffectiveStatus, formatAutoResume } from '@/lib/ai-control/effective-status'
import {
  AI_OPERATING_MODE_LABELS,
  AI_OPERATING_MODE_DESCRIPTIONS,
  AI_FALLBACK_MODE_LABELS,
  AI_FALLBACK_MODE_DESCRIPTIONS,
  AI_PAUSE_REASON_LABELS,
  AI_EFFECTIVE_STATUS_COLORS,
  AI_EFFECTIVE_STATUS_LABELS,
  DEFAULT_AI_CONTROL_STATE,
} from '@/lib/ai-control/types'
import type {
  AiControlState,
  AiOperatingMode,
  AiFallbackMode,
  AiPauseReason,
  AiEffectiveStatus,
} from '@/lib/ai-control/types'

// ── Props ───────────────────────────────────────────────────────────────────

interface AiSystemControlCardProps {
  tenantSlug: string
  initialState?: AiControlState
}

// ── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AiEffectiveStatus }) {
  const colors = AI_EFFECTIVE_STATUS_COLORS[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', colors.bg, colors.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', colors.dot)} />
      {AI_EFFECTIVE_STATUS_LABELS[status]}
    </span>
  )
}

// ── Toggle switch (no external dependency) ──────────────────────────────────

function Toggle({
  checked,
  onToggle,
  disabled,
  label,
}: {
  checked: boolean
  onToggle: (val: boolean) => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onToggle(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-bg)]',
        checked ? 'bg-emerald-500' : 'bg-[var(--brand-border)]',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  )
}

// ── Dropdown (styled native select with custom trigger) ─────────────────────

function Dropdown<T extends string>({
  value,
  options,
  labels,
  descriptions,
  onChange,
  disabled,
}: {
  value: T
  options: T[]
  labels: Record<T, string>
  descriptions?: Record<T, string>
  onChange: (val: T) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          'flex w-full items-center justify-between rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-2 text-sm text-[var(--brand-text)]',
          'hover:border-[var(--brand-text)]/20 transition-colors',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span>{labels[value]}</span>
        <ChevronDown className={cn('h-4 w-4 text-[var(--brand-muted)] transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-lg overflow-hidden">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false) }}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm transition-colors',
                  opt === value
                    ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-text)] font-medium'
                    : 'text-[var(--brand-muted)] hover:bg-[var(--brand-border)]/30 hover:text-[var(--brand-text)]',
                )}
              >
                <span className="block">{labels[opt]}</span>
                {descriptions && (
                  <span className="block text-[11px] text-[var(--brand-muted)] mt-0.5 leading-tight">
                    {descriptions[opt]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export function AiSystemControlCard({ tenantSlug, initialState }: AiSystemControlCardProps) {
  const [state, setState] = useState<AiControlState>(initialState ?? DEFAULT_AI_CONTROL_STATE)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<string | null>(null)

  const effectiveStatus = deriveEffectiveStatus(state)

  // Fetch current state on mount if no initialState provided
  useEffect(() => {
    if (initialState) return

    const url = buildTenantApiUrl('/api/ai-control', tenantSlug)
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.ai_enabled !== undefined) {
          setState({
            ai_enabled: data.ai_enabled,
            ai_operating_mode: data.ai_operating_mode,
            ai_fallback_mode: data.ai_fallback_mode,
            ai_pause_reason: data.ai_pause_reason,
            ai_pause_note: data.ai_pause_note,
            ai_auto_resume_at: data.ai_auto_resume_at,
            ai_control_updated_at: data.ai_control_updated_at,
            ai_control_updated_by: data.ai_control_updated_by,
          })
        }
      })
      .catch(() => {
        // Graceful — use defaults
      })
  }, [initialState, tenantSlug])

  // Persist changes
  const save = useCallback(async (update: Partial<AiControlState>) => {
    setSaving(true)
    setError(null)

    try {
      const url = buildTenantApiUrl('/api/ai-control', tenantSlug)
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to save')
      }

      const data = await res.json()
      setState({
        ai_enabled: data.ai_enabled,
        ai_operating_mode: data.ai_operating_mode,
        ai_fallback_mode: data.ai_fallback_mode,
        ai_pause_reason: data.ai_pause_reason,
        ai_pause_note: data.ai_pause_note,
        ai_auto_resume_at: data.ai_auto_resume_at,
        ai_control_updated_at: data.ai_control_updated_at,
        ai_control_updated_by: data.ai_control_updated_by,
      })
      setLastSaved(new Date().toLocaleTimeString())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }, [tenantSlug])

  const handleToggle = (enabled: boolean) => {
    setState((s) => ({ ...s, ai_enabled: enabled }))
    save({ ai_enabled: enabled })
  }

  const handleModeChange = (mode: AiOperatingMode) => {
    setState((s) => ({ ...s, ai_operating_mode: mode }))
    save({ ai_operating_mode: mode })
  }

  const handleFallbackChange = (mode: AiFallbackMode) => {
    setState((s) => ({ ...s, ai_fallback_mode: mode }))
    save({ ai_fallback_mode: mode })
  }

  const handlePauseReasonChange = (reason: AiPauseReason) => {
    setState((s) => ({ ...s, ai_pause_reason: reason }))
    save({ ai_pause_reason: reason })
  }

  const showPauseControls = !state.ai_enabled || state.ai_operating_mode === 'paused'
  const autoResumeText = formatAutoResume(state.ai_auto_resume_at)

  return (
    <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] overflow-hidden">
      {/* Header with status badge */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--brand-border)]">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand-primary)]/10">
            <Power className="h-4.5 w-4.5 text-[var(--brand-primary)]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--brand-text)]">AI System Control</h3>
            <p className="text-[11px] text-[var(--brand-muted)] mt-0.5">
              Manage your AI receptionist operating state
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--brand-muted)]" />}
          <StatusBadge status={effectiveStatus} />
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-3 py-2">
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Master toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-[var(--brand-text)]">AI Receptionist</p>
            <p className="text-[11px] text-[var(--brand-muted)]">
              {state.ai_enabled ? 'Sarah is active and handling calls' : 'Sarah is currently disabled'}
            </p>
          </div>
          <Toggle
            checked={state.ai_enabled}
            onToggle={handleToggle}
            disabled={saving}
            label="Toggle AI receptionist"
          />
        </div>

        {/* Operating mode */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--brand-text)]">
            <Shield className="h-3.5 w-3.5 text-[var(--brand-muted)]" />
            Operating Mode
          </label>
          <Dropdown
            value={state.ai_operating_mode}
            options={['live', 'paused', 'outbound_only', 'inbound_only'] as AiOperatingMode[]}
            labels={AI_OPERATING_MODE_LABELS}
            descriptions={AI_OPERATING_MODE_DESCRIPTIONS}
            onChange={handleModeChange}
            disabled={saving || !state.ai_enabled}
          />
          {!state.ai_enabled && (
            <p className="text-[11px] text-[var(--brand-muted)] flex items-center gap-1">
              <Info className="h-3 w-3 shrink-0" />
              Enable AI to change operating mode
            </p>
          )}
        </div>

        {/* Fallback mode */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--brand-text)]">
            <AlertTriangle className="h-3.5 w-3.5 text-[var(--brand-muted)]" />
            Fallback Mode
          </label>
          <Dropdown
            value={state.ai_fallback_mode}
            options={['human_handoff', 'voicemail_only', 'capture_only', 'disabled'] as AiFallbackMode[]}
            labels={AI_FALLBACK_MODE_LABELS}
            descriptions={AI_FALLBACK_MODE_DESCRIPTIONS}
            onChange={handleFallbackChange}
            disabled={saving}
          />
          <p className="text-[11px] text-[var(--brand-muted)]">
            How calls are handled when AI is paused or unavailable.
          </p>
        </div>

        {/* Pause controls — only shown when paused */}
        {showPauseControls && (
          <div className="space-y-3 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/10 p-4">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Pause Details
            </p>

            {/* Pause reason */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[var(--brand-text)]">Reason</label>
              <Dropdown
                value={state.ai_pause_reason ?? 'other'}
                options={['holiday', 'staff_preference', 'testing', 'other'] as AiPauseReason[]}
                labels={AI_PAUSE_REASON_LABELS}
                onChange={handlePauseReasonChange}
                disabled={saving}
              />
            </div>

            {/* Pause note */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[var(--brand-text)]">Note (optional)</label>
              <textarea
                value={state.ai_pause_note ?? ''}
                onChange={(e) => setState((s) => ({ ...s, ai_pause_note: e.target.value }))}
                onBlur={() => { if (state.ai_pause_note !== null) save({ ai_pause_note: state.ai_pause_note }) }}
                placeholder="Why is the AI paused?"
                rows={2}
                disabled={saving}
                className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-2 text-xs text-[var(--brand-text)] placeholder:text-[var(--brand-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] resize-none"
              />
            </div>

            {/* Auto-resume */}
            {autoResumeText && (
              <p className="text-[11px] text-[var(--brand-muted)] flex items-center gap-1">
                <Clock className="h-3 w-3 shrink-0" />
                Auto-resume {autoResumeText}
              </p>
            )}
          </div>
        )}

        {/* Last updated */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--brand-border)]">
          <p className="text-[10px] text-[var(--brand-muted)]">
            {state.ai_control_updated_at
              ? `Last changed ${new Date(state.ai_control_updated_at).toLocaleString()}`
              : 'No changes recorded'}
          </p>
          {lastSaved && (
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
              Saved at {lastSaved}
            </p>
          )}
        </div>

        {/* Honest scaffolding notice */}
        <div className="flex items-start gap-2 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-3 py-2.5">
          <Info className="h-3.5 w-3.5 shrink-0 text-[var(--brand-muted)] mt-0.5" />
          <p className="text-[11px] text-[var(--brand-muted)] leading-relaxed">
            This control panel sets the authoritative AI state. External systems (call routing, agent providers) must read this state to act on it. Direct provider integration is not yet connected.
          </p>
        </div>
      </div>
    </div>
  )
}
