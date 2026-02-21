'use client'

import { useSearchParams } from 'next/navigation'
import { Shield, X } from 'lucide-react'
import { useState } from 'react'

interface SupportViewBannerProps {
  tenantName: string
}

/**
 * Visible banner shown when a Servify operator is viewing a client dashboard
 * in support/preview mode.
 *
 * Activated when ?support=true is in the URL (set by ops console action buttons).
 * Purely visual — does not change auth or data access.
 *
 * TODO: Wire to actual operator session tracking once RBAC is in place.
 */
export function SupportViewBanner({ tenantName }: SupportViewBannerProps) {
  const searchParams = useSearchParams()
  const isSupport = searchParams.get('support') === 'true'
  const [dismissed, setDismissed] = useState(false)

  if (!isSupport || dismissed) return null

  return (
    <div className="bg-violet-600 text-white px-4 py-2 flex items-center justify-between gap-3 text-sm z-[60] relative">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 shrink-0" />
        <span className="font-medium">
          Support View
        </span>
        <span className="hidden sm:inline text-violet-200">
          — Viewing <strong className="text-white">{tenantName}</strong> as Servify Admin
        </span>
      </div>
      <div className="flex items-center gap-3">
        <a
          href="/ops"
          className="text-xs font-medium text-violet-200 hover:text-white transition-colors underline underline-offset-2"
        >
          Back to Ops Console
        </a>
        <button
          onClick={() => setDismissed(true)}
          className="text-violet-300 hover:text-white transition-colors"
          aria-label="Dismiss support banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
