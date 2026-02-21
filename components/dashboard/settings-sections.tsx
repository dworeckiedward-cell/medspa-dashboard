'use client'

import { useState, useEffect } from 'react'
import { Check, Copy } from 'lucide-react'
import { ThemeToggle } from './theme-toggle'

// ── Notification preferences ───────────────────────────────────────────────────

const NOTIF_PREFS_KEY = 'dashboard-notif-prefs'

interface NotifPrefs {
  showBooked: boolean
  showFollowUp: boolean
  soundOnBooking: boolean
}

const DEFAULT_PREFS: NotifPrefs = {
  showBooked: true,
  showFollowUp: true,
  soundOnBooking: false,
}

function getStoredPrefs(): NotifPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS
  try {
    const raw = localStorage.getItem(NOTIF_PREFS_KEY)
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS
  } catch {
    return DEFAULT_PREFS
  }
}

// ── Exported sections ──────────────────────────────────────────────────────────

export function AppearanceSection() {
  return (
    <SettingsSection
      title="Appearance"
      description="Choose how the dashboard looks on your device. Your preference is saved locally and does not affect other users."
    >
      <div className="flex items-center justify-between gap-6">
        <div>
          <p className="text-sm font-medium text-[var(--brand-text)]">Theme</p>
          <p className="text-xs text-[var(--brand-muted)] mt-0.5">
            System follows your operating system preference
          </p>
        </div>
        <ThemeToggle />
      </div>
    </SettingsSection>
  )
}

export function NotificationSection() {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setPrefs(getStoredPrefs())
    setMounted(true)
  }, [])

  function toggle(key: keyof NotifPrefs) {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(next))
      return next
    })
  }

  const rows: { key: keyof NotifPrefs; label: string; description: string }[] = [
    {
      key: 'showBooked',
      label: 'Booked appointment notifications',
      description: 'Show confirmed bookings in the header notification bell',
    },
    {
      key: 'showFollowUp',
      label: 'Follow-up badge',
      description: 'Display count of calls requiring human follow-up in header subtitle',
    },
    {
      key: 'soundOnBooking',
      label: 'Sound on new booking',
      description: 'Play a subtle chime when a new booking is confirmed (requires page to be active)',
    },
  ]

  return (
    <SettingsSection
      title="Notifications"
      description="Control how you are alerted about activity in your workspace."
    >
      {!mounted ? (
        <div className="space-y-4">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="h-3.5 w-40 rounded bg-[var(--brand-border)] animate-pulse" />
                <div className="h-2.5 w-56 rounded bg-[var(--brand-border)]/60 animate-pulse" />
              </div>
              <div className="h-5 w-9 rounded-full bg-[var(--brand-border)] animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-6">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--brand-text)]">{row.label}</p>
                <p className="text-xs text-[var(--brand-muted)] mt-0.5">{row.description}</p>
              </div>
              <ToggleSwitch checked={prefs[row.key]} onToggle={() => toggle(row.key)} />
            </div>
          ))}
        </div>
      )}
    </SettingsSection>
  )
}

export function AdvancedSection() {
  const [refreshTime, setRefreshTime] = useState<string>('')

  useEffect(() => {
    setRefreshTime(new Date().toLocaleTimeString())
  }, [])

  const rows = [
    { label: 'App version', value: 'MVP' },
    {
      label: 'Environment',
      value: process.env.NODE_ENV ?? 'development',
    },
    { label: 'Last data refresh', value: refreshTime || '—' },
  ]

  return (
    <SettingsSection
      title="Advanced"
      description="Runtime diagnostics and session information."
    >
      <div className="space-y-1">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between py-1.5 border-b border-[var(--brand-border)] last:border-0"
          >
            <span className="text-xs text-[var(--brand-muted)]">{row.label}</span>
            <span className="text-xs font-mono font-medium text-[var(--brand-text)]">{row.value}</span>
          </div>
        ))}
      </div>
    </SettingsSection>
  )
}

// ── Shared UI primitives ───────────────────────────────────────────────────────

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-[var(--brand-text)]">{title}</h2>
        <p className="text-xs text-[var(--brand-muted)] mt-0.5">{description}</p>
      </div>
      <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5">
        {children}
      </div>
    </section>
  )
}

function ToggleSwitch({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
        'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2',
        checked ? 'bg-[var(--brand-primary)]' : 'bg-[var(--brand-border)]',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform duration-200',
          checked ? 'translate-x-4' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  )
}

/**
 * Read-only field with a one-click copy button.
 * Renders a monospace value + copy icon; shows a ✓ for 1.5s on success.
 * Export this from settings-sections (client boundary) so settings/page.tsx
 * (server component) can import it without marking itself as a client component.
 */
export function CopyableValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API not available — silent fail
    }
  }

  return (
    <button
      onClick={handleCopy}
      title={copied ? 'Copied!' : `Copy ${value}`}
      className="group flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] rounded"
    >
      <span className="text-xs font-mono font-medium text-[var(--brand-text)] truncate max-w-[200px] text-right">
        {value}
      </span>
      <span
        className={[
          'shrink-0 transition-colors duration-150',
          copied
            ? 'text-emerald-500 dark:text-emerald-400'
            : 'text-[var(--brand-muted)] opacity-0 group-hover:opacity-100',
        ].join(' ')}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </span>
    </button>
  )
}
