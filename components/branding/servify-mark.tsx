'use client'

import { cn } from '@/lib/utils'

/**
 * ServifyMark — reusable Servify brand icon.
 *
 * Renders a clean "S" lettermark in an SVG. Designed to be swapped
 * for a real logo asset later — just replace the SVG contents.
 *
 * Variants:
 *  - "icon"  → standalone icon (login hero, favicons)
 *  - "inline" → tiny inline mark (powered-by rows, footers)
 */

interface ServifyMarkProps {
  /** Visual size variant */
  variant?: 'icon' | 'inline'
  /** Additional class names */
  className?: string
}

export function ServifyMark({ variant = 'icon', className }: ServifyMarkProps) {
  const size = variant === 'inline' ? 'h-3.5 w-3.5' : 'h-5 w-5'

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(size, className)}
      aria-hidden="true"
    >
      {/* Abstract "S" lettermark — swap for final logo asset */}
      <path
        d="M17.5 8.5C17.5 6.01 15.49 4 13 4H9.5C7.57 4 6 5.57 6 7.5S7.57 11 9.5 11h5c1.93 0 3.5 1.57 3.5 3.5S16.43 18 14.5 18H11c-2.49 0-4.5-2.01-4.5-4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="7.5" r="1" fill="currentColor" opacity="0.6" />
      <circle cx="16" cy="16.5" r="1" fill="currentColor" opacity="0.6" />
    </svg>
  )
}
