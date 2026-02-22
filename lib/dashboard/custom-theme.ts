'use client'

import { useEffect, useState, useCallback } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

export interface CustomThemeColors {
  background: string
  surface: string
  text: string
  accent: string
  enabled: boolean
}

export interface LastUsedColors {
  background: string[]
  surface: string[]
  text: string[]
  accent: string[]
}

export type ThemeColorField = keyof Omit<CustomThemeColors, 'enabled'>

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_RECENT = 3

const DEFAULT_CUSTOM_THEME: CustomThemeColors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  text: '#0A0A0B',
  accent: '#2563EB',
  enabled: false,
}

const LIGHT_PRESET: Omit<CustomThemeColors, 'enabled'> = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  text: '#0A0A0B',
  accent: '#2563EB',
}

const DARK_PRESET: Omit<CustomThemeColors, 'enabled'> = {
  background: '#0A0A0F',
  surface: '#12121A',
  text: '#E2E8F0',
  accent: '#2563EB',
}

export { LIGHT_PRESET, DARK_PRESET }

const EMPTY_LAST_USED: LastUsedColors = {
  background: [],
  surface: [],
  text: [],
  accent: [],
}

// ── Storage keys ─────────────────────────────────────────────────────────────

function themeKey(tenantSlug?: string): string {
  return tenantSlug
    ? `servify:theme:custom:${tenantSlug}`
    : 'servify:theme:custom'
}

function lastUsedKey(tenantSlug?: string): string {
  return tenantSlug
    ? `servify:theme:last-used:${tenantSlug}`
    : 'servify:theme:last-used'
}

// ── Validation ───────────────────────────────────────────────────────────────

const HEX_RE = /^#[0-9A-Fa-f]{6}$/

export function isValidHex(hex: string): boolean {
  return HEX_RE.test(hex)
}

/**
 * Compute WCAG relative luminance from a hex color.
 */
function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255

  const adjust = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

  return 0.2126 * adjust(r) + 0.7152 * adjust(g) + 0.0722 * adjust(b)
}

/**
 * WCAG contrast ratio between two hex colors.
 * Returns a value between 1 and 21.
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = luminance(hex1)
  const l2 = luminance(hex2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Returns true if contrast ratio is below WCAG AA normal text threshold (4.5:1).
 */
export function hasLowContrast(textHex: string, bgHex: string): boolean {
  if (!isValidHex(textHex) || !isValidHex(bgHex)) return false
  return contrastRatio(textHex, bgHex) < 4.5
}

// ── Storage helpers ──────────────────────────────────────────────────────────

function readTheme(tenantSlug?: string): CustomThemeColors {
  if (typeof window === 'undefined') return DEFAULT_CUSTOM_THEME
  try {
    const raw = localStorage.getItem(themeKey(tenantSlug))
    if (!raw) return DEFAULT_CUSTOM_THEME
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_CUSTOM_THEME, ...parsed }
  } catch {
    return DEFAULT_CUSTOM_THEME
  }
}

function writeTheme(theme: CustomThemeColors, tenantSlug?: string): void {
  try {
    localStorage.setItem(themeKey(tenantSlug), JSON.stringify(theme))
  } catch {
    // localStorage unavailable
  }
}

function readLastUsed(tenantSlug?: string): LastUsedColors {
  if (typeof window === 'undefined') return EMPTY_LAST_USED
  try {
    const raw = localStorage.getItem(lastUsedKey(tenantSlug))
    if (!raw) return EMPTY_LAST_USED
    return { ...EMPTY_LAST_USED, ...JSON.parse(raw) }
  } catch {
    return EMPTY_LAST_USED
  }
}

function writeLastUsed(lu: LastUsedColors, tenantSlug?: string): void {
  try {
    localStorage.setItem(lastUsedKey(tenantSlug), JSON.stringify(lu))
  } catch {
    // localStorage unavailable
  }
}

function pushRecent(arr: string[], hex: string): string[] {
  const filtered = arr.filter((c) => c.toLowerCase() !== hex.toLowerCase())
  return [hex, ...filtered].slice(0, MAX_RECENT)
}

// ── Apply to DOM ─────────────────────────────────────────────────────────────

function applyCustomTheme(theme: CustomThemeColors): void {
  const el = document.documentElement

  if (!theme.enabled) {
    // Remove custom overrides — fall back to stylesheet defaults
    el.style.removeProperty('--brand-bg')
    el.style.removeProperty('--brand-surface')
    el.style.removeProperty('--brand-text')
    el.style.removeProperty('--brand-primary')
    return
  }

  if (isValidHex(theme.background)) el.style.setProperty('--brand-bg', theme.background)
  if (isValidHex(theme.surface)) el.style.setProperty('--brand-surface', theme.surface)
  if (isValidHex(theme.text)) el.style.setProperty('--brand-text', theme.text)
  if (isValidHex(theme.accent)) el.style.setProperty('--brand-primary', theme.accent)
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useCustomTheme(tenantSlug?: string) {
  const [theme, setThemeState] = useState<CustomThemeColors>(DEFAULT_CUSTOM_THEME)
  const [lastUsed, setLastUsedState] = useState<LastUsedColors>(EMPTY_LAST_USED)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = readTheme(tenantSlug)
    const lu = readLastUsed(tenantSlug)
    setThemeState(t)
    setLastUsedState(lu)
    applyCustomTheme(t)
    setMounted(true)
  }, [tenantSlug])

  const setField = useCallback(
    (field: ThemeColorField, value: string) => {
      if (!isValidHex(value)) return
      setThemeState((prev) => {
        const next = { ...prev, [field]: value }
        writeTheme(next, tenantSlug)
        applyCustomTheme(next)
        return next
      })
      setLastUsedState((prev) => {
        const next = { ...prev, [field]: pushRecent(prev[field], value) }
        writeLastUsed(next, tenantSlug)
        return next
      })
    },
    [tenantSlug],
  )

  const setEnabled = useCallback(
    (enabled: boolean) => {
      setThemeState((prev) => {
        const next = { ...prev, enabled }
        writeTheme(next, tenantSlug)
        applyCustomTheme(next)
        return next
      })
    },
    [tenantSlug],
  )

  const resetToPreset = useCallback(
    (preset: 'light' | 'dark') => {
      const colors = preset === 'light' ? LIGHT_PRESET : DARK_PRESET
      setThemeState((prev) => {
        const next = { ...colors, enabled: prev.enabled }
        writeTheme(next, tenantSlug)
        applyCustomTheme(next)
        return next
      })
    },
    [tenantSlug],
  )

  const clearCustom = useCallback(() => {
    const next = { ...DEFAULT_CUSTOM_THEME, enabled: false }
    setThemeState(next)
    writeTheme(next, tenantSlug)
    applyCustomTheme(next)
  }, [tenantSlug])

  return {
    theme,
    lastUsed,
    mounted,
    setField,
    setEnabled,
    resetToPreset,
    clearCustom,
  }
}
