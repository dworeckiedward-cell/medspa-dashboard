'use client'

/**
 * LogoManager — upload (with auto-optimize), URL paste, drag-and-drop.
 *
 * Large files (>2 MB) are automatically resized + converted to WebP
 * on the client before upload. No server changes needed.
 */

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ImageIcon, Loader2, Check, AlertCircle, X, Upload, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { buildTenantApiUrl } from '@/lib/dashboard/tenant-api'
import { useToast } from '@/components/dashboard/toast-provider'

interface LogoManagerProps {
  currentLogoUrl: string | null
  tenantName: string
  brandColor?: string | null
  /** Required for tenant-scoped API calls */
  tenantSlug: string
  /** Callback when the logo URL changes (upload or remove) */
  onLogoChange?: (url: string | null) => void
}

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2 MB
const MAX_EDGE = 1024 // resize longest edge
const WEBP_QUALITY = 0.82

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Client-side image optimization: resize + convert to WebP */
async function optimizeImage(file: File): Promise<{ blob: Blob; originalSize: number; optimizedSize: number }> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = bitmap

  // Calculate new dimensions (max longest edge = MAX_EDGE)
  let newW = width
  let newH = height
  if (width > MAX_EDGE || height > MAX_EDGE) {
    if (width >= height) {
      newW = MAX_EDGE
      newH = Math.round(height * (MAX_EDGE / width))
    } else {
      newH = MAX_EDGE
      newW = Math.round(width * (MAX_EDGE / height))
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = newW
  canvas.height = newH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not available')
  ctx.drawImage(bitmap, 0, 0, newW, newH)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Failed to create optimized image'))
        resolve({ blob, originalSize: file.size, optimizedSize: blob.size })
      },
      'image/webp',
      WEBP_QUALITY,
    )
  })
}

type UploadState =
  | { kind: 'idle' }
  | { kind: 'uploading' }
  | { kind: 'needs-optimize'; file: File }
  | { kind: 'optimizing'; file: File }

export function LogoManager({ currentLogoUrl, tenantName, brandColor, tenantSlug, onLogoChange }: LogoManagerProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [logoUrl, setLogoUrl] = useState(currentLogoUrl ?? '')
  // Tracks the URL returned from a successful file upload (already persisted to DB).
  // Prevents the Save button from re-enabling after upload while router.refresh() settles.
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadState, setUploadState] = useState<UploadState>({ kind: 'idle' })
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [optimizeInfo, setOptimizeInfo] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploading = uploadState.kind === 'uploading' || uploadState.kind === 'optimizing'

  // Compare against the effective saved URL: prefer the just-uploaded URL over the
  // page-load prop, so Save doesn't re-enable immediately after upload while refresh settles.
  const effectiveSavedUrl = uploadedUrl ?? currentLogoUrl ?? ''
  const hasChanged = logoUrl.trim() !== effectiveSavedUrl
  const urlValid = logoUrl.trim() === '' || isValidUrl(logoUrl.trim())

  // ── Upload blob to server ───────────────────────────────────────────────

  async function uploadBlob(blob: Blob, filename: string) {
    setUploadState({ kind: 'uploading' })
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', blob, filename)

      const res = await fetch(buildTenantApiUrl('/api/branding/logo-upload', tenantSlug), {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: 'Upload failed' }))
        const msg = json.error ?? 'Failed to upload logo'
        setError(msg)
        toast({ type: 'error', message: msg })
        return
      }

      const data = await res.json()
      if (data.logoUrl) {
        setLogoUrl(data.logoUrl)
        setUploadedUrl(data.logoUrl)
        setPreviewError(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
        toast({ type: 'success', message: 'Logo uploaded and saved' })
        onLogoChange?.(data.logoUrl)
        router.refresh()
      }
    } catch {
      const msg = 'Network error — please try again'
      setError(msg)
      toast({ type: 'error', message: msg })
    } finally {
      setUploadState({ kind: 'idle' })
    }
  }

  // ── Process a selected file ──────────────────────────────────────────────

  async function processFile(file: File) {
    setError(null)
    setSaved(false)
    setOptimizeInfo(null)

    // Validate type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Unsupported file type. Use PNG, JPG, WebP, or SVG.')
      return
    }

    // SVG: upload directly (skip optimization), enforce size limit
    if (file.type === 'image/svg+xml') {
      if (file.size > MAX_FILE_SIZE) {
        setError('SVG file is too large. Maximum size is 2 MB.')
        return
      }
      setOptimizeInfo('SVG is recommended for crisp logos at any size.')
      await uploadBlob(file, file.name)
      return
    }

    // Small enough: upload directly
    if (file.size <= MAX_FILE_SIZE) {
      await uploadBlob(file, file.name)
      return
    }

    // Large file: show guidance state
    setUploadState({ kind: 'needs-optimize', file })
  }

  // ── Auto-optimize and upload ─────────────────────────────────────────────

  async function handleOptimizeAndUpload() {
    if (uploadState.kind !== 'needs-optimize') return
    const { file } = uploadState
    setUploadState({ kind: 'optimizing', file })
    setError(null)

    try {
      const { blob, originalSize, optimizedSize } = await optimizeImage(file)
      setOptimizeInfo(`Optimized from ${formatBytes(originalSize)} → ${formatBytes(optimizedSize)}`)

      if (blob.size > MAX_FILE_SIZE) {
        setError(`Optimized file is still ${formatBytes(blob.size)}. Try a smaller image or paste a URL.`)
        setUploadState({ kind: 'idle' })
        return
      }

      const ext = 'webp'
      const basename = file.name.replace(/\.[^.]+$/, '')
      await uploadBlob(blob, `${basename}.${ext}`)
    } catch {
      setError('Optimization failed. Try a different image or paste a URL instead.')
      setUploadState({ kind: 'idle' })
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Drag & drop ──────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) processFile(file)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tenantSlug],
  )

  // ── Save URL ────────────────────────────────────────────────────────────

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
      const res = await fetch(buildTenantApiUrl('/api/branding', tenantSlug), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoUrl: trimmed || null }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: 'Failed to update logo' }))
        const msg = json.error ?? 'Failed to update logo'
        setError(msg)
        toast({ type: 'error', message: msg })
        return
      }

      // After a manual URL-paste save, treat the pasted URL as the new effective saved URL
      // so hasChanged resets to false immediately (before router.refresh() completes).
      setUploadedUrl(trimmed || null)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      toast({ type: 'success', message: 'Logo saved' })
      onLogoChange?.(trimmed || null)
      router.refresh()
    } catch {
      const msg = 'Network error — please try again'
      setError(msg)
      toast({ type: 'error', message: msg })
    } finally {
      setSaving(false)
    }
  }

  function handleClear() {
    setLogoUrl('')
    setUploadedUrl(null)
    setPreviewError(false)
    setError(null)
    setOptimizeInfo(null)
    setUploadState({ kind: 'idle' })
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

      {/* Drag & drop zone + file input */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-[var(--brand-muted)]">
          Upload from device
        </label>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 cursor-pointer transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/30',
            isDragging
              ? 'border-[var(--brand-primary)]/50 bg-[var(--brand-primary)]/[0.04]'
              : 'border-[var(--brand-border)] hover:border-[var(--brand-border)]/80 hover:bg-[var(--brand-bg)]/50',
            uploading && 'pointer-events-none opacity-60',
          )}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleFileChange}
            className="hidden"
            aria-label="Upload logo file"
          />

          {uploading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-muted)]" />
              <p className="text-xs text-[var(--brand-muted)]">
                {uploadState.kind === 'optimizing' ? 'Optimizing…' : 'Uploading…'}
              </p>
            </>
          ) : (
            <>
              <Upload className="h-5 w-5 text-[var(--brand-muted)] opacity-60" />
              <p className="text-xs text-[var(--brand-muted)]">
                {isDragging ? 'Drop image here' : 'Click or drag image here'}
              </p>
              <p className="text-[10px] text-[var(--brand-muted)] opacity-60">
                PNG, JPG, WebP, or SVG — large files auto-optimized
              </p>
            </>
          )}
        </div>
      </div>

      {/* Needs optimization guidance — not an error, a helpful state */}
      {uploadState.kind === 'needs-optimize' && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 px-4 py-3">
          <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
              Your logo is {formatBytes(uploadState.file.size)}
            </p>
            <p className="text-[11px] text-amber-700/80 dark:text-amber-400/70 mt-0.5">
              We can resize and convert to WebP automatically, or you can paste a URL instead.
            </p>
            <div className="flex items-center gap-2 mt-2.5">
              <Button
                size="sm"
                variant="brand"
                onClick={handleOptimizeAndUpload}
                className="text-xs h-7 gap-1"
              >
                <Sparkles className="h-3 w-3" />
                Optimize & Upload
              </Button>
              <button
                onClick={() => setUploadState({ kind: 'idle' })}
                className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Optimization success info */}
      {optimizeInfo && !error && (
        <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
          {optimizeInfo}
        </p>
      )}

      {/* URL Input */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-[var(--brand-muted)]">
          Or paste logo URL
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
            disabled={saving || uploading || !hasChanged || (!urlValid && logoUrl.trim() !== '')}
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
          Paste a direct link to your logo image.
          {!currentLogoUrl && ' Leave blank to use your clinic initial as the logo.'}
        </p>
      </div>

      {/* Error — only real errors (not file-too-large guidance) */}
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
