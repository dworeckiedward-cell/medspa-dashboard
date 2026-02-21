'use client'

import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getHealthBadgeStyle, type HealthLevel } from '@/lib/ops/health-score'

interface HealthDistributionCardProps {
  distribution: Record<HealthLevel, number>
  total: number
}

const LEVELS: HealthLevel[] = ['healthy', 'watch', 'critical', 'onboarding']

export function HealthDistributionCard({
  distribution,
  total,
}: HealthDistributionCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Client Health Distribution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stacked bar */}
        {total > 0 && (
          <div className="flex h-3 w-full rounded-full overflow-hidden bg-[var(--brand-border)]">
            {LEVELS.map((level) => {
              const count = distribution[level] ?? 0
              if (count === 0) return null
              const pct = (count / total) * 100
              const badge = getHealthBadgeStyle(level)
              return (
                <div
                  key={level}
                  className={cn('h-full transition-all duration-500', badge.dotClass)}
                  style={{ width: `${pct}%` }}
                  title={`${badge.label}: ${count}`}
                />
              )
            })}
          </div>
        )}

        {/* Legend */}
        <div className="grid grid-cols-2 gap-2">
          {LEVELS.map((level) => {
            const count = distribution[level] ?? 0
            const badge = getHealthBadgeStyle(level)
            return (
              <div key={level} className="flex items-center gap-2">
                <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', badge.dotClass)} />
                <span className="text-xs text-[var(--brand-text)]">
                  {badge.label}
                </span>
                <span className="text-xs font-semibold text-[var(--brand-text)] tabular-nums ml-auto">
                  {count}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
