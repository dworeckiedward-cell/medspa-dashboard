'use client'

import { useState, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { AddClientWizard } from './add-client-wizard'
import { OpsNotificationsWidget } from './ops-notifications-widget'
import { OpsClinicSwitcher, type ClinicSwitcherItem } from './ops-clinic-switcher'
import { AiStatusPill } from '@/components/ui/ai-status-pill'

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
  clinics?: ClinicSwitcherItem[]
  currentClientId?: string | null
}

export function OpsHeaderActions({ notifications, unreadCount, clinics = [], currentClientId }: OpsHeaderActionsProps) {
  const [wizardOpen, setWizardOpen] = useState(false)

  const handleClinicCreated = useCallback((_tenantId: string) => {
    // Wizard shows success state; page will refresh on next navigation
  }, [])

  return (
    <div className="flex items-center gap-2">
      {clinics.length > 0 && (
        <OpsClinicSwitcher clinics={clinics} currentClientId={currentClientId} />
      )}
      <AiStatusPill />
      <OpsNotificationsWidget
        initialNotifications={notifications}
        initialUnreadCount={unreadCount}
      />
      <button
        onClick={() => setWizardOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Client
      </button>
      <AddClientWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCreated={handleClinicCreated}
      />
    </div>
  )
}
