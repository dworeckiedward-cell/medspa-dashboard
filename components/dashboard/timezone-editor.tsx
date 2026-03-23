'use client'

import { useState, useMemo } from 'react'
import { Check, Loader2, Search, X, Clock } from 'lucide-react'
import { buildTenantApiUrl } from '@/lib/dashboard/tenant-api'

export const COMMON_TIMEZONES = [
  { value: 'America/Edmonton', label: 'Calgary (MT)', region: 'North America' },
  { value: 'America/Vancouver', label: 'Vancouver (PT)', region: 'North America' },
  { value: 'America/Toronto', label: 'Toronto (ET)', region: 'North America' },
  { value: 'America/New_York', label: 'New York (ET)', region: 'North America' },
  { value: 'America/Chicago', label: 'Chicago (CT)', region: 'North America' },
  { value: 'America/Denver', label: 'Denver (MT)', region: 'North America' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PT)', region: 'North America' },
  { value: 'America/Phoenix', label: 'Phoenix (AZ)', region: 'North America' },
  { value: 'America/Halifax', label: 'Halifax (AT)', region: 'North America' },
  { value: 'America/St_Johns', label: 'St. Johns (NT)', region: 'North America' },
  { value: 'America/Winnipeg', label: 'Winnipeg (CT)', region: 'North America' },
  { value: 'America/Regina', label: 'Regina (CST)', region: 'North America' },
  { value: 'Pacific/Honolulu', label: 'Honolulu (HT)', region: 'North America' },
  { value: 'Europe/London', label: 'London (GMT)', region: 'Europe' },
  { value: 'Europe/Paris', label: 'Paris (CET)', region: 'Europe' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)', region: 'Europe' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)', region: 'Asia/Pacific' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST)', region: 'Asia/Pacific' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)', region: 'Asia/Pacific' },
] as const

function getTimezoneLabel(tz: string): string {
  const found = COMMON_TIMEZONES.find((t) => t.value === tz)
  return found ? found.label : tz.replace(/_/g, ' ').replace(/^.*\//, '')
}

interface TimezoneEditorProps {
  currentTimezone: string
  tenantSlug: string
}

export function TimezoneEditor({ currentTimezone, tenantSlug }: TimezoneEditorProps) {
  const [timezone, setTimezone] = useState(currentTimezone || 'America/Edmonton')
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return COMMON_TIMEZONES
    const q = search.toLowerCase()
    return COMMON_TIMEZONES.filter(
      (tz) =>
        tz.label.toLowerCase().includes(q) ||
        tz.value.toLowerCase().includes(q) ||
        tz.region.toLowerCase().includes(q),
    )
  }, [search])

  async function handleSelect(tz: string) {
    if (tz === timezone) {
      setOpen(false)
      return
    }
    setTimezone(tz)
    setOpen(false)
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const res = await fetch(buildTenantApiUrl('/api/tenant/timezone', tenantSlug), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: tz }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Failed (${res.status})`)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setTimezone(currentTimezone || 'America/Edmonton')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs text-[var(--brand-muted)] shrink-0">Timezone</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setOpen(true); setSearch('') }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--brand-text)] hover:text-[var(--brand-primary)] transition-colors cursor-pointer"
          >
            <Clock className="h-3 w-3 text-[var(--brand-muted)]" />
            {getTimezoneLabel(timezone)}
          </button>
          {saving && <Loader2 className="h-3 w-3 animate-spin text-[var(--brand-muted)]" />}
          {saved && <Check className="h-3.5 w-3.5 text-emerald-500" />}
          {error && <span className="text-[10px] text-red-500">{error}</span>}
        </div>
      </div>

      {/* Modal */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-sm rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--brand-border)]">
                <h3 className="text-sm font-semibold text-[var(--brand-text)]">Select Timezone</h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1 text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-bg)] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Search */}
              <div className="px-4 py-2 border-b border-[var(--brand-border)]">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--brand-muted)]" />
                  <input
                    type="text"
                    placeholder="Search timezones..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                    className="w-full pl-8 pr-3 py-2 text-xs bg-[var(--brand-bg)] border border-[var(--brand-border)] rounded-lg text-[var(--brand-text)] placeholder:text-[var(--brand-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]/50"
                  />
                </div>
              </div>

              {/* List */}
              <div className="max-h-64 overflow-y-auto py-1">
                {filtered.length === 0 && (
                  <p className="px-4 py-6 text-xs text-[var(--brand-muted)] text-center">
                    No timezones found
                  </p>
                )}
                {filtered.map((tz) => (
                  <button
                    key={tz.value}
                    onClick={() => handleSelect(tz.value)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-xs hover:bg-[var(--brand-bg)] transition-colors ${
                      timezone === tz.value
                        ? 'text-[var(--brand-primary)] font-medium bg-[var(--brand-bg)]'
                        : 'text-[var(--brand-text)]'
                    }`}
                  >
                    <span>{tz.label}</span>
                    <span className="text-[10px] text-[var(--brand-muted)]">
                      {tz.value.replace(/_/g, ' ')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
