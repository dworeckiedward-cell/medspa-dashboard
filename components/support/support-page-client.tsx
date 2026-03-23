'use client'

import { useState, useCallback, useEffect } from 'react'
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

const CALENDLY_URL = 'https://calendly.com/servifylabs/discovery-call-1?hide_gdpr_banner=1'

function openCalendlyPopup() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).Calendly?.initPopupWidget({ url: CALENDLY_URL })
}

export function SupportPageClient({ requests: initialRequests, tenantSlug }: SupportPageClientProps) {
  const [requests, setRequests] = useState(initialRequests)

  useEffect(() => {
    // Load Calendly widget assets once
    if (!document.getElementById('calendly-css')) {
      const link = document.createElement('link')
      link.id = 'calendly-css'
      link.rel = 'stylesheet'
      link.href = 'https://assets.calendly.com/assets/external/widget.css'
      document.head.appendChild(link)
    }
    if (!document.getElementById('calendly-js')) {
      const script = document.createElement('script')
      script.id = 'calendly-js'
      script.src = 'https://assets.calendly.com/assets/external/widget.js'
      script.async = true
      document.head.appendChild(script)
    }
  }, [])
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
        {/* New request toggle + Calendly */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowForm(!showForm); setSelectedRequest(null) }}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors',
              showForm
                ? 'bg-[var(--brand-surface)] text-[var(--brand-muted)] border border-[var(--brand-border)]'
                : 'bg-[var(--brand-primary)] text-white hover:opacity-90',
            )}
          >
            {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showForm ? 'Cancel' : 'New Request'}
          </button>
          <button
            type="button"
            onClick={openCalendlyPopup}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap border-black bg-black text-white hover:bg-zinc-800 hover:border-zinc-800 dark:border-white dark:bg-white dark:text-black dark:hover:bg-zinc-100 dark:hover:border-zinc-100"
          >
            Schedule a Call →
          </button>
        </div>

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
