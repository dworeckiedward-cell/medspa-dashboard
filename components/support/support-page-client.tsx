'use client'

import { useState, useCallback } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RequestForm } from './request-form'
import { RequestList } from './request-list'
import { RequestDetail } from './request-detail'
import type { SupportRequest } from '@/lib/support/types'

interface SupportPageClientProps {
  requests: SupportRequest[]
  tenantSlug: string
}

export function SupportPageClient({ requests: initialRequests, tenantSlug }: SupportPageClientProps) {
  const [requests, setRequests] = useState(initialRequests)
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null)
  const [showForm, setShowForm] = useState(false)

  const refreshList = useCallback(async () => {
    try {
      const res = await fetch(`/api/support?tenant=${encodeURIComponent(tenantSlug)}`)
      if (res.ok) {
        const data = await res.json()
        setRequests(data.requests ?? [])
      }
    } catch {
      // Fail silently
    }
  }, [tenantSlug])

  function handleCreated(_requestId: string, _shortCode: string) {
    setShowForm(false)
    refreshList()
  }

  function handleSelectRequest(r: SupportRequest) {
    setSelectedRequest(r)
    setShowForm(false)
  }

  return (
    <div className="flex flex-col md:flex-row gap-4 min-h-[400px] md:h-[calc(100dvh-12rem)]">
      {/* Left: request list */}
      <div className={cn(
        'w-full md:w-[320px] lg:w-[360px] md:shrink-0 flex flex-col gap-3',
        selectedRequest ? 'hidden md:flex' : 'flex',
      )}>
        {/* New request toggle */}
        <button
          onClick={() => { setShowForm(!showForm); setSelectedRequest(null) }}
          className={cn(
            'inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors self-start',
            showForm
              ? 'bg-[var(--brand-surface)] text-[var(--brand-muted)] border border-[var(--brand-border)]'
              : 'bg-[var(--brand-primary)] text-white hover:opacity-90',
          )}
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? 'Cancel' : 'New Request'}
        </button>

        <div className="flex-1 min-h-0">
          <RequestList
            requests={requests}
            onSelect={handleSelectRequest}
            selectedId={selectedRequest?.id}
          />
        </div>
      </div>

      {/* Right: form or detail */}
      <div className={cn(
        'flex-1 min-w-0',
        !selectedRequest && !showForm ? 'hidden md:flex md:items-center md:justify-center' : 'flex flex-col',
      )}>
        {showForm ? (
          <RequestForm tenantSlug={tenantSlug} onCreated={handleCreated} />
        ) : selectedRequest ? (
          <RequestDetail
            request={selectedRequest}
            tenantSlug={tenantSlug}
            onBack={() => setSelectedRequest(null)}
            onRefresh={refreshList}
          />
        ) : (
          <p className="text-xs text-[var(--brand-muted)]">
            Select a request to view details, or create a new one.
          </p>
        )}
      </div>
    </div>
  )
}
