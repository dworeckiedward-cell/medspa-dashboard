'use client'

/**
 * Front-desk Mode — simplified dashboard view for day-to-day operations.
 *
 * Hides analytics/advanced cards, keeps only core operational items:
 * KPIs, call logs, needs-attention, AI status.
 *
 * State persisted to localStorage per-tenant.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'

// ── Storage ──────────────────────────────────────────────────────────────────

function storageKey(tenantSlug?: string): string {
  return tenantSlug
    ? `servify:view:mode:${tenantSlug}`
    : 'servify:view:mode'
}

function readFrontDeskMode(tenantSlug?: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(storageKey(tenantSlug)) === 'simple'
  } catch {
    return false
  }
}

function writeFrontDeskMode(active: boolean, tenantSlug?: string): void {
  if (typeof window === 'undefined') return
  try {
    if (active) {
      localStorage.setItem(storageKey(tenantSlug), 'simple')
    } else {
      localStorage.removeItem(storageKey(tenantSlug))
    }
  } catch {
    // silently ignore
  }
}

// ── Context ──────────────────────────────────────────────────────────────────

interface FrontDeskModeContextValue {
  isFrontDesk: boolean
  toggle: () => void
}

const FrontDeskModeContext = createContext<FrontDeskModeContextValue>({
  isFrontDesk: false,
  toggle: () => {},
})

export function useFrontDeskMode() {
  return useContext(FrontDeskModeContext)
}

// ── Provider ─────────────────────────────────────────────────────────────────

interface FrontDeskModeProviderProps {
  tenantSlug?: string
  children: ReactNode
}

export function FrontDeskModeProvider({
  tenantSlug,
  children,
}: FrontDeskModeProviderProps) {
  const [isFrontDesk, setIsFrontDesk] = useState(false)

  useEffect(() => {
    setIsFrontDesk(readFrontDeskMode(tenantSlug))
  }, [tenantSlug])

  const toggle = useCallback(() => {
    setIsFrontDesk((prev) => {
      const next = !prev
      writeFrontDeskMode(next, tenantSlug)
      return next
    })
  }, [tenantSlug])

  return (
    <FrontDeskModeContext.Provider value={{ isFrontDesk, toggle }}>
      {children}
    </FrontDeskModeContext.Provider>
  )
}
