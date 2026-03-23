'use client'

/**
 * FbLeadsDashboardPlaceholder — temporary stub for the fb_leads dashboard mode.
 *
 * Replaced with the full FbLeadsDashboard in Sprint 3.
 */

import { Megaphone, Zap, Target, DollarSign } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CallLog, Client } from '@/types/database'

interface FbLeadsDashboardPlaceholderProps {
  tenant: Client
  callLogs: CallLog[]
  rangeDays?: number
}

export function FbLeadsDashboardPlaceholder({
  tenant,
  callLogs,
  rangeDays = 30,
}: FbLeadsDashboardPlaceholderProps) {
  // Basic counts from available data
  const fbLeads = callLogs.filter((c) => c.lead_source === 'facebook')
  const totalLeads = fbLeads.length
  const booked = fbLeads.filter((c) => c.is_booked).length

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Mode header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F59E0B]/10">
          <Megaphone className="h-5 w-5 text-[#F59E0B]" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-[var(--brand-text)]">
            FB Ads Speed-to-Lead
          </h1>
          <p className="text-xs text-[var(--brand-muted)]">
            {tenant.name} &middot; Last {rangeDays} days
          </p>
        </div>
      </div>

      {/* Placeholder KPI strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: Zap, label: 'New Leads', value: String(totalLeads), color: '#F59E0B' },
          { icon: Target, label: 'Speed-to-Lead', value: '—', color: '#10B981' },
          { icon: DollarSign, label: 'Cost per Lead', value: '—', color: '#EF4444' },
          { icon: Target, label: 'Conversion Rate', value: totalLeads > 0 ? `${Math.round((booked / totalLeads) * 100)}%` : '—', color: '#8B5CF6' },
        ].map(({ icon: Icon, label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-medium text-[var(--brand-muted)] uppercase tracking-wider mb-1">
                    {label}
                  </p>
                  <p className="text-2xl font-semibold tracking-tight text-[var(--brand-text)] tabular-nums">
                    {value}
                  </p>
                </div>
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${color}15` }}
                >
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Coming soon notice */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-sm text-[var(--brand-muted)]">
            Full Dashboard Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-[var(--brand-muted)]">
            The FB Ads Leads dashboard will include ad performance charts, speed-to-lead
            distribution, lead pipeline funnel, and cost attribution per campaign.
            Data is already being ingested via the n8n pipeline.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
