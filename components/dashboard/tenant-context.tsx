'use client'

import { createContext, useContext } from 'react'
import type { Client } from '@/types/database'

const TenantContext = createContext<Client | null>(null)

export function TenantContextProvider({
  tenant,
  children,
}: {
  tenant: Client
  children: React.ReactNode
}) {
  return (
    <TenantContext.Provider value={tenant}>
      {children}
    </TenantContext.Provider>
  )
}

/**
 * Returns the server-resolved tenant Client object.
 * Available in all /dashboard/* client components.
 */
export function useTenantContext(): Client {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error('useTenantContext must be used inside /dashboard layout')
  return ctx
}
