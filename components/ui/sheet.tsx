'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  /** Width of the sheet panel. Default: 'md' (480px) */
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeClasses: Record<NonNullable<SheetProps['size']>, string> = {
  sm: 'w-full max-w-sm',
  md: 'w-full max-w-[480px]',
  lg: 'w-full max-w-[640px]',
  xl: 'w-full max-w-[800px]',
}

/**
 * Sheet — a slide-in side panel (right edge).
 *
 * Pure React implementation — no Radix dependency.
 * Handles: Escape key close, body scroll lock, focus management,
 * CSS slide animation, reduced-motion support.
 */
export function Sheet({ open, onClose, title, description, children, size = 'md' }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Escape key to close
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Focus the panel when opened for accessibility
  useEffect(() => {
    if (open) {
      // Small delay so CSS transition is visible before focus trap
      const id = setTimeout(() => panelRef.current?.focus(), 50)
      return () => clearTimeout(id)
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? 'Details panel'}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 motion-reduce:animate-none"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          'relative flex flex-col h-full',
          'bg-[var(--brand-surface)] border-l border-[var(--brand-border)]',
          'shadow-2xl outline-none',
          'animate-in slide-in-from-right duration-300 motion-reduce:animate-none',
          sizeClasses[size],
        )}
      >
        {/* Header */}
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-[var(--brand-border)] shrink-0">
            <div className="min-w-0">
              {title && (
                <h2 className="text-base font-semibold text-[var(--brand-text)] leading-tight">
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-xs text-[var(--brand-muted)] mt-0.5">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-md p-1.5 text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-border)]/50 transition-colors"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}

/** Thin wrapper for the scrollable content area inside a Sheet */
export function SheetContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 py-5', className)} {...props} />
}

/** Section divider within SheetContent */
export function SheetSection({
  title,
  className,
  children,
}: {
  title?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('py-5 border-b border-[var(--brand-border)] last:border-b-0', className)}>
      {title && (
        <p className="text-xs font-semibold text-[var(--brand-muted)] uppercase tracking-wider mb-3">
          {title}
        </p>
      )}
      {children}
    </div>
  )
}
