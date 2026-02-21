'use client'

import { PresentationToggle } from './presentation-toggle'

export function ReportsPageHeader() {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-[var(--brand-text)]">Reports & ROI</h1>
        <p className="text-sm text-[var(--brand-muted)] mt-1">
          Revenue attribution, booking proof, and executive reporting.
        </p>
      </div>
      <PresentationToggle variant="button" />
    </div>
  )
}
