'use client'

/**
 * AiStatusPill — lightweight indicator for Ollama reachability.
 *
 * Uses the module-singleton useAiStatus hook — one HTTP request per page load
 * shared across all components. No polling, no duplicate fetches.
 *
 * Shows "AI: Online" or "AI: Offline" with a tooltip when offline.
 * Renders nothing while the check is in flight to avoid layout shift.
 */

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useAiStatus } from '@/lib/ai/use-ai-online'

export function AiStatusPill({ className }: { className?: string }) {
  const status = useAiStatus()

  // Render nothing while the check is in flight
  if (status === null) return null

  const { ok: isOnline, reason } = status

  const pill = (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border select-none',
        isOnline
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-800/50 dark:text-emerald-400'
          : 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:border-rose-800/50 dark:text-rose-400',
        className,
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full shrink-0',
          isOnline ? 'bg-emerald-500' : 'bg-rose-500',
        )}
      />
      AI: {isOnline ? 'Online' : 'Offline'}
    </span>
  )

  if (isOnline) return pill

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{pill}</TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="max-w-[240px] text-xs">{reason}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
