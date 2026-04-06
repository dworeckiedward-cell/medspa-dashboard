'use client'

/**
 * KpiCard — reusable single-metric card.
 * Compact 2-col grid on mobile, full size on desktop.
 */

import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface KpiCardProps {
  title: string
  value: string
  subtitle?: string
  icon: React.ElementType
  color: string
  trend?: number | null
}

export function KpiCard({ title, value, subtitle, icon: Icon, color, trend }: KpiCardProps) {
  const TrendIcon =
    trend != null && trend > 0
      ? ArrowUpRight
      : trend != null && trend < 0
        ? ArrowDownRight
        : Minus

  const trendColor =
    trend != null && trend > 0
      ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40'
      : trend != null && trend < 0
        ? 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/40'
        : 'text-[var(--brand-muted)] bg-[var(--brand-bg)]'

  return (
    <Card className="relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{ background: `radial-gradient(ellipse at top left, ${color}, transparent 70%)` }}
      />

      <CardContent className="p-3 sm:p-5 relative">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] sm:text-[11px] font-medium text-[var(--brand-muted)] uppercase tracking-wider mb-1 sm:mb-2 truncate">
              {title}
            </p>
            <p className="text-lg sm:text-[26px] font-bold text-[var(--brand-text)] tabular-nums leading-none truncate" style={{ letterSpacing: "-0.03em" }}>
              {value}
            </p>
            {subtitle && (
              <p className="text-[10px] sm:text-xs text-[var(--brand-muted)] mt-1 sm:mt-1.5 line-clamp-2 leading-tight">{subtitle}</p>
            )}
            {trend != null && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] sm:text-[10px] font-medium tabular-nums mt-1.5',
                  trendColor,
                )}
              >
                <TrendIcon className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                {Math.abs(Math.round(trend))}%
              </span>
            )}
          </div>
          <div
            className="flex h-7 w-7 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg sm:rounded-xl"
            style={{ background: `${color}22`, color }}
          >
            <Icon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
