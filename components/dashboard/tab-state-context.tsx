'use client'

import { createContext, useContext } from 'react'

export interface TabStateValue {
  activeTab: string
  setActiveTab: (href: string) => void
}

export const TabStateContext = createContext<TabStateValue | null>(null)

export function useTabState(): TabStateValue | null {
  return useContext(TabStateContext)
}
