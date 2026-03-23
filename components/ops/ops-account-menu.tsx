'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  LogOut,
  ChevronUp,
  Check,
  ExternalLink,
  Search,
  Building2,
} from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface TenantSummary {
  id: string
  name: string
  slug: string
  brand_color: string | null
  logo_url: string | null
  is_active: boolean
}

interface OpsAccountMenuProps {
  /** Operator email from server-resolved access */
  email: string | null
}

// ── Persistence key ──────────────────────────────────────────────────────────

const OPS_ACTIVE_TENANT_KEY = 'servify:ops:last-tenant'

// ── Component ────────────────────────────────────────────────────────────────

export function OpsAccountMenu({ email }: OpsAccountMenuProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [tenants, setTenants] = useState<TenantSummary[]>([])
  const [activeTenantSlug, setActiveTenantSlug] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Load active tenant from localStorage + fetch all tenants
  useEffect(() => {
    try {
      const stored = localStorage.getItem(OPS_ACTIVE_TENANT_KEY)
      if (stored) setActiveTenantSlug(stored)
    } catch {
      // localStorage unavailable
    }

    const supabase = getSupabaseBrowserClient()

    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Fetch all tenant memberships (2-step for PostgREST compat)
        const { data: memberships } = await supabase
          .from('user_tenants')
          .select('tenant_id')
          .eq('user_id', user.id)

        const tenantIds = (memberships ?? []).map((m) => m.tenant_id).filter(Boolean)
        if (tenantIds.length > 0) {
          const { data: tenantRows } = await supabase
            .from('clients')
            .select('id, name, slug, brand_color, logo_url, is_active')
            .in('id', tenantIds)
            .order('name')

          if (tenantRows) {
            setTenants(tenantRows as TenantSummary[])
          }
        }
      } catch {
        // Graceful — menu works without tenant list
      }
    })()
  }, [])

  // Focus search when opening
  useEffect(() => {
    if (open && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 50)
    }
    if (!open) setQuery('')
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  const filtered = useMemo(() => {
    if (!query) return tenants
    const q = query.toLowerCase()
    return tenants.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q),
    )
  }, [tenants, query])

  const activeTenant = useMemo(
    () => tenants.find((t) => t.slug === activeTenantSlug) ?? null,
    [tenants, activeTenantSlug],
  )

  const handleSetActive = useCallback((slug: string) => {
    setActiveTenantSlug(slug)
    try {
      localStorage.setItem(OPS_ACTIVE_TENANT_KEY, slug)
    } catch {
      // localStorage unavailable
    }
    setOpen(false)
  }, [])

  const handleOpenDashboard = useCallback((slug: string) => {
    // Also persist for the dashboard's workspace selector
    try {
      localStorage.setItem('servify:last-workspace', slug)
    } catch {
      // localStorage unavailable
    }
    setOpen(false)
    router.push(`/dashboard?tenant=${encodeURIComponent(slug)}`)
  }, [router])

  async function handleLogout() {
    const supabase = getSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const showSearch = tenants.length >= 5

  return (
    <div className="relative" ref={menuRef}>
      {/* Popover menu (above trigger) */}
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-lg overflow-hidden z-50 w-64">
          {/* User info */}
          <div className="px-3 py-2.5 border-b border-[var(--brand-border)]/50">
            <p className="text-[11px] text-[var(--brand-muted)] truncate">
              {email ?? 'Signed in'}
            </p>
            <p className="text-[10px] text-[#818cf8] font-medium mt-0.5">
              Operator
            </p>
          </div>

          {/* Search (shown when 5+ tenants) */}
          {showSearch && (
            <div className="px-2 pt-2 pb-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--brand-muted)]" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search clinics..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] pl-7 pr-3 py-1.5 text-[11px] text-[var(--brand-text)] placeholder:text-[var(--brand-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]/30"
                />
              </div>
            </div>
          )}

          {/* Tenant list */}
          {tenants.length > 0 && (
            <div className="px-1 py-1">
              <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--brand-muted)] opacity-60">
                Clinics
              </p>
              <div className="max-h-52 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="px-2.5 py-3 text-center text-[11px] text-[var(--brand-muted)]">
                    No match for &ldquo;{query}&rdquo;
                  </p>
                ) : (
                  filtered.map((t) => {
                    const isActive = t.slug === activeTenantSlug
                    return (
                      <div
                        key={t.id}
                        className={cn(
                          'flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors group',
                          isActive
                            ? 'bg-[var(--brand-primary)]/5'
                            : 'hover:bg-[var(--brand-border)]/30',
                        )}
                      >
                        {/* Click row = Set Active */}
                        <button
                          type="button"
                          onClick={() => handleSetActive(t.slug)}
                          className="flex items-center gap-2 min-w-0 flex-1 text-left"
                        >
                          <div
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white text-[10px] font-bold overflow-hidden"
                            style={{ background: t.brand_color ?? 'var(--brand-primary)' }}
                          >
                            {t.logo_url ? (
                              <Image src={t.logo_url} alt={t.name} width={28} height={28} className="object-cover" />
                            ) : (
                              t.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-[var(--brand-text)] truncate leading-tight">
                              {t.name}
                            </p>
                            <p className="text-[10px] text-[var(--brand-muted)] truncate leading-tight">
                              {t.slug}
                            </p>
                          </div>
                        </button>

                        {/* Active indicator OR actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {isActive && (
                            <Check className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                          )}
                          {!t.is_active && (
                            <span className="rounded-full bg-amber-100 dark:bg-amber-950/40 px-1.5 py-0.5 text-[9px] font-medium text-amber-600 dark:text-amber-400">
                              Off
                            </span>
                          )}
                          {/* Open Dashboard link */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenDashboard(t.slug)
                            }}
                            title={`Open ${t.name} dashboard`}
                            className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-[var(--brand-border)]/50 transition-all"
                          >
                            <ExternalLink className="h-3 w-3 text-[var(--brand-muted)]" />
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="px-1 py-1 border-t border-[var(--brand-border)]/50 space-y-0.5">
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 text-left transition-colors duration-150',
          'hover:bg-[var(--brand-border)]/30',
          open && 'bg-[var(--brand-border)]/30',
        )}
        aria-label="Ops account menu"
        aria-expanded={open}
      >
        {activeTenant ? (
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white text-[10px] font-bold overflow-hidden"
            style={{ background: activeTenant.brand_color ?? 'var(--brand-primary)' }}
          >
            {activeTenant.logo_url ? (
              <Image src={activeTenant.logo_url} alt={activeTenant.name} width={28} height={28} className="object-cover" />
            ) : (
              activeTenant.name.charAt(0).toUpperCase()
            )}
          </div>
        ) : (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#6366f1]/10 text-[#818cf8]">
            <Building2 className="h-3.5 w-3.5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-[var(--brand-text)] truncate leading-tight">
            {activeTenant?.name ?? 'Operator Console'}
          </p>
          <p className="text-[10px] text-[var(--brand-muted)] truncate leading-tight">
            {email ?? 'Operator'}
          </p>
        </div>
        <ChevronUp className={cn(
          'h-3.5 w-3.5 text-[var(--brand-muted)] transition-transform shrink-0',
          !open && 'rotate-180',
        )} />
      </button>
    </div>
  )
}
