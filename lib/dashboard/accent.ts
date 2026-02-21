'use client'

import { useEffect, useState } from 'react'

/** The six accent color presets available in Settings > Appearance. */
export const ACCENT_PRESETS = [
  { key: 'blue',    label: 'Blue',    hex: '#2563EB' },
  { key: 'emerald', label: 'Emerald', hex: '#10B981' },
  { key: 'violet',  label: 'Violet',  hex: '#7C3AED' },
  { key: 'rose',    label: 'Rose',    hex: '#E11D48' },
  { key: 'amber',   label: 'Amber',   hex: '#F59E0B' },
  { key: 'slate',   label: 'Slate',   hex: '#64748B' },
] as const

export type AccentKey = (typeof ACCENT_PRESETS)[number]['key']

export const ACCENT_STORAGE_KEY = 'dashboard-accent'
const DEFAULT_ACCENT: AccentKey = 'blue'

/** Resolve a hex string for any known accent key; falls back to blue. */
export function hexForAccentKey(key: AccentKey): string {
  return ACCENT_PRESETS.find((p) => p.key === key)?.hex ?? ACCENT_PRESETS[0].hex
}

/**
 * Convert hex + alpha (0–1) to an rgba() string.
 * Used for composing background/ring colors that need partial opacity.
 */
export function hexAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Apply accent CSS custom properties to :root.
 * Called both by the blocking inline script (no-flash) and by the React hook.
 *
 *  --user-accent        full hex
 *  --user-accent-soft   hex at 12% opacity (active item background)
 *  --user-accent-ring   hex at 40% opacity (focus ring / border)
 */
export function applyAccentToRoot(hex: string): void {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const el = document.documentElement
  el.style.setProperty('--user-accent', hex)
  el.style.setProperty('--user-accent-soft', `rgba(${r},${g},${b},0.12)`)
  el.style.setProperty('--user-accent-ring', `rgba(${r},${g},${b},0.4)`)
}

function getStoredAccentKey(): AccentKey {
  try {
    const stored = localStorage.getItem(ACCENT_STORAGE_KEY)
    if (stored && ACCENT_PRESETS.some((p) => p.key === stored)) {
      return stored as AccentKey
    }
  } catch {
    // localStorage blocked — use default
  }
  return DEFAULT_ACCENT
}

/**
 * Hook for reading and changing the dashboard accent color.
 *
 * Reads from localStorage; applies --user-accent* CSS vars immediately on
 * mount so components using var(--user-accent) see the right color without
 * flash (the blocking inline script in layout.tsx sets the initial value before
 * React hydrates).
 */
export function useAccent() {
  const [accentKey, setAccentKeyState] = useState<AccentKey>(DEFAULT_ACCENT)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const key = getStoredAccentKey()
    setAccentKeyState(key)
    applyAccentToRoot(hexForAccentKey(key))
    setMounted(true)
  }, [])

  function setAccentKey(key: AccentKey) {
    setAccentKeyState(key)
    const hex = hexForAccentKey(key)
    applyAccentToRoot(hex)
    try {
      localStorage.setItem(ACCENT_STORAGE_KEY, key)
    } catch {
      // localStorage blocked — preference not persisted
    }
  }

  return {
    accentKey,
    accentHex: hexForAccentKey(accentKey),
    setAccentKey,
    mounted,
  }
}
