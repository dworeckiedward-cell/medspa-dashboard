'use client'

/**
 * WorkspaceSwitcher — sidebar footer component for switching clinics.
 *
 * Shows the currently selected clinic (logo/initial, name, slug).
 * Clicking opens a popover listing all accessible clinics.
 * Selecting a clinic routes through /dashboard/prepare?tenant=<slug>
 * for a consistent premium transition.
 */

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  LogOut,
  ChevronUp,
  Terminal,
  Check,
  ArrowRightLeft,
} from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Client } from '@/types/database'

// ── Types ────────────────────────────────────────────────────────────────────

interface WorkspaceSwitcherProps {
  tenant: Client
}

interface TenantSummary {
  id: string
  name: string
  slug: string
  brand_color: string | null
  logo_url: string | null
}

// ── Component ────────────────────────────────────────────────────────────────

export function WorkspaceSwitcher({ tenant }: WorkspaceSwitcherProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [allTenants, setAllTenants] = useState<TenantSummary[]>([])
  const [hasOps, setHasOps] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fetch user info + all tenants on mount
  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        setEmail(user.email ?? null)

        // Step 1: Get tenant IDs from user_tenants
        const { data: memberships } = await supabase
          .from('user_tenants')
          .select('tenant_id')
          .eq('user_id', user.id)

        const tenantIds = (memberships ?? []).map((m) => m.tenant_id).filter(Boolean)
        if (tenantIds.length > 0) {
          // Step 2: Get base tenant info from tenants table (tenant_id always matches tenants.id)
          const { data: tenantBaseRows } = await supabase
            .from('tenants')
            .select('id, name, slug')
            .in('id', tenantIds)
            .order('name', { ascending: true })

          if (tenantBaseRows && tenantBaseRows.length > 0) {
            // Step 3: Get branding from clients by slug (the reliable cross-table key)
            const slugs = (tenantBaseRows as Array<{ id: string; name: string; slug: string }>)
              .map((t) => t.slug)
              .filter(Boolean)

            let brandingBySlug = new Map<string, { brand_color: string | null; logo_url: string | null }>()
            try {
              const { data: brandingRows } = await supabase
                .from('clients')
                .select('slug, brand_color, logo_url')
                .in('slug', slugs)

              if (brandingRows) {
                brandingBySlug = new Map(
                  (brandingRows as Array<{ slug: string; brand_color: string | null; logo_url: string | null }>)
                    .map((b) => [b.slug, { brand_color: b.brand_color, logo_url: b.logo_url }]),
                )
              }
            } catch {
              // Graceful — show tenants without branding
            }

            const merged: TenantSummary[] = (tenantBaseRows as Array<{ id: string; name: string; slug: string }>).map((t) => {
              const branding = brandingBySlug.get(t.slug)
              // For the current tenant, prefer server-prop data (which bypasses RLS
              // via service-role). Client-side anon queries may not have RLS access
              // to the clients table.
              const isCurrent = t.id === tenant.id
              return {
                id: t.id,
                name: t.name,
                slug: t.slug,
                brand_color: (isCurrent ? tenant.brand_color : null) ?? branding?.brand_color ?? null,
                logo_url: (isCurrent ? tenant.logo_url : null) ?? branding?.logo_url ?? null,
              }
            })

            setAllTenants(merged)
          }
        }

        // Check ops access
        try {
          const opsRes = await fetch('/api/ops/check-access')
          if (opsRes.ok) {
            const { hasAccess } = await opsRes.json()
            setHasOps(hasAccess === true)
          }
        } catch {
          // Graceful — hide ops button on error
        }
      } catch {
        // Graceful — switcher works without these features
      }
    })()
  }, [tenant.id])

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

  function handleSwitchTenant(slug: string) {
    try {
      localStorage.setItem('servify:last-workspace', slug)
    } catch {
      /* ignore */
    }
    setOpen(false)
    // Route through prepare page for premium transition
    router.push(`/dashboard/prepare?tenant=${encodeURIComponent(slug)}`)
  }

  async function handleLogout() {
    const supabase = getSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const tenantInitial = tenant.name.charAt(0).toUpperCase()
  const isSingleTenant = allTenants.length <= 1

  return (
    <div className="relative" ref={menuRef}>
      {/* Popover menu (above trigger) */}
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-lg overflow-hidden z-50">
          {/* User info */}
          <div className="px-3 py-2.5 border-b border-[var(--brand-border)]/50">
            <p className="text-[11px] text-[var(--brand-muted)] truncate">
              {email ?? 'Signed in'}
            </p>
          </div>

          {/* Clinic list */}
          <div className="px-1 py-1">
            {allTenants.length === 0 ? (
              /* Still loading or no memberships found — show current only */
              <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-[var(--brand-primary)]/5">
                <TenantAvatar
                  name={tenant.name}
                  logoUrl={tenant.logo_url}
                  brandColor={tenant.brand_color}
                />
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-medium text-[var(--brand-text)] truncate block">
                    {tenant.name}
                  </span>
                </div>
                <Check className="h-3.5 w-3.5 text-[var(--brand-primary)] shrink-0" />
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto">
                {allTenants.map((t) => {
                  const isCurrent = t.id === tenant.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => !isCurrent && handleSwitchTenant(t.slug)}
                      disabled={isCurrent}
                      className={cn(
                        'flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left transition-colors',
                        isCurrent
                          ? 'bg-[var(--brand-primary)]/5 cursor-default'
                          : 'hover:bg-[var(--brand-border)]/30',
                      )}
                    >
                      <TenantAvatar
                        name={t.name}
                        logoUrl={t.logo_url}
                        brandColor={t.brand_color}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-medium text-[var(--brand-text)] truncate block">
                          {t.name}
                        </span>
                        <span className="text-[10px] text-[var(--brand-muted)] font-mono truncate block mt-0.5">
                          {t.slug}
                        </span>
                      </div>
                      {isCurrent && (
                        <Check className="h-3.5 w-3.5 text-[var(--brand-primary)] shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Switch clinic + actions */}
          <div className="px-1 py-1 border-t border-[var(--brand-border)]/50 space-y-0.5">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                router.push('/dashboard/select-tenant')
              }}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-border)]/30 transition-colors"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Switch clinic…
            </button>

            {hasOps && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  router.push('/ops')
                }}
                className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-border)]/30 transition-colors"
              >
                <Terminal className="h-3.5 w-3.5" />
                Operator Console
              </button>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>

          {/* Single tenant hint */}
          {isSingleTenant && allTenants.length > 0 && (
            <div className="px-3 py-2 border-t border-[var(--brand-border)]/50">
              <p className="text-[10px] text-[var(--brand-muted)] opacity-60 text-center">
                Only 1 clinic on this account
              </p>
            </div>
          )}
        </div>
      )}

      {/* Trigger button — compact, no redundant tenant name/slug */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 w-full rounded-lg px-2.5 py-2 text-left transition-colors duration-150',
          'hover:bg-white/[0.07]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-1 focus-visible:ring-offset-[#111827]',
          open && 'bg-white/[0.07]',
        )}
        aria-label="Switch workspace"
        aria-expanded={open}
      >
        <ArrowRightLeft className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-[11px] text-slate-400 truncate">
          {email ?? 'Account'}
        </span>
        <ChevronUp
          className={cn(
            'h-3.5 w-3.5 text-slate-400 transition-transform shrink-0 ml-auto',
            !open && 'rotate-180',
          )}
        />
      </button>
    </div>
  )
}

// ── Shared avatar ────────────────────────────────────────────────────────────

function TenantAvatar({
  name,
  logoUrl,
  brandColor,
}: {
  name: string
  logoUrl: string | null
  brandColor: string | null
}) {
  return (
    <div
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold overflow-hidden"
      style={{
        background: logoUrl ? '#ffffff' : (brandColor ?? 'var(--brand-primary)'),
        color: logoUrl ? undefined : '#ffffff',
      }}
    >
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={name}
          width={28}
          height={28}
          className="object-cover"
        />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  )
}
