'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { LogOut, ChevronUp, Building2, Terminal, Check } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Client } from '@/types/database'

// ── Types ────────────────────────────────────────────────────────────────────

interface SidebarAccountMenuProps {
  tenant: Client
}

interface UserTenantRow {
  client_id: string
  clients: {
    id: string
    name: string
    slug: string
    brand_color: string | null
    logo_url: string | null
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function SidebarAccountMenu({ tenant }: SidebarAccountMenuProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [otherTenants, setOtherTenants] = useState<UserTenantRow['clients'][]>([])
  const [hasOps, setHasOps] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fetch user info + other tenants on mount
  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        setEmail(user.email ?? null)

        // Fetch all tenant memberships for switching
        const { data: memberships } = await supabase
          .from('user_tenants')
          .select('client_id, clients:client_id(id, name, slug, brand_color, logo_url)')
          .eq('user_id', user.id)

        if (memberships) {
          const others = memberships
            .map((m) => m.clients as unknown as UserTenantRow['clients'])
            .filter((t): t is UserTenantRow['clients'] => t !== null && t.id !== tenant.id)
          setOtherTenants(others)
        }

        // Check ops access via server-resolved endpoint (single source of truth)
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
        // Graceful — menu works without these features
      }
    })()
  }, [tenant.id])

  // Close menu on outside click
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

  async function handleLogout() {
    const supabase = getSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function handleSwitchTenant(slug: string) {
    localStorage.setItem('servify:last-workspace', slug)
    setOpen(false)
    router.push(`/dashboard?tenant=${encodeURIComponent(slug)}`)
  }

  const tenantInitial = tenant.name.charAt(0).toUpperCase()

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

          {/* Current workspace */}
          <div className="px-1 py-1">
            <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-[var(--brand-primary)]/5">
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white text-[10px] font-bold overflow-hidden"
                style={{ background: tenant.brand_color ?? 'var(--brand-primary)' }}
              >
                {tenant.logo_url ? (
                  <Image src={tenant.logo_url} alt={tenant.name} width={28} height={28} className="object-cover" />
                ) : (
                  tenantInitial
                )}
              </div>
              <span className="text-xs font-medium text-[var(--brand-text)] truncate flex-1">
                {tenant.name}
              </span>
              <Check className="h-3.5 w-3.5 text-[var(--brand-primary)] shrink-0" />
            </div>
          </div>

          {/* Other tenants */}
          {otherTenants.length > 0 && (
            <div className="px-1 py-1 border-t border-[var(--brand-border)]/50">
              <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--brand-muted)] opacity-60">
                Switch workspace
              </p>
              <div className="max-h-40 overflow-y-auto">
                {otherTenants.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSwitchTenant(t.slug)}
                    className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left hover:bg-[var(--brand-border)]/30 transition-colors"
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
                    <span className="text-xs text-[var(--brand-text)] truncate flex-1">
                      {t.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="px-1 py-1 border-t border-[var(--brand-border)]/50 space-y-0.5">
            {hasOps && (
              <button
                type="button"
                onClick={() => { setOpen(false); router.push('/ops') }}
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
        aria-label="Account menu"
        aria-expanded={open}
      >
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white text-[10px] font-bold overflow-hidden"
          style={{ background: tenant.brand_color ?? 'var(--brand-primary)' }}
        >
          {tenant.logo_url ? (
            <Image src={tenant.logo_url} alt={tenant.name} width={28} height={28} className="object-cover" />
          ) : (
            tenantInitial
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-[var(--brand-text)] truncate leading-tight">
            {tenant.name}
          </p>
          {email && (
            <p className="text-[10px] text-[var(--brand-muted)] truncate leading-tight">
              {email}
            </p>
          )}
        </div>
        <ChevronUp className={cn(
          'h-3.5 w-3.5 text-[var(--brand-muted)] transition-transform shrink-0',
          !open && 'rotate-180',
        )} />
      </button>
    </div>
  )
}
