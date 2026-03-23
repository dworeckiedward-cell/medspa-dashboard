'use client'

/**
 * DashboardModeContext — provides the current DashboardMode and its config
 * to deeply nested client components without prop drilling.
 *
 * The provider is mounted in DashboardLayout (components/dashboard/layout.tsx).
 * Server components should use getDashboardMode(tenant) directly instead.
 */

import { createContext, useContext } from 'react'
import type { DashboardMode } from '@/lib/ops/get-client-type'
import type { DashboardModeConfig } from './mode-registry'

interface DashboardModeContextValue {
  mode: DashboardMode
  config: DashboardModeConfig
}

export const DashboardModeContext = createContext<DashboardModeContextValue | null>(null)

/**
 * Read the current dashboard mode from context.
 * Must be used inside a DashboardModeProvider (mounted in DashboardLayout).
 */
export function useDashboardMode(): DashboardModeContextValue {
  const ctx = useContext(DashboardModeContext)
  if (!ctx) {
    throw new Error('useDashboardMode must be used within a DashboardModeProvider (DashboardLayout)')
  }
  return ctx
}
