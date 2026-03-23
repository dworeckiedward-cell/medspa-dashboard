import type { Client } from '@/types/database'

/**
 * Feature flags derived from `client.features` JSONB column.
 *
 * Convention: a missing key OR `true` means the feature IS enabled.
 * An explicit `false` disables it.
 *
 * SQL to configure Live Younger (run once in Supabase SQL editor):
 *   ALTER TABLE clients ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}';
 *   UPDATE clients
 *     SET features = '{"jane_api": false, "appointments_visible": false, "booked_revenue_visible": false}'
 *     WHERE slug = 'live-younger';
 */
export interface TenantFeatures {
  /** Show Appointments section, sidebar item, and booked-count KPI. Default: true */
  showAppointments: boolean
  /** Show Booked Value toggle in revenue chart and Revenue KPI. Default: true */
  showBookedRevenue: boolean
  /** Jane API integration active — controls whether bookings table has data. Default: true */
  janeApi: boolean
  /** Show Potential Revenue KPI card. Default: true */
  showPotentialRevenue: boolean
}

export function getTenantFeatures(tenant: Client): TenantFeatures {
  const f = (tenant.features ?? {}) as Record<string, unknown>
  return {
    showAppointments:      f.appointments_visible      !== false,
    showBookedRevenue:     f.booked_revenue_visible     !== false,
    janeApi:               f.jane_api                  !== false,
    showPotentialRevenue:  f.potential_revenue_visible  !== false,
  }
}
