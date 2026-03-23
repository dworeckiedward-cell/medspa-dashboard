'use client'

import { computeLeads } from './leads-transform'
import { computeFollowUpTasks } from './followup-transform'
import type { Contact, FollowUpTask } from '@/lib/types/domain'
import type { CallLog } from '@/types/database'
import type { BookedNotification, BudgetAlertLevel } from '@/components/dashboard/notification-bell'

const CACHE_TTL = 120_000 // 2 minutes

export interface BookingRow {
  id: string
  patient_name: string
  patient_phone: string | null
  patient_email: string | null
  appointment_date: string
  appointment_time: string
  practitioner_name: string | null
  duration_minutes: number
  amount_cents: number
  currency: string
  payment_status: string
  status: string
  source: string | null
  created_at: string
  patient_notes?: string | null
  call_log_id?: string | null
  stripe_payment_method_id?: string | null
  no_show_charged?: boolean | null
  tenant_services: unknown
}

export interface DashboardCacheEntry {
  tenantId: string
  tenantSlug: string
  calls: CallLog[]
  leads: Contact[]
  followUpTasks: FollowUpTask[]
  bookings: BookingRow[]
  followUpCount: number
  bookedNotificationCount: number
  bookedNotifications: BookedNotification[]
  budgetAlert: BudgetAlertLevel
  lastRefreshedAt: Date
  fetchedAt: number
}

// ── Module-level cache — persists across React re-mounts within the same tab ──
const cache = new Map<string, DashboardCacheEntry>()
const inFlight = new Map<string, Promise<DashboardCacheEntry>>()

export function getCachedEntry(tenantId: string): DashboardCacheEntry | null {
  return cache.get(tenantId) ?? null
}

export function isCacheStale(tenantId: string): boolean {
  const entry = cache.get(tenantId)
  return !entry || Date.now() - entry.fetchedAt > CACHE_TTL
}

export function invalidateCache(tenantId: string): void {
  cache.delete(tenantId)
}

export async function fetchAndCache(
  tenantId: string,
  tenantSlug: string,
  monthlyBudgetCents: number,
): Promise<DashboardCacheEntry> {
  // Return in-flight promise to deduplicate concurrent requests
  const existing = inFlight.get(tenantId)
  if (existing) return existing

  const promise = (async (): Promise<DashboardCacheEntry> => {
    try {
      // Fetch via API route (server-side service-role client, bypasses RLS).
      // Pass ?tenant= so the middleware resolves the slug for authenticated users.
      const res = await fetch(`/api/dashboard-data?tenant=${encodeURIComponent(tenantSlug)}`, { credentials: 'include' })
      if (!res.ok) {
        throw new Error(`[dashboard-cache] API error ${res.status}`)
      }
      const json = await res.json() as { calls: CallLog[]; bookings: BookingRow[] }

      const rawCalls = (json.calls ?? []) as CallLog[]
      const bookings = (json.bookings ?? []) as BookingRow[]

      // Pure-JS transformations (no server deps)
      const rawRows = rawCalls as unknown as Record<string, unknown>[]
      const leads = computeLeads(rawRows, tenantId)
      const followUpTasks = computeFollowUpTasks(rawRows, tenantId)

      // Header / sidebar computed values
      const followUpCount = rawCalls.filter((c) => c.human_followup_needed).length
      const bookedCalls = rawCalls.filter((c) => c.is_booked)
      const bookedNotificationCount = bookedCalls.length
      const bookedNotifications: BookedNotification[] = bookedCalls
        .slice(0, 5)
        .map((c) => {
          const r = c as unknown as Record<string, unknown>
          return {
            id: c.id,
            title: r.semantic_title as string | null ?? 'Appointment booked',
            created_at: c.created_at,
            caller_name: r.caller_name as string | null ?? null,
            potential_revenue:
              (r.potential_revenue as number) > 0 ? (r.potential_revenue as number) : null,
          }
        })

      // Budget alert — computed from monthly cost_cents
      const monthStart = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1,
      ).toISOString()
      const monthCostCents = rawCalls
        .filter((c) => c.created_at >= monthStart)
        .reduce((s, c) => s + (((c as unknown as Record<string, unknown>).cost_cents as number | null) ?? 0), 0)
      const pct = monthlyBudgetCents > 0
        ? Math.round((monthCostCents / monthlyBudgetCents) * 100)
        : 0
      const budgetAlert: BudgetAlertLevel =
        pct >= 100 ? 'critical' : pct >= 90 ? 'warning' : null

      const entry: DashboardCacheEntry = {
        tenantId,
        tenantSlug,
        calls: rawCalls,
        leads,
        followUpTasks,
        bookings,
        followUpCount,
        bookedNotificationCount,
        bookedNotifications,
        budgetAlert,
        lastRefreshedAt: new Date(),
        fetchedAt: Date.now(),
      }

      cache.set(tenantId, entry)
      return entry
    } finally {
      inFlight.delete(tenantId)
    }
  })()

  inFlight.set(tenantId, promise)
  return promise
}
