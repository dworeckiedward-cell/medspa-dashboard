'use client'

import { useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'dashboard-theme'

function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'
  return (localStorage.getItem(STORAGE_KEY) as ThemeMode) ?? 'dark'
}

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement
  root.classList.toggle('dark', mode === 'dark')
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = getStoredTheme()
    setThemeState(stored)
    applyTheme(stored)
    setMounted(true)
  }, [])

  function setTheme(mode: ThemeMode) {
    setThemeState(mode)
    localStorage.setItem(STORAGE_KEY, mode)
    applyTheme(mode)
  }

  return { theme, setTheme, mounted }
}

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

/** Segmented 3-way theme control used in Settings > Appearance */
export function ThemeToggle() {
  const { theme, setTheme, mounted } = useTheme()
  const [saved, setSaved] = useState(false)

  // Render a blank placeholder until hydration so layout doesn't shift
  if (!mounted) {
    return (
      <div className="h-9 w-48 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)]" />
    )
  }

  function handleSetTheme(mode: ThemeMode) {
    setTheme(mode)
    setSaved(true)
    const t = setTimeout(() => setSaved(false), 1500)
    return () => clearTimeout(t)
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-0.5 gap-0.5">
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleSetTheme(opt.value)}
            className={[
              'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150',
              theme === opt.value
                ? 'bg-[var(--brand-surface)] text-[var(--brand-text)] shadow-sm ring-1 ring-[var(--brand-border)]'
                : 'text-[var(--brand-muted)] hover:text-[var(--brand-text)]',
            ].join(' ')}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {/* Ephemeral save confirmation */}
      <span
        className={[
          'text-[10px] text-emerald-600 dark:text-emerald-400 transition-opacity duration-150',
          saved ? 'opacity-100' : 'opacity-0 pointer-events-none',
        ].join(' ')}
      >
        Saved locally
      </span>
    </div>
  )
}

/** Compact label badge shown in the Header — renders null until hydrated */
export function ThemeBadge() {
  const { theme, mounted } = useTheme()
  if (!mounted) return null

  const label = theme === 'light' ? 'Light' : 'Dark'

  return (
    <span className="hidden sm:inline-flex items-center rounded-md border border-[var(--brand-border)] bg-[var(--brand-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--brand-muted)] select-none">
      {label}
    </span>
  )
}
