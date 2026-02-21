/**
 * Recommended Actions — deterministic rules engine.
 *
 * Analyzes tenant data gaps and operational state to suggest
 * next-best-actions for the operator. Max 5 shown, prioritized
 * by impact.
 */

import type { CallLog } from '@/types/database'
import type { ClientService, ClientIntegration, CrmDeliveryLog } from '@/lib/types/domain'

export interface RecommendedAction {
  id: string
  title: string
  description: string
  href: string
  priority: number // lower = higher priority
}

export function deriveRecommendedActions({
  callLogs,
  services,
  integrations,
  deliveryLogs,
  aliasCount,
}: {
  callLogs: CallLog[]
  services: ClientService[]
  integrations: ClientIntegration[]
  deliveryLogs: CrmDeliveryLog[]
  aliasCount: number
}): RecommendedAction[] {
  const actions: RecommendedAction[] = []

  // 1. No services configured
  if (services.length === 0) {
    actions.push({
      id: 'add-services',
      title: 'Add your services',
      description: 'Configure services and pricing to enable revenue attribution and per-service performance tracking.',
      href: '/dashboard/settings',
      priority: 1,
    })
  }

  // 2. Unmatched bookings suggest adding aliases
  if (services.length > 0) {
    const booked = callLogs.filter((c) => c.is_booked)
    const searchText = (log: CallLog) =>
      [log.semantic_title ?? '', log.summary ?? '', log.ai_summary ?? '', (log.tags ?? []).join(' ')].join(' ').toLowerCase()

    let unmatched = 0
    for (const log of booked) {
      const text = searchText(log)
      const matched = services.some(
        (s) => s.isActive && text.includes(s.name.toLowerCase().trim()),
      )
      if (!matched) unmatched++
    }

    if (unmatched > 0 && aliasCount < 3) {
      actions.push({
        id: 'add-aliases',
        title: 'Add service aliases',
        description: `${unmatched} booked call${unmatched !== 1 ? 's' : ''} couldn't be matched to a service. Add aliases to improve attribution.`,
        href: '/dashboard/settings',
        priority: 2,
      })
    }
  }

  // 3. No integrations configured
  if (integrations.length === 0 && callLogs.length > 0) {
    actions.push({
      id: 'connect-integration',
      title: 'Connect a CRM integration',
      description: 'Set up a webhook to automatically sync call data with your CRM or booking system.',
      href: '/dashboard/integrations',
      priority: 3,
    })
  }

  // 4. Failed deliveries need review
  const now = Date.now()
  const sevenDaysAgo = now - 7 * 86_400_000
  const recentFailed = deliveryLogs.filter(
    (l) => !l.success && Date.parse(l.createdAt) >= sevenDaysAgo,
  )
  if (recentFailed.length > 0) {
    actions.push({
      id: 'review-deliveries',
      title: 'Review failed deliveries',
      description: `${recentFailed.length} CRM deliveries failed this week. Check integration settings.`,
      href: '/dashboard/integrations',
      priority: 4,
    })
  }

  // 5. Review ROI reports
  if (callLogs.length >= 20 && services.length > 0) {
    actions.push({
      id: 'review-roi',
      title: 'Review your ROI report',
      description: 'You have enough data for meaningful insights. Check your revenue attribution and booking proof.',
      href: '/dashboard/reports',
      priority: 5,
    })
  }

  // Sort by priority, limit to 5
  return actions.sort((a, b) => a.priority - b.priority).slice(0, 5)
}
