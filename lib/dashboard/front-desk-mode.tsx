'use client'

/**
 * View Mode — controls dashboard density / audience level.
 *
 *   simple   → front-desk staff: KPIs, call logs, needs-attention, AI status only.
 *   operator → default for clinic owners: full dashboard.
 *   analyst  → power users: full dashboard (future: extra detail columns).
 *
 * State persisted to localStorage per-tenant.
 * Backward-compat: `isFrontDesk` ≡ mode === 'simple', `toggle()` cycles simple↔operator.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'

// ── View modes ──────────────────────────────────────────────────────────────

export type ViewMode = 'simple' | 'operator' | 'analyst'

const VIEW_MODES: ViewMode[] = ['simple', 'operator', 'analyst']

function isViewMode(v: unknown): v is ViewMode {
  return typeof v === 'string' && VIEW_MODES.includes(v as ViewMode)
}

// ── Storage ─────────────────────────────────────────────────────────────────

function storageKey(tenantSlug?: string): string {
  return tenantSlug
    ? `servify:view:mode:${tenantSlug}`
    : 'servify:view:mode'
}

function readMode(tenantSlug?: string): ViewMode {
  if (typeof window === 'undefined') return 'operator'
  try {
    const raw = localStorage.getItem(storageKey(tenantSlug))
    // Backward compat: old boolean stored 'simple' for on
    if (isViewMode(raw)) return raw
    return 'operator'
  } catch {
    return 'operator'
  }
}

function writeMode(mode: ViewMode, tenantSlug?: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(storageKey(tenantSlug), mode)
  } catch {
    // silently ignore
  }
}

// ── Context ─────────────────────────────────────────────────────────────────

interface FrontDeskModeContextValue {
  /** Current view mode */
  mode: ViewMode
  /** Set the view mode directly */
  setMode: (mode: ViewMode) => void
  /** Backward compat: true when mode === 'simple' */
  isFrontDesk: boolean
  /** Backward compat: toggles simple ↔ operator */
  toggle: () => void
}

const FrontDeskModeContext = createContext<FrontDeskModeContextValue>({
  mode: 'operator',
  setMode: () => {},
  isFrontDesk: false,
  toggle: () => {},
})

export function useFrontDeskMode() {
  return useContext(FrontDeskModeContext)
}

// ── Provider ────────────────────────────────────────────────────────────────

interface FrontDeskModeProviderProps {
  tenantSlug?: string
  children: ReactNode
}

export function FrontDeskModeProvider({
  tenantSlug,
  children,
}: FrontDeskModeProviderProps) {
  const [mode, setModeState] = useState<ViewMode>('operator')

  useEffect(() => {
    setModeState(readMode(tenantSlug))
  }, [tenantSlug])

  const setMode = useCallback(
    (next: ViewMode) => {
      setModeState(next)
      writeMode(next, tenantSlug)
    },
    [tenantSlug],
  )

  const toggle = useCallback(() => {
    setModeState((prev) => {
      const next = prev === 'simple' ? 'operator' : 'simple'
      writeMode(next, tenantSlug)
      return next
    })
  }, [tenantSlug])

  const isFrontDesk = mode === 'simple'

  return (
    <FrontDeskModeContext.Provider value={{ mode, setMode, isFrontDesk, toggle }}>
      {children}
    </FrontDeskModeContext.Provider>
  )
}
