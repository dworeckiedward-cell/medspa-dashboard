/**
 * /ops/fb-ads — FB Ads performance dashboard across all tenants.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getAllClientOverviews } from '@/lib/ops/query'
import { OpsFbAdsSection } from '@/components/ops/ops-fb-ads-section'

export const dynamic = 'force-dynamic'

export default async function OpsFbAdsPage() {
  const supabase = createSupabaseServerClient()
  const overviews = await getAllClientOverviews()

  // Fetch FB ads metrics per clinic from call_logs
  const clinics = await Promise.all(
    overviews
      .filter((o) => o.client.is_active)
      .map(async (o) => {
        const client = o.client

        // Get call metrics for this client (last 30 days)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const { data: calls } = await supabase
          .from('call_logs')
          .select('is_lead, is_booked, disposition, sentiment, lead_cost_cents')
          .eq('client_id', client.id)
          .gte('created_at', thirtyDaysAgo.toISOString())

        const rows = calls ?? []
        const totalLeads = rows.filter((c) => c.is_lead).length
        const bookedCalls = rows.filter((c) => c.is_booked).length
        // Show rate: positive sentiment on booked calls (approximation)
        const showedUp = rows.filter((c) => c.is_booked && c.sentiment === 'positive').length
        // Closed: booked + positive
        const closed = rows.filter((c) => c.is_booked && c.disposition === 'booked').length
        const totalCalls = rows.length
        const leadCosts = rows.filter((c) => c.lead_cost_cents != null).map((c) => c.lead_cost_cents as number)
        const avgLeadCostCents = leadCosts.length > 0
          ? Math.round(leadCosts.reduce((a, b) => a + b, 0) / leadCosts.length)
          : null

        return {
          clientId: client.id,
          clientName: client.name,
          slug: client.slug,
          monthlyAdSpendCents: (client as unknown as Record<string, unknown>).monthly_ad_spend_cents as number | null ?? null,
          calendlyUrl: (client as unknown as Record<string, unknown>).calendly_url as string | null ?? null,
          metrics: {
            totalLeads,
            bookedCalls,
            showedUp,
            closed,
            totalCalls,
            avgLeadCostCents,
          },
        }
      }),
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-[var(--brand-text)]">FB Ads Performance</h1>
        <p className="text-xs text-[var(--brand-muted)]">
          Track ad spend, cost per call, show rates and close rates across all clinics
        </p>
      </div>
      <OpsFbAdsSection clinics={clinics} />
    </div>
  )
}
