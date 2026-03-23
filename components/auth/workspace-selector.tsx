'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Search, Terminal } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface WorkspaceTenant {
  id: string
  name: string
  slug: string
  brandColor: string | null
  logoUrl: string | null
  isActive: boolean
}

interface WorkspaceSelectorProps {
  tenants: WorkspaceTenant[]
  hasOpsAccess: boolean
}

// ── Persistence key ──────────────────────────────────────────────────────────

const LAST_WORKSPACE_KEY = 'servify:last-workspace'

// ── Component ────────────────────────────────────────────────────────────────

export function WorkspaceSelector({ tenants, hasOpsAccess }: WorkspaceSelectorProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')

  // No auto-redirect — user must always explicitly choose a workspace.

  const filtered = useMemo(() => {
    if (!query) return tenants
    const q = query.toLowerCase()
    return tenants.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q),
    )
  }, [tenants, query])

  const showSearch = tenants.length >= 5

  function handleSelect(tenant: WorkspaceTenant) {
    // Persist selection for UX hint (not for auto-redirect)
    try { localStorage.setItem(LAST_WORKSPACE_KEY, tenant.slug) } catch { /* ignore */ }
    // Navigate to prepare page for premium loading transition
    router.push(`/dashboard/prepare?tenant=${encodeURIComponent(tenant.slug)}`)
  }

  return (
    <div className="space-y-3">
      {/* Search (shown when 5+ workspaces) */}
      {showSearch && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--brand-muted)]" />
          <input
            type="text"
            placeholder="Search workspaces…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] pl-9 pr-4 py-2.5 text-sm text-[var(--brand-text)] placeholder:text-[var(--brand-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
          />
        </div>
      )}

      {/* Workspace list */}
      <ul className={cn('space-y-2', showSearch && 'max-h-80 overflow-y-auto')}>
        {filtered.length === 0 ? (
          <li className="py-8 text-center text-sm text-[var(--brand-muted)]">
            No workspaces match &ldquo;{query}&rdquo;
          </li>
        ) : (
          filtered.map((tenant) => (
            <li key={tenant.id}>
              <button
                type="button"
                onClick={() => handleSelect(tenant)}
                className="group flex items-center gap-3 w-full rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 hover:border-[var(--brand-primary)]/50 hover:bg-[var(--brand-primary)]/5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] text-left"
              >
                {/* Monogram / logo */}
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold overflow-hidden"
                  style={{
                    background: tenant.logoUrl ? '#ffffff' : (tenant.brandColor ?? 'var(--brand-primary)'),
                    color: tenant.logoUrl ? undefined : '#ffffff',
                  }}
                >
                  {tenant.logoUrl ? (
                    <Image
                      src={tenant.logoUrl}
                      alt={tenant.name}
                      width={40}
                      height={40}
                      className="object-cover"
                    />
                  ) : (
                    tenant.name.charAt(0).toUpperCase()
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--brand-text)] truncate leading-snug">
                    {tenant.name}
                  </p>
                  <p className="text-xs text-[var(--brand-muted)] font-mono truncate mt-0.5">
                    {tenant.slug}
                  </p>
                </div>

                {/* Status + chevron */}
                <div className="flex items-center gap-2 shrink-0">
                  {!tenant.isActive && (
                    <span className="rounded-full bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                      Inactive
                    </span>
                  )}
                  <span className="text-[var(--brand-muted)] group-hover:text-[var(--brand-primary)] transition-colors duration-150 text-xs">
                    →
                  </span>
                </div>
              </button>
            </li>
          ))
        )}
      </ul>

      {/* Ops console button (only for authorized operators) */}
      {hasOpsAccess && (
        <button
          type="button"
          onClick={() => router.push('/ops')}
          className="flex items-center justify-center gap-2 w-full rounded-xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:border-[var(--brand-text)]/20 transition-colors duration-150"
        >
          <Terminal className="h-4 w-4" />
          Open Operator Console
        </button>
      )}
    </div>
  )
}
