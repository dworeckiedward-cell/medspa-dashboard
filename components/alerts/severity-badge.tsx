'use client'

/**
 * SeverityBadge — consistent severity indicator across alert surfaces.
 */

import { AlertTriangle, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AlertSeverity } from '@/lib/alerts/types'

const CONFIG: Record<AlertSeverity, {
  icon: React.ElementType
  label: string
  dotClass: string
  textClass: string
  bgClass: string
}> = {
  critical: {
    icon: AlertTriangle,
    label: 'Critical',
    dotClass: 'bg-rose-500',
    textClass: 'text-rose-700 dark:text-rose-400',
    bgClass: 'bg-rose-50 dark:bg-rose-950/30',
  },
  warning: {
    icon: AlertCircle,
    label: 'Warning',
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-700 dark:text-amber-400',
    bgClass: 'bg-amber-50 dark:bg-amber-950/30',
  },
  info: {
    icon: Info,
    label: 'Info',
    dotClass: 'bg-blue-500',
    textClass: 'text-blue-700 dark:text-blue-400',
    bgClass: 'bg-blue-50 dark:bg-blue-950/30',
  },
}

interface SeverityBadgeProps {
  severity: AlertSeverity
  showLabel?: boolean
  size?: 'sm' | 'md'
}

export function SeverityBadge({ severity, showLabel = true, size = 'sm' }: SeverityBadgeProps) {
  const cfg = CONFIG[severity]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        cfg.bgClass,
        cfg.textClass,
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', cfg.dotClass)} />
      {showLabel && cfg.label}
    </span>
  )
}

/**
 * Severity dot — minimal indicator without label.
 */
export function SeverityDot({ severity }: { severity: AlertSeverity }) {
  const cfg = CONFIG[severity]
  return (
    <span
      className={cn('inline-block h-2 w-2 rounded-full shrink-0', cfg.dotClass)}
      title={cfg.label}
    />
  )
}
