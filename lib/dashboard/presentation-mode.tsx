/**
 * Presentation Mode — client-side UI state for demos/screenshots.
 *
 * Toggles a distraction-free view: sidebar hidden, header minimized,
 * extra breathing room on content. State persisted to localStorage
 * so it survives page navigations within the same session.
 *
 * Never read during SSR — all access gated behind `typeof window`.
 */

'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

// ── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'servify-presentation-mode'

function readPresentationMode(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function writePresentationMode(active: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (active) {
      localStorage.setItem(STORAGE_KEY, 'true')
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // silently ignore
  }
}

// ── Context ──────────────────────────────────────────────────────────────────

interface PresentationModeContextValue {
  isPresenting: boolean
  toggle: () => void
  exit: () => void
}

const PresentationModeContext = createContext<PresentationModeContextValue>({
  isPresenting: false,
  toggle: () => {},
  exit: () => {},
})

export function usePresentationMode() {
  return useContext(PresentationModeContext)
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function PresentationModeProvider({ children }: { children: ReactNode }) {
  // Start false (SSR-safe), hydrate from localStorage in useEffect
  const [isPresenting, setIsPresenting] = useState(false)

  useEffect(() => {
    setIsPresenting(readPresentationMode())
  }, [])

  // Keyboard shortcut: Cmd+Shift+P / Ctrl+Shift+P
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'p' && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsPresenting((prev) => {
          const next = !prev
          writePresentationMode(next)
          return next
        })
      }
      // Escape exits presentation mode
      if (e.key === 'Escape' && readPresentationMode()) {
        setIsPresenting(false)
        writePresentationMode(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const toggle = useCallback(() => {
    setIsPresenting((prev) => {
      const next = !prev
      writePresentationMode(next)
      return next
    })
  }, [])

  const exit = useCallback(() => {
    setIsPresenting(false)
    writePresentationMode(false)
  }, [])

  return (
    <PresentationModeContext.Provider value={{ isPresenting, toggle, exit }}>
      {children}
    </PresentationModeContext.Provider>
  )
}
