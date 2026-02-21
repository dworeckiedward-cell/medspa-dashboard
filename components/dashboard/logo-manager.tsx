'use client'

import { useState } from 'react'
import { ImageIcon, Loader2, Check, AlertCircle, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface LogoManagerProps {
  currentLogoUrl: string | null
  tenantName: string
  brandColor?: string | null
}

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function LogoManager({ currentLogoUrl, tenantName, brandColor }: LogoManagerProps) {
  const [logoUrl, setLogoUrl] = useState(currentLogoUrl ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState(false)

  const hasChanged = logoUrl.trim() !== (currentLogoUrl ?? '')
  const urlValid = logoUrl.trim() === '' || isValidUrl(logoUrl.trim())

  async function handleSave() {
    setError(null)
    setSaved(false)

    const trimmed = logoUrl.trim()
    if (trimmed && !isValidUrl(trimmed)) {
      setError('Please enter a valid URL (https://...)')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/branding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoUrl: trimmed || null }),
      })

      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? 'Failed to update logo')
        return
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  function handleClear() {
    setLogoUrl('')
    setPreviewError(false)
    setError(null)
  }

  const previewUrl = logoUrl.trim()
  const showPreview = previewUrl && isValidUrl(previewUrl) && !previewError

  return (
    <div className="space-y-4">
      {/* Preview */}
      <div className="flex items-center gap-4">
        <div
          className={cn(
            'flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border-2 border-dashed overflow-hidden transition-colors',
            showPreview
              ? 'border-[var(--brand-border)] bg-white dark:bg-gray-900'
              : 'border-[var(--brand-border)] bg-[var(--brand-bg)]',
          )}
        >
          {showPreview ? (
            <img
              src={previewUrl}
              alt={`${tenantName} logo`}
              className="h-full w-full object-contain p-1"
              onError={() => setPreviewError(true)}
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-white text-lg font-bold rounded-lg"
              style={{ background: brandColor ?? '#2563EB' }}
            >
              {tenantName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--brand-text)]">Clinic Logo</p>
          <p className="text-xs text-[var(--brand-muted)] mt-0.5">
            Displayed in your dashboard header and reports. Use a square or wide image for best results.
          </p>
        </div>
      </div>

      {/* URL Input */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-[var(--brand-muted)]">
          Logo URL
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--brand-muted)]" />
            <Input
              placeholder="https://your-domain.com/logo.png"
              value={logoUrl}
              onChange={(e) => {
                setLogoUrl(e.target.value)
                setPreviewError(false)
                setError(null)
                setSaved(false)
              }}
              className="pl-9 h-9 text-sm"
            />
            {logoUrl && (
              <button
                onClick={handleClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
                aria-label="Clear"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button
            variant="brand"
            size="sm"
            disabled={saving || !hasChanged || (!urlValid && logoUrl.trim() !== '')}
            onClick={handleSave}
            className="shrink-0"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : saved ? (
              <Check className="h-3.5 w-3.5" />
            ) : null}
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
          </Button>
        </div>
        <p className="text-[10px] text-[var(--brand-muted)]">
          Paste a direct link to your logo image. Supports PNG, SVG, and JPG.
          {!currentLogoUrl && ' Leave blank to use your clinic initial as the logo.'}
        </p>
      </div>

      {/* Validation error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/30 px-3 py-2 text-xs text-rose-700 dark:text-rose-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Preview error */}
      {previewError && previewUrl && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400">
          Could not load preview — the URL may not be a valid image. The logo will still be saved.
        </p>
      )}
    </div>
  )
}
