'use client'

import { useState, useRef, useEffect } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * MetricExplanation — lightweight inline tooltip for explaining
 * how a metric is calculated. Hover/focus to reveal.
 *
 * Usage:
 *   <MetricExplanation text="Calculated from call duration × $22/hr default rate" />
 */

interface MetricExplanationProps {
  text: string
  className?: string
}

export function MetricExplanation({ text, className }: MetricExplanationProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <span ref={ref} className={cn('relative inline-flex', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex items-center justify-center text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--brand-primary)] rounded"
        aria-label="How is this calculated?"
      >
        <Info className="h-3 w-3" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-56 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-2 text-[11px] leading-relaxed text-[var(--brand-muted)] shadow-lg z-50 pointer-events-none"
        >
          {text}
        </span>
      )}
    </span>
  )
}
