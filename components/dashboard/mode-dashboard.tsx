'use client'

/**
 * ModeDashboard — dispatches to the correct dashboard component based on mode.
 *
 * - inbound_clinic → DashboardTabs (existing MedSpa dashboard, unchanged)
 * - outbound_db    → OutboundDashboard (existing outbound dashboard, unchanged)
 * - fb_leads       → FbLeadsDashboard (full FB Ads speed-to-lead dashboard)
 */

import type { DashboardMetrics, CallLog, Client } from '@/types/database'
import type { OutboundMetrics } from '@/lib/dashboard/outbound-metrics'
import type { FbLeadsMetrics } from '@/lib/dashboard/fb-leads-metrics'
import type { DashboardException } from '@/lib/dashboard/exceptions'
import type { RecommendedAction } from '@/lib/dashboard/recommended-actions'
import type { ClientService, BillingSummary } from '@/lib/types/domain'
import type { RecentBooking } from './recent-appointments-preview'
import { DashboardTabs } from './dashboard-tabs'
import { OutboundDashboard } from './outbound-dashboard'
import { FbLeadsDashboard } from './fb-leads-dashboard'

// ── Prop types per mode ─────────────────────────────────────────────────────

interface InboundClinicProps {
  mode: 'inbound_clinic'
  tenant: Client
  metrics: DashboardMetrics
  callLogs: CallLog[]
  totalCount: number
  services: ClientService[]
  rangeDays?: number
  failedDeliveries?: number
  integrationsCount?: number
  integrationsHealthy?: number
  billing?: BillingSummary | null
  exceptions?: DashboardException[]
  recommendedActions?: RecommendedAction[]
  recentBookings?: RecentBooking[]
}

interface OutboundDbProps {
  mode: 'outbound_db'
  tenant: Client
  metrics: OutboundMetrics
  callLogs: CallLog[]
  rangeDays?: number
}

interface FbLeadsProps {
  mode: 'fb_leads'
  tenant: Client
  metrics: FbLeadsMetrics
  callLogs: CallLog[]
  rangeDays?: number
}

export type ModeDashboardProps = InboundClinicProps | OutboundDbProps | FbLeadsProps

export function ModeDashboard(props: ModeDashboardProps) {
  switch (props.mode) {
    case 'inbound_clinic':
      return (
        <DashboardTabs
          metrics={props.metrics}
          callLogs={props.callLogs}
          totalCount={props.totalCount}
          currency={props.tenant.currency}
          clientId={props.tenant.id}
          tenant={props.tenant}
          services={props.services}
          rangeDays={props.rangeDays}
          failedDeliveries={props.failedDeliveries}
          integrationsCount={props.integrationsCount}
          integrationsHealthy={props.integrationsHealthy}
          billing={props.billing}
          exceptions={props.exceptions}
          recommendedActions={props.recommendedActions}
          recentBookings={props.recentBookings}
        />
      )

    case 'outbound_db':
      return (
        <OutboundDashboard
          tenant={props.tenant}
          metrics={props.metrics}
          callLogs={props.callLogs}
          rangeDays={props.rangeDays}
        />
      )

    case 'fb_leads':
      return (
        <FbLeadsDashboard
          tenant={props.tenant}
          metrics={props.metrics}
          callLogs={props.callLogs}
          rangeDays={props.rangeDays}
        />
      )

    default: {
      // Exhaustive check — produces compile error if a new mode is added
      const _exhaustive: never = props
      return null
    }
  }
}
