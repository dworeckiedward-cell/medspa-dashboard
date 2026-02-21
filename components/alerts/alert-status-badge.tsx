'use client'

/**
 * AlertStatusBadge — displays alert lifecycle status.
 */

import { cn } from '@/lib/utils'
import type { AlertStatus } from '@/lib/alerts/types'

const STATUS_CONFIG: Record<AlertStatus, {
  label: string
  textClass: string
  bgClass: string
}> = {
  open: {
    label: 'Open',
    textClass: 'text-rose-700 dark:text-rose-400',
    bgClass: 'bg-rose-50 dark:bg-rose-950/30',
  },
  acknowledged: {
    label: 'Acknowledged',
    textClass: 'text-amber-700 dark:text-amber-400',
    bgClass: 'bg-amber-50 dark:bg-amber-950/30',
  },
  resolved: {
    label: 'Resolved',
    textClass: 'text-emerald-700 dark:text-emerald-400',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/30',
  },
  muted: {
    label: 'Muted',
    textClass: 'text-slate-600 dark:text-slate-400',
    bgClass: 'bg-slate-50 dark:bg-slate-950/30',
  },
}

interface AlertStatusBadgeProps {
  status: AlertStatus
  size?: 'sm' | 'md'
}

export function AlertStatusBadge({ status, size = 'sm' }: AlertStatusBadgeProps) {
  const cfg = STATUS_CONFIG[status]

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        cfg.bgClass,
        cfg.textClass,
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
      )}
    >
      {cfg.label}
    </span>
  )
}
