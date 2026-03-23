'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, ChevronDown, Search, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// Minimal client record needed for the switcher — keeps server→client transfer small
export interface ClinicSwitcherItem {
  id: string
  name: string
  slug: string
  brand_color: string | null
}

interface OpsClinicSwitcherProps {
  clinics: ClinicSwitcherItem[]
  /** The currently selected client ID (undefined = All Clients) */
  currentClientId?: string | null
}

export function OpsClinicSwitcher({ clinics, currentClientId }: OpsClinicSwitcherProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const current = currentClientId
    ? clinics.find((c) => c.id === currentClientId)
    : null

  const filtered = useMemo(() => {
    if (!search) return clinics
    const q = search.toLowerCase()
    return clinics.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q),
    )
  }, [clinics, search])

  function handleSelect(clientId: string | null) {
    setOpen(false)
    setSearch('')
    router.push(clientId ? `/ops/clients/${clientId}` : '/ops')
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-1.5 text-xs font-medium text-[var(--brand-text)] hover:bg-[var(--brand-bg)] transition-colors"
      >
        {current ? (
          <>
            <div
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-white text-[8px] font-bold"
              style={{ background: current.brand_color ?? '#2563EB' }}
            >
              {current.name.charAt(0).toUpperCase()}
            </div>
            <span className="max-w-[120px] truncate">{current.name}</span>
          </>
        ) : (
          <>
            <Building2 className="h-3.5 w-3.5 text-[var(--brand-muted)]" />
            <span>All Clients</span>
          </>
        )}
        <ChevronDown
          className={cn(
            'h-3 w-3 text-[var(--brand-muted)] transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => { setOpen(false); setSearch('') }}
          />
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1.5 z-50 w-64 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-xl overflow-hidden">
            {/* Search */}
            <div className="p-2 border-b border-[var(--brand-border)]">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--brand-muted)]" />
                <input
                  autoFocus
                  placeholder="Search clients…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-md border border-[var(--brand-border)] bg-[var(--brand-bg)] pl-7 pr-3 py-1.5 text-xs text-[var(--brand-text)] placeholder:text-[var(--brand-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]/30"
                />
              </div>
            </div>

            {/* List */}
            <div className="max-h-64 overflow-y-auto py-1">
              {/* All clients */}
              <button
                onClick={() => handleSelect(null)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-[var(--brand-bg)] transition-colors text-left',
                  !currentClientId
                    ? 'text-[var(--brand-primary)] font-medium'
                    : 'text-[var(--brand-text)]',
                )}
              >
                <Building2 className="h-4 w-4 shrink-0 text-[var(--brand-muted)]" />
                <span className="flex-1">All Clients</span>
                {!currentClientId && <Check className="h-3 w-3 shrink-0" />}
              </button>

              {/* Client list */}
              {filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSelect(c.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-[var(--brand-bg)] transition-colors text-left',
                    currentClientId === c.id
                      ? 'text-[var(--brand-primary)] font-medium'
                      : 'text-[var(--brand-text)]',
                  )}
                >
                  <div
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-white text-[9px] font-bold"
                    style={{ background: c.brand_color ?? '#2563EB' }}
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{c.name}</p>
                    <p className="text-[10px] text-[var(--brand-muted)] truncate">{c.slug}</p>
                  </div>
                  {currentClientId === c.id && <Check className="h-3 w-3 shrink-0" />}
                </button>
              ))}

              {filtered.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-[var(--brand-muted)]">
                  No clients match
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
