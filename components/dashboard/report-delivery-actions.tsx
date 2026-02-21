'use client'

/**
 * ReportDeliveryActions — Copy / PDF / Email action buttons.
 *
 * Extracted from ExecutiveReportCard for reuse and cleaner separation.
 * PDF and Email remain scaffolded with "Coming Soon" tooltips.
 */

import { useState } from 'react'
import { Copy, Check, Download, Mail, Eye } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { useToast } from './toast-provider'
import { copyToClipboard, formatReportAsText, type ReportPayload } from '@/lib/dashboard/report-export'

interface ReportDeliveryActionsProps {
  payload: ReportPayload | null
  /** Show the preview button linking to the report preview API */
  showPreview?: boolean
  previewUrl?: string
}

export function ReportDeliveryActions({
  payload,
  showPreview = false,
  previewUrl,
}: ReportDeliveryActionsProps) {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  async function handleCopy() {
    if (!payload) return
    const text = formatReportAsText(payload)
    const ok = await copyToClipboard(text)
    if (ok) {
      toast({ type: 'success', message: 'Executive report copied to clipboard' })
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } else {
      toast({ type: 'error', message: 'Failed to copy — please try again' })
    }
  }

  const disabled = !payload

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {/* Copy report */}
      <button
        onClick={handleCopy}
        disabled={disabled}
        className="flex items-center gap-1.5 rounded-md border border-[var(--brand-border)] px-2.5 py-1.5 text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-border)]/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
        {copied ? 'Copied' : 'Copy'}
      </button>

      <TooltipProvider>
        {/* Preview (optional — dev-safe) */}
        {showPreview && previewUrl && (
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-md border border-[var(--brand-border)] px-2 py-1.5 text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-border)]/40 transition-colors"
              >
                <Eye className="h-3 w-3" />
                <span className="hidden sm:inline">Preview</span>
              </a>
            </TooltipTrigger>
            <TooltipContent>View report data as JSON</TooltipContent>
          </Tooltip>
        )}

        {/* PDF export — scaffolded */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              disabled
              className="flex items-center gap-1 rounded-md border border-[var(--brand-border)] px-2 py-1.5 text-xs text-[var(--brand-muted)] opacity-50 cursor-not-allowed"
            >
              <Download className="h-3 w-3" />
              <span className="hidden sm:inline">PDF</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>Export PDF — Coming Soon</TooltipContent>
        </Tooltip>

        {/* Email report — scaffolded */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              disabled
              className="flex items-center gap-1 rounded-md border border-[var(--brand-border)] px-2 py-1.5 text-xs text-[var(--brand-muted)] opacity-50 cursor-not-allowed"
            >
              <Mail className="h-3 w-3" />
              <span className="hidden sm:inline">Email</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>Email report — Coming Soon</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
