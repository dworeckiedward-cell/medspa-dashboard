'use client'

import { useState, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { AddClinicWizard } from './add-clinic-wizard'
import { OpsNotificationsWidget } from './ops-notifications-widget'

interface OpsNotification {
  id: string
  tenantId: string | null
  type: string
  title: string
  description: string | null
  actionHref: string | null
  isRead: boolean
  createdAt: string
}

interface OpsHeaderActionsProps {
  notifications: OpsNotification[]
  unreadCount: number
}

export function OpsHeaderActions({ notifications, unreadCount }: OpsHeaderActionsProps) {
  const [wizardOpen, setWizardOpen] = useState(false)

  const handleClinicCreated = useCallback((tenantId: string) => {
    // Could trigger a page refresh here if needed
    // For now, the wizard shows a success state
  }, [])

  return (
    <div className="flex items-center gap-2">
      <OpsNotificationsWidget
        initialNotifications={notifications}
        initialUnreadCount={unreadCount}
      />
      <button
        onClick={() => setWizardOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Clinic
      </button>
      <AddClinicWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCreated={handleClinicCreated}
      />
    </div>
  )
}
