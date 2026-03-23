/**
 * Derive the dashboard variant for a tenant.
 *
 * `dashboard_mode` is the primary field (migration 026). It controls which
 * KPIs, lead pipeline, and UI sections the tenant dashboard shows.
 *
 * `client_type` (migration 025) is the legacy field — still read as a fallback
 * so existing tenants with only client_type set continue to work unchanged.
 *
 * Resolution order:
 *   1. dashboard_mode (if present and valid)  → use directly
 *   2. client_type    (legacy fallback)        → map to DashboardMode
 *   3. default                                 → 'inbound_clinic'
 *
 * This ensures 100% backward compatibility: a tenant that has never been
 * updated will default to the existing inbound/clinic dashboard.
 */

// ── New type — the canonical dashboard mode discriminator ──────────────────

export type DashboardMode = 'inbound_clinic' | 'outbound_db' | 'fb_leads'

const VALID_MODES: ReadonlySet<string> = new Set<DashboardMode>([
  'inbound_clinic',
  'outbound_db',
  'fb_leads',
])

export function getDashboardMode(
  client: {
    dashboard_mode?: string | null | undefined
    client_type?: string | null | undefined
  },
): DashboardMode {
  // 1. New field takes priority — only accept known values
  if (client.dashboard_mode && VALID_MODES.has(client.dashboard_mode)) {
    return client.dashboard_mode as DashboardMode
  }

  // 2. Legacy fallback — map old client_type values
  if (client.client_type === 'outbound') return 'outbound_db'

  // 3. Default — standard inbound dashboard
  return 'inbound_clinic'
}

// ── Deprecated aliases — keep until all consumers are migrated ─────────────
// These ensure zero breakage for any file importing the old names.

/** @deprecated Use `DashboardMode` instead. */
export type ClientType = DashboardMode

/** @deprecated Use `getDashboardMode()` instead. */
export const getClientType = getDashboardMode
