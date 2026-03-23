'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Pencil, X } from 'lucide-react'
import { LogoManager } from './logo-manager'

interface LogoCardProps {
  currentLogoUrl: string | null
  tenantName: string
  brandColor: string | null
  tenantSlug: string
}

export function LogoCard({ currentLogoUrl, tenantName, brandColor, tenantSlug }: LogoCardProps) {
  const [open, setOpen] = useState(false)
  const [logoUrl, setLogoUrl] = useState(currentLogoUrl)
  const initial = tenantName.charAt(0).toUpperCase()

  return (
    <>
      {/* Compact preview card */}
      <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl overflow-hidden border border-[var(--brand-border)]"
            style={{ background: logoUrl ? '#ffffff' : (brandColor ?? 'var(--brand-primary)') }}
          >
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={tenantName}
                width={40}
                height={40}
                className="object-cover"
              />
            ) : (
              <span className="text-white text-sm font-semibold">{initial}</span>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--brand-text)]">
              {logoUrl ? 'Logo uploaded' : 'No logo set'}
            </p>
            <p className="text-[10px] text-[var(--brand-muted)] mt-0.5">
              Displayed in the sidebar and reports
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-3 py-1.5 text-xs font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:border-[var(--brand-primary)]/50 transition-colors duration-150"
        >
          <Pencil className="h-3 w-3" />
          {logoUrl ? 'Change' : 'Upload'}
        </button>
      </div>

      {/* Modal */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-lg rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-2xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--brand-border)]">
                <h3 className="text-sm font-semibold text-[var(--brand-text)]">Clinic Logo</h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1 text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-bg)] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-5 max-h-[70vh] overflow-y-auto">
                <LogoManager
                  currentLogoUrl={logoUrl}
                  tenantName={tenantName}
                  brandColor={brandColor}
                  tenantSlug={tenantSlug}
                  onLogoChange={(newUrl) => setLogoUrl(newUrl)}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
