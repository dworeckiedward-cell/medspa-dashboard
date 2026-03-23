'use client'

import { useState } from 'react'
import { CallLogsTable } from './call-logs-table'
import { CallDetailPanel } from './call-detail-panel'
import type { CallLog } from '@/types/database'

interface CallLogsWithPanelProps {
  initialData: CallLog[]
  totalCount: number
  clientId: string
  tenantSlug?: string | null
  initialChipRecording?: boolean
  initialChipBookedOrLead?: boolean
  initialDirection?: string
  initialMinDurationSec?: number
  initialMinLeadConfidence?: number
  initialBookedOnly?: boolean
}

/**
 * Wraps CallLogsTable + CallDetailPanel together as a client component.
 * Used on the /dashboard/call-logs page so row clicks open the detail modal.
 */
export function CallLogsWithPanel({
  initialData,
  totalCount,
  clientId,
  tenantSlug,
  initialChipRecording,
  initialChipBookedOrLead,
  initialDirection,
  initialMinDurationSec,
  initialMinLeadConfidence,
  initialBookedOnly,
}: CallLogsWithPanelProps) {
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null)

  return (
    <>
      <CallDetailPanel
        log={selectedCall}
        onClose={() => setSelectedCall(null)}
        onDeleted={() => setSelectedCall(null)}
        tenantSlug={tenantSlug}
      />
      <CallLogsTable
        initialData={initialData}
        totalCount={totalCount}
        clientId={clientId}
        onSelectCall={setSelectedCall}
        initialChipRecording={initialChipRecording}
        initialChipBookedOrLead={initialChipBookedOrLead}
        initialDirection={initialDirection}
        initialMinDurationSec={initialMinDurationSec}
        initialMinLeadConfidence={initialMinLeadConfidence}
        initialBookedOnly={initialBookedOnly}
      />
    </>
  )
}
