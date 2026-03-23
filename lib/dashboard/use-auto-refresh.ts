'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface UseAutoRefreshResult {
  lastRefreshedAt: Date
  isRefreshing: boolean
}

/**
 * Periodically calls router.refresh() to re-run all server components on the
 * current page and stream fresh data — no full page reload, no client fetch URLs.
 *
 * Pauses when the browser tab is hidden (visibilitychange API).
 * Immediately refreshes when the tab becomes visible again after being hidden.
 */
export function useAutoRefresh(intervalMs = 120_000): UseAutoRefreshResult {
  const router = useRouter()
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(() => new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wasHiddenRef = useRef(false)

  const refresh = useCallback(() => {
    if (document.visibilityState === 'hidden') return
    setIsRefreshing(true)
    router.refresh()
    setLastRefreshedAt(new Date())
    setTimeout(() => setIsRefreshing(false), 800)
  }, [router])

  useEffect(() => {
    // Kick off the interval
    timerRef.current = setInterval(refresh, intervalMs)

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        wasHiddenRef.current = true
      } else if (wasHiddenRef.current) {
        // Tab came back into view after being hidden — refresh immediately
        wasHiddenRef.current = false
        refresh()
        // Reset the interval so the next auto-refresh fires a full cycle later
        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = setInterval(refresh, intervalMs)
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [refresh, intervalMs])

  return { lastRefreshedAt, isRefreshing }
}
