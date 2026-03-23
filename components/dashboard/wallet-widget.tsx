'use client'

import { Clock, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WalletWidgetProps {
  availableSeconds: number
}

function formatMinutes(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  if (mins >= 60) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  return `${mins}m`
}

type WalletLevel = 'green' | 'yellow' | 'red'

function getLevel(seconds: number): WalletLevel {
  const mins = Math.floor(seconds / 60)
  if (mins > 60) return 'green'
  if (mins >= 10) return 'yellow'
  return 'red'
}

const LEVEL_STYLES: Record<WalletLevel, { bg: string; text: string; dot: string }> = {
  green: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40',
    text: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  yellow: {
    bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40',
    text: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40',
    text: 'text-red-700 dark:text-red-400',
    dot: 'bg-red-500',
  },
}

export function WalletWidget({ availableSeconds }: WalletWidgetProps) {
  const level = getLevel(availableSeconds)
  const styles = LEVEL_STYLES[level]

  return (
    <div
      className={cn(
        'hidden sm:flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors duration-200',
        styles.bg,
      )}
    >
      <div className="flex items-center gap-1.5">
        <div className={cn('h-1.5 w-1.5 rounded-full', styles.dot)} />
        <Clock className={cn('h-3 w-3', styles.text)} />
        <span className={cn('text-[11px] font-medium whitespace-nowrap', styles.text)}>
          {formatMinutes(availableSeconds)}
        </span>
      </div>
      <div className="h-3 w-px bg-[var(--brand-border)]/60" />
      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-1 text-[10px] font-medium whitespace-nowrap',
          styles.text,
          'hover:underline',
        )}
      >
        <CreditCard className="h-2.5 w-2.5" />
        Top Up
      </button>
    </div>
  )
}
