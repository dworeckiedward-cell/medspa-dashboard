'use client'

import { useMemo } from 'react'
import { useDashboardData } from '@/components/dashboard/dashboard-data-provider'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { CallLog } from '@/types/database'

// Campaign label overrides — maps lead_source or campaign_type value to friendly display name
const CAMPAIGN_LABELS: Record<string, string> = {
  acupuncture: 'Fire Cupping / Acupuncture',
  skin: 'Skin Ad',
  botox: 'Botox / Filler',
  laser: 'Laser Treatment',
  facebook: 'Facebook Ads',
  instagram: 'Instagram Ads',
  google: 'Google Ads',
  website: 'Website',
  referral: 'Referral',
  phone: 'Direct Call',
  'walk-in': 'Walk-in',
}

function getLabel(key: string): string {
  return CAMPAIGN_LABELS[key.toLowerCase()] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

interface CampaignStat {
  key: string
  label: string
  total: number
  leads: number
  booked: number
  conversionRate: number
}

function computeStats(calls: CallLog[]): CampaignStat[] {
  const map = new Map<string, { total: number; leads: number; booked: number }>()

  for (const call of calls) {
    // Use campaign_type if available, fall back to lead_source
    const raw = (call.campaign_type ?? call.lead_source ?? '').trim().toLowerCase()
    const key = raw || 'unknown'
    if (key === 'unknown') continue
    const existing = map.get(key) ?? { total: 0, leads: 0, booked: 0 }
    existing.total++
    if (call.is_lead) existing.leads++
    if (call.is_booked) existing.booked++
    map.set(key, existing)
  }

  return Array.from(map.entries())
    .map(([key, counts]) => ({
      key,
      label: getLabel(key),
      ...counts,
      conversionRate: counts.leads > 0 ? Math.round((counts.booked / counts.leads) * 100) : 0,
    }))
    .filter((s) => s.leads > 0) // only show campaigns that generated leads
    .sort((a, b) => b.leads - a.leads)
}

export function CampaignBreakdown() {
  const ctx = useDashboardData()
  const calls = ctx?.calls ?? []

  const stats = useMemo(() => computeStats(calls), [calls])

  // Only render if we have at least 2 distinct campaigns (1 campaign = no comparison value)
  if (stats.length < 2) return null

  const maxLeads = Math.max(...stats.map((s) => s.leads), 1)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Campaign Performance</CardTitle>
        <CardDescription className="text-xs">Leads and bookings by source</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {stats.map((s) => (
          <div key={s.key} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[var(--brand-text)] truncate max-w-[55%]">{s.label}</span>
              <div className="flex items-center gap-3 text-[var(--brand-muted)] shrink-0">
                <span>{s.leads} lead{s.leads !== 1 ? 's' : ''}</span>
                {s.booked > 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {s.booked} booked
                  </span>
                )}
                {s.leads > 0 && (
                  <span className="text-[var(--brand-muted)] opacity-70 w-9 text-right">
                    {s.conversionRate}%
                  </span>
                )}
              </div>
            </div>
            {/* Bar */}
            <div className="h-1.5 w-full rounded-full bg-[var(--brand-border)]/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--brand-primary)] opacity-70 transition-all duration-500"
                style={{ width: `${Math.round((s.leads / maxLeads) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
