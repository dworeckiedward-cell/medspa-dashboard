'use client'

/**
 * PresentationToggle — button to enter/exit presentation mode.
 *
 * Shows a monitor icon that toggles the distraction-free demo view.
 * Displays keyboard shortcut hint on hover.
 */

import { useEffect, useState } from 'react'
import { Monitor, MonitorOff } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { usePresentationMode } from '@/lib/dashboard/presentation-mode'
import { cn } from '@/lib/utils'

interface PresentationToggleProps {
  /** Render as a more prominent button (for reports page header) */
  variant?: 'icon' | 'button'
  className?: string
}

export function PresentationToggle({ variant = 'icon', className }: PresentationToggleProps) {
  const { isPresenting, toggle } = usePresentationMode()
  const [shortcutLabel, setShortcutLabel] = useState('Ctrl+Shift+P')

  useEffect(() => {
    if (navigator.platform?.toLowerCase().includes('mac')) {
      setShortcutLabel('\u2318\u21E7P')
    }
  }, [])

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors duration-150',
          isPresenting
            ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
            : 'border-[var(--brand-border)] text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:border-[var(--brand-text)]/20',
          className,
        )}
        aria-label={isPresenting ? 'Exit presentation mode' : 'Enter presentation mode'}
        aria-pressed={isPresenting}
      >
        {isPresenting ? <MonitorOff className="h-3.5 w-3.5" /> : <Monitor className="h-3.5 w-3.5" />}
        {isPresenting ? 'Exit Presentation' : 'Present'}
        <kbd className="ml-1 rounded border border-[var(--brand-border)] bg-[var(--brand-bg)] px-1 py-0.5 text-[9px] font-mono leading-none text-[var(--brand-muted)]">
          {shortcutLabel}
        </kbd>
      </button>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={toggle}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg border transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-bg)]',
              isPresenting
                ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                : 'border-[var(--brand-border)] bg-[var(--brand-surface)] text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:border-[var(--brand-text)]/20',
              className,
            )}
            aria-label={isPresenting ? 'Exit presentation mode' : 'Enter presentation mode'}
            aria-pressed={isPresenting}
          >
            {isPresenting ? <MonitorOff className="h-3.5 w-3.5" /> : <Monitor className="h-3.5 w-3.5" />}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {isPresenting ? 'Exit presentation' : 'Presentation mode'} ({shortcutLabel})
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
