'use client'

import { useState, useEffect } from 'react'
import { Check, Copy } from 'lucide-react'
import { ThemeToggle } from './theme-toggle'
import { CustomThemeSection } from './custom-theme-section'
import { useLanguage } from '@/lib/dashboard/use-language'
import { useAccent, ACCENT_PRESETS, type AccentKey } from '@/lib/dashboard/accent'
import { DICT, LANGUAGE_LABELS, type LangKey } from '@/lib/dashboard/i18n'

// ── Appearance (Theme + Accent Color + Language) ────────────────────────────

export function AppearanceSection() {
  const { t } = useLanguage()

  return (
    <SettingsSection title={t.settings.appearance} description={t.settings.appearanceDesc}>
      <div className="space-y-5">
        {/* Theme */}
        <div className="flex items-start justify-between gap-6 border-b border-[var(--brand-border)] pb-5">
          <div>
            <p className="text-sm font-medium text-[var(--brand-text)]">{t.settings.theme}</p>
            <p className="text-xs text-[var(--brand-muted)] mt-0.5">{t.settings.themeDesc}</p>
          </div>
          <ThemeToggle />
        </div>

        {/* Accent Color */}
        <div className="flex items-start justify-between gap-6 border-b border-[var(--brand-border)] pb-5">
          <div>
            <p className="text-sm font-medium text-[var(--brand-text)]">{t.settings.accentColor}</p>
            <p className="text-xs text-[var(--brand-muted)] mt-0.5">{t.settings.accentColorDesc}</p>
          </div>
          <AccentColorPicker />
        </div>

        {/* Language */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-[var(--brand-text)]">{t.settings.language}</p>
            <p className="text-xs text-[var(--brand-muted)] mt-0.5">{t.settings.languageDesc}</p>
          </div>
          <LanguagePicker />
        </div>

        {/* Custom Theme (Advanced) */}
        <CustomThemeSection />
      </div>
    </SettingsSection>
  )
}

// ── Accent Color Picker ─────────────────────────────────────────────────────

function AccentColorPicker() {
  const { accentKey, setAccentKey, mounted } = useAccent()
  const { t } = useLanguage()
  const [saved, setSaved] = useState(false)

  // Skeleton while waiting for localStorage read
  if (!mounted) {
    return (
      <div className="flex gap-2">
        {ACCENT_PRESETS.map((p) => (
          <div
            key={p.key}
            className="h-7 w-7 rounded-full animate-pulse"
            style={{ background: p.hex, opacity: 0.4 }}
          />
        ))}
      </div>
    )
  }

  function handleSet(key: AccentKey) {
    setAccentKey(key)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {ACCENT_PRESETS.map((p) => {
          const isSelected = accentKey === p.key
          return (
            <button
              key={p.key}
              title={p.label}
              onClick={() => handleSet(p.key)}
              aria-pressed={isSelected}
              className={[
                'relative flex h-7 w-7 items-center justify-center rounded-full',
                'transition-transform duration-150 hover:scale-110 active:scale-95',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                'motion-reduce:transition-none',
              ].join(' ')}
              style={{
                background: p.hex,
                boxShadow: isSelected
                  ? `0 0 0 2px var(--brand-bg), 0 0 0 4px ${p.hex}`
                  : undefined,
              }}
            >
              {isSelected && (
                <svg
                  className="h-3.5 w-3.5 text-white drop-shadow"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span className="sr-only">{p.label}</span>
            </button>
          )
        })}
      </div>
      <span
        className={[
          'text-[10px] text-emerald-600 dark:text-emerald-400 transition-opacity duration-300',
          saved ? 'opacity-100' : 'opacity-0 pointer-events-none',
        ].join(' ')}
      >
        {t.settings.savedLocally}
      </span>
    </div>
  )
}

// ── Language Picker ─────────────────────────────────────────────────────────

const LANG_KEYS: LangKey[] = ['en', 'pl', 'es']

function LanguagePicker() {
  const { lang, setLang, t, mounted } = useLanguage()
  const [saved, setSaved] = useState(false)

  if (!mounted) {
    return (
      <div className="h-9 w-52 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] animate-pulse" />
    )
  }

  function handleSet(key: LangKey) {
    setLang(key)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-0.5 gap-0.5">
        {LANG_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => handleSet(key)}
            aria-pressed={lang === key}
            className={[
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150 motion-reduce:transition-none',
              lang === key
                ? 'bg-[var(--brand-surface)] text-[var(--brand-text)] shadow-sm ring-1 ring-[var(--brand-border)]'
                : 'text-[var(--brand-muted)] hover:text-[var(--brand-text)]',
            ].join(' ')}
          >
            {/* Use the static DICT for labels so we don't show translated label names */}
            {LANGUAGE_LABELS[key]}
          </button>
        ))}
      </div>
      <span
        className={[
          'text-[10px] text-emerald-600 dark:text-emerald-400 transition-opacity duration-300',
          saved ? 'opacity-100' : 'opacity-0 pointer-events-none',
        ].join(' ')}
      >
        {t.settings.savedLocally}
      </span>
    </div>
  )
}

// ── Notification preferences ────────────────────────────────────────────────

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

export function NotificationSection() {
  const { t } = useLanguage()
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setPrefs(getStoredPrefs())
    setMounted(true)
  }, [])

  function toggle(key: keyof NotifPrefs) {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      try {
        localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }

  // Row labels stay in English for now (notification concepts are less
  // locale-specific than nav labels)
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
      description:
        'Play a subtle chime when a new booking is confirmed (requires page to be active)',
    },
  ]

  return (
    <SettingsSection title={t.settings.notifications} description={t.settings.notificationsDesc}>
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
  const { t } = useLanguage()
  const [refreshTime, setRefreshTime] = useState<string>('')

  useEffect(() => {
    setRefreshTime(new Date().toLocaleTimeString())
  }, [])

  const rows = [
    { label: 'App version', value: 'MVP' },
    { label: 'Environment', value: process.env.NODE_ENV ?? 'development' },
    { label: 'Last data refresh', value: refreshTime || '—' },
  ]

  return (
    <SettingsSection title={t.settings.advanced} description={t.settings.advancedDesc}>
      <div className="space-y-1">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between py-1.5 border-b border-[var(--brand-border)] last:border-0"
          >
            <span className="text-xs text-[var(--brand-muted)]">{row.label}</span>
            <span className="text-xs font-mono font-medium text-[var(--brand-text)]">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </SettingsSection>
  )
}

// ── Settings page heading (translated) ─────────────────────────────────────
// Exported so settings/page.tsx (Server Component) can render a translated
// heading without making the whole page a Client Component.

export function SettingsHeading() {
  const { t } = useLanguage()
  return (
    <>
      <h1 className="text-xl font-semibold text-[var(--brand-text)]">{t.settings.pageTitle}</h1>
      <p className="text-sm text-[var(--brand-muted)] mt-1">{t.settings.pageSubtitle}</p>
    </>
  )
}

// ── Shared UI primitives ────────────────────────────────────────────────────

export function SettingsSection({
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
      <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5">
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
        'focus-visible:ring-[var(--user-accent)] focus-visible:ring-offset-2',
        'motion-reduce:transition-none',
      ].join(' ')}
      style={{ background: checked ? 'var(--user-accent)' : 'var(--brand-border)' }}
    >
      <span
        className={[
          'inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0',
          'transition-transform duration-200 motion-reduce:transition-none',
          checked ? 'translate-x-4' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  )
}

/**
 * Read-only field with a one-click copy button.
 * Renders a monospace value + copy icon; shows a ✓ for 1.5 s on success.
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
      className="group flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--user-accent)] rounded"
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
