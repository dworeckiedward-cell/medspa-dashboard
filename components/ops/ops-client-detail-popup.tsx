'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  X,
  ExternalLink,
  AlertTriangle,
  Bot,
  Phone,
  Globe,
  Calendar,
  Activity,
  Shield,
  Link as LinkIcon,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import type { ClientOverview } from '@/lib/ops/query'
import type { ClientHealthScore } from '@/lib/ops/health-score'
import type { ClientUnitEconomics } from '@/lib/ops/unit-economics/types'
import type { ClientCommercialSnapshot } from '@/lib/ops-financials/types'

// ── Timezone options (shared vocabulary with client dashboard) ───────────────

const TIMEZONE_OPTIONS = [
  { value: 'America/Edmonton', label: 'Calgary (MT)' },
  { value: 'America/Vancouver', label: 'Vancouver (PT)' },
  { value: 'America/Toronto', label: 'Toronto (ET)' },
  { value: 'America/New_York', label: 'New York (ET)' },
  { value: 'America/Chicago', label: 'Chicago (CT)' },
  { value: 'America/Denver', label: 'Denver (MT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PT)' },
  { value: 'America/Phoenix', label: 'Phoenix (AZ)' },
  { value: 'America/Halifax', label: 'Halifax (AT)' },
  { value: 'America/Winnipeg', label: 'Winnipeg (CT)' },
  { value: 'America/Regina', label: 'Regina (CST)' },
  { value: 'Pacific/Honolulu', label: 'Honolulu (HT)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
]

// ── Client status badge helpers ──────────────────────────────────────────────

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  onboarding: { bg: 'bg-blue-100 dark:bg-blue-950/40', text: 'text-blue-600 dark:text-blue-400', label: 'Onboarding' },
  live: { bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-600 dark:text-emerald-400', label: 'Live' },
  watch: { bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-600 dark:text-amber-400', label: 'Watch' },
  canceled: { bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-600 dark:text-red-400', label: 'Canceled' },
}

// ── Props ────────────────────────────────────────────────────────────────────

interface OpsClientDetailPopupProps {
  open: boolean
  onClose: () => void
  overview: ClientOverview | null
  health?: ClientHealthScore
  economics?: ClientUnitEconomics
  snapshot?: ClientCommercialSnapshot
}

// ── Component ────────────────────────────────────────────────────────────────

export function OpsClientDetailPopup({
  open,
  onClose,
  overview,
  health,
  economics,
  snapshot,
}: OpsClientDetailPopupProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Escape key
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Lock body scroll
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || !overview) return null

  const { client, callStats } = overview
  const statusKey = client.client_status ?? 'onboarding'
  const statusBadge = STATUS_BADGE[statusKey] ?? STATUS_BADGE.onboarding
  const ltvCac = economics?.paybackRatio

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          'relative w-full max-w-[600px] max-h-[85vh] overflow-y-auto',
          'bg-[var(--brand-surface)] border border-[var(--brand-border)]/60',
          'rounded-2xl shadow-xl',
          'animate-in fade-in zoom-in-95 duration-200',
        )}
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 bg-[var(--brand-surface)] border-b border-[var(--brand-border)]/50 px-6 py-4 rounded-t-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl overflow-hidden text-sm font-bold"
                style={{
                  background: client.logo_url ? '#ffffff' : (client.brand_color ?? '#2563EB'),
                  color: client.logo_url ? undefined : '#ffffff',
                }}
              >
                {client.logo_url ? (
                  <img src={client.logo_url} alt={client.name} className="h-full w-full object-contain" />
                ) : (
                  client.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-[var(--brand-text)] leading-tight truncate">
                  {client.name}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-[var(--brand-muted)]">{client.slug}</span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                      statusBadge.bg,
                      statusBadge.text,
                    )}
                  >
                    {statusBadge.label}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ActiveToggleInline active={client.is_active} clientId={client.id} />
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-border)]/50 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Stats (read-only) ─────────────────────────────────────────── */}
        <Section title="Stats (30d)">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard label="Calls" value={callStats.totalCalls.toString()} />
            <StatCard
              label="Bookings"
              value={`${callStats.bookedCalls} (${callStats.bookingRate}%)`}
            />
            <StatCard
              label="Revenue"
              value={
                callStats.totalRevenue > 0
                  ? formatCurrency(callStats.totalRevenue, client.currency)
                  : '—'
              }
            />
            <StatCard
              label="LTV:CAC"
              value={ltvCac != null ? `${ltvCac}x` : '—'}
              highlight={ltvCac != null && ltvCac < 1}
            />
          </div>
        </Section>

        {/* ── Financials (inline editable) ───────────────────────────────── */}
        <Section title="Financials">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <EditableField
              label="Setup Fee"
              value={snapshot?.setupFeeAmount}
              format="money"
              field="setupFeeAmount"
              apiPath={`/api/ops/financials/${client.id}`}

            />
            <EditableField
              label="Retainer"
              value={snapshot?.retainerAmount}
              format="money"
              suffix="/mo"
              field="retainerAmount"
              apiPath={`/api/ops/financials/${client.id}`}

            />
            <EditableField
              label="CAC"
              value={economics?.cacAmount}
              format="money"
              field="cacUsd"
              apiPath={`/api/ops/unit-economics/${client.id}`}

            />
            <EditableField
              label="LTV"
              value={economics?.totalCollectedLtv}
              format="money"
              field="ltvUsd"
              apiPath={`/api/ops/unit-economics/${client.id}`}

            />
            <EditableField
              label="MRR"
              value={economics?.activeMrr}
              format="money"
              suffix="/mo"
              field="retainerAmount"
              apiPath={`/api/ops/financials/${client.id}`}

            />
          </div>
        </Section>

        {/* ── Status & Config ──────────────────────────────────────────── */}
        <Section title="Status & Config">
          <div className="space-y-3">
            <ConfigSelect
              icon={Activity}
              label="Status"
              value={client.client_status ?? 'onboarding'}
              options={[
                { value: 'onboarding', label: 'Onboarding' },
                { value: 'live', label: 'Live' },
                { value: 'watch', label: 'Watch' },
                { value: 'canceled', label: 'Canceled' },
              ]}
              field="client_status"
              clientId={client.id}
            />
            <ConfigToggle
              icon={Bot}
              label="AI enabled"
              value={client.ai_enabled}
              field="ai_enabled"
              clientId={client.id}
            />
            <ConfigSelect
              icon={Activity}
              label="AI mode"
              value={client.ai_operating_mode}
              options={[
                { value: 'live', label: 'Live' },
                { value: 'paused', label: 'Paused' },
                { value: 'outbound_only', label: 'Outbound only' },
                { value: 'inbound_only', label: 'Inbound only' },
                { value: 'maintenance', label: 'Maintenance' },
              ]}
              field="ai_operating_mode"
              clientId={client.id}
            />
            <ConfigSelect
              icon={Clock}
              label="Timezone"
              value={client.timezone || 'America/Edmonton'}
              options={TIMEZONE_OPTIONS}
              field="timezone"
              clientId={client.id}
            />
            <ConfigText
              icon={Phone}
              label="AI Phone"
              value={client.retell_phone_number}
              field="retell_phone_number"
              clientId={client.id}
            />
            <ConfigText
              icon={Shield}
              label="Retell Agent ID"
              value={client.retell_agent_id}
              field="retell_agent_id"
              clientId={client.id}
            />
            <ConfigText
              icon={LinkIcon}
              label="Website"
              value={client.website_url ?? null}
              field="website_url"
              clientId={client.id}
            />
            <ConfigDate
              icon={Calendar}
              label="Acquired"
              value={economics?.acquiredAt ?? null}
              clientId={client.id}
            />
          </div>
        </Section>

        {/* ── Actions ───────────────────────────────────────────────────── */}
        <Section>
          <div className="flex gap-2">
            <a
              href={`/dashboard?tenant=${client.slug}`}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-3 py-2.5 text-xs font-medium text-[var(--brand-text)] hover:bg-[var(--brand-surface)] transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open Dashboard
            </a>
            <a
              href={`/ops/clients/${client.id}/errors`}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-3 py-2.5 text-xs font-medium text-[var(--brand-text)] hover:bg-[var(--brand-surface)] transition-colors"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              View Errors
            </a>
          </div>
        </Section>
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  return (
    <div className="px-6 py-4 border-b border-[var(--brand-border)]/50 last:border-b-0">
      {title && (
        <p className="text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider mb-3">
          {title}
        </p>
      )}
      {children}
    </div>
  )
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-3 text-center">
      <p
        className={cn(
          'text-sm font-semibold tabular-nums leading-none',
          highlight ? 'text-red-600 dark:text-red-400' : 'text-[var(--brand-text)]',
        )}
      >
        {value}
      </p>
      <p className="text-[10px] text-[var(--brand-muted)] mt-1">{label}</p>
    </div>
  )
}

function ActiveToggleInline({ active, clientId }: { active: boolean; clientId: string }) {
  const [value, setValue] = useState(active)
  const [saving, setSaving] = useState(false)

  const toggle = async () => {
    const next = !value
    setValue(next)
    setSaving(true)
    try {
      await fetch(`/api/ops/tenants/${clientId}/patch`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: next }),
      })
    } catch {
      setValue(!next)
    } finally {
      setSaving(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={saving}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
        value ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600',
        saving && 'opacity-50',
      )}
      role="switch"
      aria-checked={value}
      title={value ? 'Active' : 'Inactive'}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform',
          value ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  )
}

// ── Editable field (money) ──────────────────────────────────────────────────

function EditableField({
  label,
  value: propValue,
  format,
  suffix,
  field,
  apiPath,
}: {
  label: string
  value: number | null | undefined
  format: 'money'
  suffix?: string
  field: string
  apiPath: string
}) {
  const router = useRouter()
  // Local display value — starts from prop, then tracks user saves
  const [localValue, setLocalValue] = useState<number | null | undefined>(propValue)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasUserEdited = useRef(false)

  // Sync from prop only if user hasn't edited this field yet
  useEffect(() => {
    if (!hasUserEdited.current) {
      setLocalValue(propValue)
    }
  }, [propValue])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const startEdit = () => {
    setDraft(localValue != null ? String(localValue) : '')
    setEditing(true)
  }

  const save = async () => {
    const num = draft.trim() === '' ? null : parseFloat(draft)
    if (num !== null && isNaN(num)) {
      setEditing(false)
      return
    }
    if (num === localValue || (num === null && localValue == null)) {
      setEditing(false)
      return
    }

    hasUserEdited.current = true
    setLocalValue(num)
    setEditing(false)
    setSaving(true)
    try {
      const res = await fetch(apiPath, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: num }),
      })
      if (!res.ok) {
        console.error(`[ops] Save failed for ${field}:`, res.status, await res.text().catch(() => ''))
        setLocalValue(propValue)
        hasUserEdited.current = false
      } else {
        router.refresh()
      }
    } catch (err) {
      console.error(`[ops] Save error for ${field}:`, err)
      setLocalValue(propValue)
      hasUserEdited.current = false
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') setEditing(false)
  }

  const display =
    localValue != null
      ? `$${Math.round(localValue).toLocaleString()}${suffix ?? ''}`
      : '—'

  return (
    <div>
      <p className="text-[10px] text-[var(--brand-muted)] mb-1">{label}</p>
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          disabled={saving}
          className="w-full text-sm tabular-nums bg-[var(--brand-bg)] border border-[var(--brand-primary)]/40 rounded px-2 py-1 outline-none focus:border-[var(--brand-primary)]"
        />
      ) : (
        <button
          onClick={startEdit}
          className={cn(
            'text-sm font-medium tabular-nums text-[var(--brand-text)] hover:text-[var(--brand-primary)] transition-colors cursor-text',
            saving && 'opacity-50',
          )}
        >
          {display}
        </button>
      )}
    </div>
  )
}

// ── Config toggle ────────────────────────────────────────────────────────────

function ConfigToggle({
  icon: Icon,
  label,
  value,
  field,
  clientId,
}: {
  icon: React.ElementType
  label: string
  value: boolean
  field: string
  clientId: string
}) {
  const router = useRouter()
  const [val, setVal] = useState(value)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setVal(value)
  }, [value])

  const toggle = async () => {
    const next = !val
    setVal(next)
    setSaving(true)
    try {
      const res = await fetch(`/api/ops/tenants/${clientId}/patch`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: next }),
      })
      if (!res.ok) {
        console.error(`[ops] Save failed for ${field}:`, res.status)
        setVal(!next)
      } else {
        router.refresh()
      }
    } catch {
      setVal(!next)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-xs text-[var(--brand-muted)]">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
          val ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600',
          saving && 'opacity-50',
        )}
        role="switch"
        aria-checked={val}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform',
            val ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  )
}

// ── Config select ────────────────────────────────────────────────────────────

function ConfigSelect({
  icon: Icon,
  label,
  value,
  options,
  field,
  clientId,
}: {
  icon: React.ElementType
  label: string
  value: string
  options: { value: string; label: string }[]
  field: string
  clientId: string
}) {
  const router = useRouter()
  const [val, setVal] = useState(value)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setVal(value)
  }, [value])

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value
    const prev = val
    setVal(next)
    setSaving(true)
    try {
      const res = await fetch(`/api/ops/tenants/${clientId}/patch`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: next }),
      })
      if (!res.ok) {
        console.error(`[ops] Save failed for ${field}:`, res.status)
        setVal(prev)
      } else {
        router.refresh()
      }
    } catch {
      setVal(prev)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-xs text-[var(--brand-muted)]">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <select
        value={val}
        onChange={handleChange}
        disabled={saving}
        className={cn(
          'text-xs text-[var(--brand-text)] bg-[var(--brand-bg)] border border-[var(--brand-border)] rounded px-2 py-1 outline-none',
          saving && 'opacity-50',
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// ── Config text (editable) ───────────────────────────────────────────────────

function ConfigText({
  icon: Icon,
  label,
  value,
  field,
  clientId,
}: {
  icon: React.ElementType
  label: string
  value: string | null
  field: string
  clientId: string
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const savingRef = useRef(false)

  useEffect(() => {
    setDraft(value ?? '')
  }, [value])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const save = async () => {
    if (savingRef.current) return
    const trimmed = draft.trim()
    if (trimmed === (value ?? '')) {
      setEditing(false)
      return
    }
    savingRef.current = true
    setSaving(true)
    try {
      const res = await fetch(`/api/ops/tenants/${clientId}/patch`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: trimmed || null }),
      })
      if (!res.ok) {
        console.error(`[ops] Save failed for ${field}:`, res.status)
        setDraft(value ?? '')
      } else {
        router.refresh()
      }
    } catch {
      setDraft(value ?? '')
    } finally {
      savingRef.current = false
      setSaving(false)
      setEditing(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    }
    if (e.key === 'Escape') {
      setDraft(value ?? '')
      setEditing(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-xs text-[var(--brand-muted)] shrink-0">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          disabled={saving}
          className="text-xs text-[var(--brand-text)] bg-[var(--brand-bg)] border border-[var(--brand-primary)]/40 rounded px-2 py-1 outline-none w-44 text-right"
        />
      ) : (
        <button
          onClick={() => {
            setDraft(value ?? '')
            setEditing(true)
          }}
          className="text-xs text-[var(--brand-text)] hover:text-[var(--brand-primary)] transition-colors cursor-text truncate max-w-[200px] text-right"
        >
          {value ?? 'Not set'}
        </button>
      )}
    </div>
  )
}

// ── Config date (editable, saves to unit economics) ─────────────────────────

function ConfigDate({
  icon: Icon,
  label,
  value,
  clientId,
}: {
  icon: React.ElementType
  label: string
  value: string | null
  clientId: string
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const displayDate = value ? value.split('T')[0] : null
  const [draft, setDraft] = useState(displayDate ?? '')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [editing])

  const save = async () => {
    const trimmed = draft.trim()
    if (trimmed === (displayDate ?? '')) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/ops/unit-economics/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acquiredDate: trimmed || null }),
      })
      if (res.ok) {
        router.refresh()
      }
    } catch {
      setDraft(displayDate ?? '')
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') {
      setDraft(displayDate ?? '')
      setEditing(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-xs text-[var(--brand-muted)] shrink-0">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      {editing ? (
        <input
          ref={inputRef}
          type="date"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          disabled={saving}
          className="text-xs text-[var(--brand-text)] bg-[var(--brand-bg)] border border-[var(--brand-primary)]/40 rounded px-2 py-1 outline-none w-44 text-right"
        />
      ) : (
        <button
          onClick={() => {
            setDraft(displayDate ?? '')
            setEditing(true)
          }}
          className="text-xs text-[var(--brand-text)] hover:text-[var(--brand-primary)] transition-colors cursor-text truncate max-w-[200px] text-right"
        >
          {displayDate ?? 'Not set'}
        </button>
      )}
    </div>
  )
}
