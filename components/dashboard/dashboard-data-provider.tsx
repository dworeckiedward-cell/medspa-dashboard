'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import {
  fetchAndCache,
  getCachedEntry,
  isCacheStale,
  invalidateCache,
  type DashboardCacheEntry,
  type BookingRow,
} from '@/lib/dashboard/dashboard-cache'
import type { CallLog } from '@/types/database'
import type { Contact, FollowUpTask } from '@/lib/types/domain'
import type { BookedNotification, BudgetAlertLevel } from './notification-bell'

// ── Context shape ─────────────────────────────────────────────────────────────

export interface DashboardData {
  tenantId: string
  tenantSlug: string
  calls: CallLog[]
  leads: Contact[]
  followUpTasks: FollowUpTask[]
  bookings: BookingRow[]
  loading: boolean
  followUpCount: number
  bookedNotificationCount: number
  bookedNotifications: BookedNotification[]
  budgetAlert: BudgetAlertLevel
  lastRefreshedAt: Date
  isRefreshing: boolean
  refresh: () => void
}

const DashboardDataContext = createContext<DashboardData | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────

interface DashboardDataProviderProps {
  tenantId: string
  tenantSlug: string
  monthlyBudgetCents: number
  children: React.ReactNode
}

export function DashboardDataProvider({
  tenantId,
  tenantSlug,
  monthlyBudgetCents,
  children,
}: DashboardDataProviderProps) {
  const cached = getCachedEntry(tenantId)

  const [data, setData] = useState<DashboardData>(() =>
    entryToData(cached, false),
  )
  const [isRefreshing, setIsRefreshing] = useState(false)
  const mountedRef = useRef(true)

  const refresh = useCallback(
    async (silent = false) => {
      if (silent) setIsRefreshing(true)
      try {
        const entry = await fetchAndCache(tenantId, tenantSlug, monthlyBudgetCents)
        if (mountedRef.current) {
          setData(entryToData(entry, false))
        }
      } catch (err) {
        console.error('[DashboardDataProvider] fetch failed:', err)
      } finally {
        if (mountedRef.current) setIsRefreshing(false)
      }
    },
    [tenantId, tenantSlug, monthlyBudgetCents],
  )

  useEffect(() => {
    mountedRef.current = true

    // If cache is stale (or empty), fetch immediately
    if (isCacheStale(tenantId)) {
      refresh()
    }

    // Background refresh every 2 minutes
    const interval = setInterval(() => refresh(true), 120_000)

    return () => {
      mountedRef.current = false
      clearInterval(interval)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]) // intentionally omit refresh — it's stable

  const forceRefresh = useCallback(() => {
    invalidateCache(tenantId)
    refresh()
  }, [tenantId, refresh])

  const value: DashboardData = {
    ...data,
    isRefreshing,
    refresh: forceRefresh,
  }

  return (
    <DashboardDataContext.Provider value={value}>
      {children}
    </DashboardDataContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/** Returns dashboard data from context, or null if no provider is mounted. */
export function useDashboardData(): DashboardData | null {
  return useContext(DashboardDataContext)
}

// ── Helper ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {}

function entryToData(
  entry: DashboardCacheEntry | null,
  loading: boolean,
): DashboardData {
  if (!entry) {
    return {
      tenantId: '',
      tenantSlug: '',
      calls: [],
      leads: [],
      followUpTasks: [],
      bookings: [],
      loading: true,
      followUpCount: 0,
      bookedNotificationCount: 0,
      bookedNotifications: [],
      budgetAlert: null,
      lastRefreshedAt: new Date(),
      isRefreshing: false,
      refresh: noop,
    }
  }
  return {
    tenantId: entry.tenantId,
    tenantSlug: entry.tenantSlug,
    calls: entry.calls,
    leads: entry.leads,
    followUpTasks: entry.followUpTasks,
    bookings: entry.bookings,
    loading,
    followUpCount: entry.followUpCount,
    bookedNotificationCount: entry.bookedNotificationCount,
    bookedNotifications: entry.bookedNotifications,
    budgetAlert: entry.budgetAlert,
    lastRefreshedAt: entry.lastRefreshedAt,
    isRefreshing: false,
    refresh: noop,
  }
}
