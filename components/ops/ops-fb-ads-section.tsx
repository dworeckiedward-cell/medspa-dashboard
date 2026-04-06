'use client'

import { useState, useCallback } from 'react'
import {
  DollarSign,
  PhoneCall,
  UserCheck,
  Target,
  TrendingUp,
  Calendar,
  Loader2,
  Check,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface FbAdsMetrics {
  totalLeads: number
  bookedCalls: number
  showedUp: number
  closed: number
  totalCalls: number
  avgLeadCostCents: number | null
}

interface OpsClinicFbAds {
  clientId: string
  clientName: string
  slug: string
  monthlyAdSpendCents: number | null
  calendlyUrl: string | null
  metrics: FbAdsMetrics
}

interface OpsAdSpendInputProps {
  clientId: string
  initialCents: number | null
  onSaved?: (cents: number) => void
}

interface OpsFbAdsSectionProps {
  clinics: OpsClinicFbAds[]
}

// ── Mini KPI Card ────────────────────────────────────────────────────────────

function MiniKpi({ label, value, sub, icon: Icon, color }: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider font-medium text-[var(--brand-muted)]">{label}</span>
        <div className={cn('flex h-6 w-6 items-center justify-center rounded-lg', `bg-[${color}]/10`)}>
          <Icon className="h-3 w-3" style={{ color }} />
        </div>
      </div>
      <p className="text-lg font-bold text-[var(--brand-text)]">{value}</p>
      {sub && <p className="text-[10px] text-[var(--brand-muted)] mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Ad Spend Input ───────────────────────────────────────────────────────────

function AdSpendInput({ clientId, initialCents, onSaved }: OpsAdSpendInputProps) {
  const [value, setValue] = useState(initialCents != null ? (initialCents / 100).toFixed(0) : '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const dirty = Number(value) * 100 !== (initialCents ?? 0)

  const save = useCallback(async () => {
    setSaving(true)
    setSaved(false)
    const cents = Math.round(Number(value) * 100)
    try {
      const res = await fetch(`/api/ops/tenants/${clientId}/patch`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthly_ad_spend_cents: cents }),
      })
      if (res.ok) {
        setSaved(true)
        onSaved?.(cents)
        setTimeout(() => setSaved(false), 3000)
      }
    } finally {
      setSaving(false)
    }
  }, [clientId, value, onSaved])

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--brand-muted)]">$</span>
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0"
          className="w-28 pl-7 pr-3 py-1.5 text-sm rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] text-[var(--brand-text)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]/50"
        />
      </div>
      {dirty && (
        <button
          onClick={save}
          disabled={saving}
          className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-[var(--brand-primary)] text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
        </button>
      )}
      {saved && <Check className="h-3.5 w-3.5 text-emerald-500" />}
    </div>
  )
}

// ── Calendly Widget ──────────────────────────────────────────────────────────

function CalendlyWidget({ clientId, initialUrl }: { clientId: string; initialUrl: string | null }) {
  const [url, setUrl] = useState(initialUrl ?? '')
  const [editing, setEditing] = useState(!initialUrl)
  const [saving, setSaving] = useState(false)

  const save = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/ops/tenants/${clientId}/patch`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendly_url: url || null }),
      })
      if (res.ok) setEditing(false)
    } finally {
      setSaving(false)
    }
  }, [clientId, url])

  if (editing || !url) {
    return (
      <div className="space-y-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://calendly.com/your-link"
          className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] text-[var(--brand-text)] placeholder:text-[var(--brand-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]/50"
        />
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving || !url}
            className="text-[11px] font-medium px-3 py-1.5 rounded-lg bg-[var(--brand-primary)] text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          {initialUrl && (
            <button
              onClick={() => { setUrl(initialUrl); setEditing(false) }}
              className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-[var(--brand-border)] text-[var(--brand-muted)] hover:text-[var(--brand-text)]"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--brand-primary)] hover:underline flex items-center gap-1">
          {url} <ExternalLink className="h-3 w-3" />
        </a>
        <button onClick={() => setEditing(true)} className="text-[10px] text-[var(--brand-muted)] hover:text-[var(--brand-text)]">
          Edit
        </button>
      </div>
      <div className="rounded-lg border border-[var(--brand-border)] overflow-hidden" style={{ height: 350 }}>
        <iframe
          src={url}
          width="100%"
          height="100%"
          frameBorder="0"
          title="Calendly booking"
          className="bg-white"
        />
      </div>
    </div>
  )
}

// ── Main Section ─────────────────────────────────────────────────────────────

function fmt(cents: number | null): string {
  if (cents == null || cents === 0) return '—'
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function pct(num: number, den: number): string {
  if (den === 0) return '—'
  return (num / den * 100).toFixed(1) + '%'
}

export function OpsFbAdsSection({ clinics }: OpsFbAdsSectionProps) {
  if (clinics.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-8 text-center">
        <p className="text-sm text-[var(--brand-muted)]">No clinics with FB Ads data</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {clinics.map((clinic) => {
        const m = clinic.metrics
        const adSpend = clinic.monthlyAdSpendCents
        const costPerBookedCall = adSpend && m.bookedCalls > 0
          ? Math.round(adSpend / m.bookedCalls)
          : null
        const costPerLead = adSpend && m.totalLeads > 0
          ? Math.round(adSpend / m.totalLeads)
          : null

        return (
          <div key={clinic.clientId} className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--brand-border)]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10">
                  <Target className="h-3.5 w-3.5 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--brand-text)]">{clinic.clientName}</h3>
                  <p className="text-[10px] text-[var(--brand-muted)]">FB Ads Performance</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-[var(--brand-muted)]">Monthly Ad Spend</span>
                <AdSpendInput clientId={clinic.clientId} initialCents={adSpend} />
              </div>
            </div>

            {/* Metrics */}
            <div className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <MiniKpi
                  label="Cost / Booked Call"
                  value={fmt(costPerBookedCall)}
                  sub={`${m.bookedCalls} booked`}
                  icon={PhoneCall}
                  color="#6366f1"
                />
                <MiniKpi
                  label="Show Rate"
                  value={pct(m.showedUp, m.bookedCalls)}
                  sub={`${m.showedUp} showed / ${m.bookedCalls} booked`}
                  icon={UserCheck}
                  color="#10b981"
                />
                <MiniKpi
                  label="Close Rate"
                  value={pct(m.closed, m.totalCalls)}
                  sub={`${m.closed} closed / ${m.totalCalls} calls`}
                  icon={TrendingUp}
                  color="#f59e0b"
                />
                <MiniKpi
                  label="Cost / Lead"
                  value={fmt(costPerLead)}
                  sub={`${m.totalLeads} leads`}
                  icon={DollarSign}
                  color="#ef4444"
                />
              </div>

              {/* Calendly */}
              <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-bg)] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-[var(--brand-primary)]" />
                  <span className="text-sm font-medium text-[var(--brand-text)]">Calendly Booking</span>
                </div>
                <CalendlyWidget clientId={clinic.clientId} initialUrl={clinic.calendlyUrl} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
