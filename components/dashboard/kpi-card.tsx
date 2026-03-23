'use client'

/**
 * KpiCard — reusable single-metric card.
 *
 * Structure:
 *   Title (small caps)
 *   Value (large)
 *   Subtitle (small, muted)
 *   Optional trend chip: ▲/▼ with % vs prior period
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
  /** Trend percentage vs prior period — positive = up, negative = down */
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
      {/* Subtle gradient glow */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          background: `radial-gradient(ellipse at top left, ${color}, transparent 70%)`,
        }}
      />

      <CardContent className="p-5 relative">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-[var(--brand-muted)] uppercase tracking-wider mb-2">
              {title}
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-[26px] font-bold text-[var(--brand-text)] tabular-nums leading-none" style={{ letterSpacing: "-0.03em" }}>
                {value}
              </p>
              {trend != null && (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums',
                    trendColor,
                  )}
                >
                  <TrendIcon className="h-2.5 w-2.5" />
                  {Math.abs(Math.round(trend))}%
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-[var(--brand-muted)] mt-1.5">{subtitle}</p>
            )}
          </div>
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `${color}22`, color }}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
