'use client'

/**
 * CommandPalette — Cmd+K (Mac) / Ctrl+K (Win/Linux) global shortcut palette.
 *
 * Navigation commands: jump to any dashboard section.
 * ESC or backdrop click to close.
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  PhoneIncoming,
  PhoneOutgoing,
  Plug,
  Settings,
  Search,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Client } from '@/types/database'

// ── Command definition ────────────────────────────────────────────────────────

interface Command {
  id: string
  label: string
  description?: string
  icon: React.ElementType
  action: () => void
  keywords?: string[]
}

// ── Palette item ──────────────────────────────────────────────────────────────

function PaletteItem({
  cmd,
  isActive,
  onSelect,
}: {
  cmd: Command
  isActive: boolean
  onSelect: () => void
}) {
  const Icon = cmd.icon
  return (
    <button
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
        isActive
          ? 'bg-[var(--user-accent-soft)] text-[var(--brand-text)]'
          : 'text-[var(--brand-text)] hover:bg-[var(--brand-border)]/50',
      )}
      onClick={onSelect}
    >
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border',
          isActive
            ? 'border-[var(--user-accent)]/40 bg-[var(--user-accent)]/10 text-[var(--user-accent)]'
            : 'border-[var(--brand-border)] bg-[var(--brand-surface)] text-[var(--brand-muted)]',
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{cmd.label}</p>
        {cmd.description && (
          <p className="text-[10px] text-[var(--brand-muted)] truncate">{cmd.description}</p>
        )}
      </div>
      {isActive && (
        <ArrowRight className="h-3.5 w-3.5 text-[var(--user-accent)] shrink-0" />
      )}
    </button>
  )
}

// ── CommandPalette ────────────────────────────────────────────────────────────

interface CommandPaletteProps {
  tenant: Client
}

export function CommandPalette({ tenant }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const slug = tenant.slug

  const allCommands: Command[] = useMemo(() => [
    {
      id: 'overview',
      label: 'Overview',
      description: 'Dashboard home — KPIs, chart, call logs',
      icon: LayoutDashboard,
      action: () => router.push(`/dashboard`),
      keywords: ['home', 'main', 'overview', 'kpi'],
    },
    {
      id: 'inbound',
      label: 'Inbound Calls',
      description: 'Leads and inbound call analytics',
      icon: PhoneIncoming,
      action: () => router.push(`/dashboard`),
      keywords: ['inbound', 'incoming', 'lead'],
    },
    {
      id: 'outbound',
      label: 'Outbound / Speed-to-Lead',
      description: 'Outbound calls and callback queue',
      icon: PhoneOutgoing,
      action: () => router.push(`/dashboard`),
      keywords: ['outbound', 'callback', 'speed', 'lead'],
    },
    {
      id: 'integrations',
      label: 'Integrations',
      description: 'CRM webhooks and delivery logs',
      icon: Plug,
      action: () => router.push(`/dashboard/integrations`),
      keywords: ['crm', 'webhook', 'integration', 'hubspot', 'ghl'],
    },
    {
      id: 'settings',
      label: 'Settings',
      description: 'Tenant configuration',
      icon: Settings,
      action: () => router.push(`/dashboard/settings`),
      keywords: ['settings', 'config', 'tenant', slug],
    },
  ], [router, slug])

  const filtered = useMemo(() => {
    if (!query) return allCommands
    const q = query.toLowerCase()
    return allCommands.filter((cmd) =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.description?.toLowerCase().includes(q) ||
      cmd.keywords?.some((k) => k.toLowerCase().includes(q)),
    )
  }, [allCommands, query])

  // Reset active index when filtered list changes
  useEffect(() => {
    setActiveIndex(0)
  }, [filtered.length])

  // Cmd+K / Ctrl+K global listener
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  // Arrow keys / Enter / Escape when open
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter' && filtered[activeIndex]) {
        filtered[activeIndex].action()
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, filtered, activeIndex])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      const id = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(id)
    } else {
      setQuery('')
      setActiveIndex(0)
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-2xl animate-in fade-in slide-in-from-top-4 duration-200">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--brand-border)]">
          <Search className="h-4 w-4 shrink-0 text-[var(--brand-muted)]" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search commands…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[var(--brand-text)] placeholder:text-[var(--brand-muted)] outline-none"
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-[var(--brand-border)] bg-[var(--brand-bg)] px-1.5 text-[10px] font-mono text-[var(--brand-muted)]">
            ESC
          </kbd>
        </div>

        {/* Commands list */}
        <div className="p-2 max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--brand-muted)]">
              No commands found for &ldquo;{query}&rdquo;
            </p>
          ) : (
            <>
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--brand-muted)] opacity-60">
                Navigation
              </p>
              {filtered.map((cmd, i) => (
                <PaletteItem
                  key={cmd.id}
                  cmd={cmd}
                  isActive={i === activeIndex}
                  onSelect={() => {
                    cmd.action()
                    setOpen(false)
                    setQuery('')
                  }}
                />
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t border-[var(--brand-border)] px-4 py-2 text-[10px] text-[var(--brand-muted)]">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-[var(--brand-border)] bg-[var(--brand-bg)] px-1 py-0.5 font-mono">↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-[var(--brand-border)] bg-[var(--brand-bg)] px-1 py-0.5 font-mono">↵</kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-[var(--brand-border)] bg-[var(--brand-bg)] px-1 py-0.5 font-mono">ESC</kbd>
            close
          </span>
          <span className="ml-auto opacity-60">{tenant.name}</span>
        </div>
      </div>
    </div>
  )
}
