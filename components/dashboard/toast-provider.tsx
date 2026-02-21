'use client'

/**
 * Global toast notification system.
 *
 * Lightweight, brand-themed, no external library.
 * Renders a fixed-position toast stack in the bottom-right corner.
 *
 * Usage:
 *   import { useToast } from '@/components/dashboard/toast-provider'
 *
 *   const { toast } = useToast()
 *   toast({ type: 'success', message: 'Copied to clipboard' })
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info'

export interface ToastMessage {
  type: ToastType
  message: string
  /** Auto-dismiss time in ms (default 4000) */
  duration?: number
}

interface ToastEntry extends ToastMessage {
  id: string
  exiting: boolean
}

// ── Context ──────────────────────────────────────────────────────────────────

interface ToastContextValue {
  toast: (msg: ToastMessage) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

// ── Toast item ───────────────────────────────────────────────────────────────

const ICON_MAP: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
}

const COLOR_MAP: Record<ToastType, string> = {
  success: 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300',
  error: 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300',
  info: 'border-[var(--brand-border)] bg-[var(--brand-surface)] text-[var(--brand-text)]',
}

function ToastItem({ entry, onDismiss }: { entry: ToastEntry; onDismiss: () => void }) {
  const Icon = ICON_MAP[entry.type]
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-lg border px-4 py-3 shadow-lg text-sm font-medium',
        'animate-in slide-in-from-bottom-4 duration-300',
        entry.exiting && 'animate-out fade-out slide-out-to-right-4 duration-200',
        COLOR_MAP[entry.type],
      )}
      role="alert"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-[13px]">{entry.message}</span>
      <button
        onClick={onDismiss}
        className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ── Provider ─────────────────────────────────────────────────────────────────

const EXIT_MS = 200
const MAX_TOASTS = 3

export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: string) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, exiting: true } : e)))
    setTimeout(() => {
      setEntries((prev) => prev.filter((e) => e.id !== id))
    }, EXIT_MS)
  }, [])

  const toast = useCallback(
    (msg: ToastMessage) => {
      const id = `toast-${nextId.current++}`
      const duration = msg.duration ?? 4000

      setEntries((prev) => {
        const next = [...prev, { ...msg, id, exiting: false }]
        // Trim old toasts if over max
        return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next
      })

      setTimeout(() => dismiss(id), duration)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Toast container */}
      {entries.length > 0 && (
        <div
          className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm"
          aria-live="polite"
        >
          {entries.map((entry) => (
            <ToastItem key={entry.id} entry={entry} onDismiss={() => dismiss(entry.id)} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}
