import { Globe, Zap, Calendar, Phone as PhoneIcon, Shield } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { maskString, daysUntil } from '@/lib/utils'
import type { Client } from '@/types/database'

interface TenantInfoCardProps {
  tenant: Client
}

export function TenantInfoCard({ tenant }: TenantInfoCardProps) {
  const days = daysUntil(tenant.retainer_expiry)
  const expiryBadge = (() => {
    if (days === null) return null
    if (days < 0) return { label: 'Expired', variant: 'destructive' as const }
    if (days <= 7) return { label: `${days}d left`, variant: 'destructive' as const }
    if (days <= 30) return { label: `${days}d left`, variant: 'warning' as const }
    return { label: `${days}d left`, variant: 'success' as const }
  })()

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'yourdomain.com'

  const rows = [
    {
      icon: Globe,
      label: 'Domain',
      value: tenant.custom_domain || `${tenant.subdomain || tenant.slug}.${appDomain}`,
    },
    {
      icon: PhoneIcon,
      label: 'Retell Phone',
      value: tenant.retell_phone_number || '—',
    },
    {
      icon: Shield,
      label: 'Agent ID',
      value: maskString(tenant.retell_agent_id, 6),
    },
    {
      icon: Zap,
      label: 'n8n Webhook',
      value: tenant.n8n_webhook_url ? 'Connected' : 'Not configured',
      badge: tenant.n8n_webhook_url
        ? { label: 'Active', variant: 'success' as const }
        : { label: 'Setup needed', variant: 'muted' as const },
    },
  ]

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Integration Status</CardTitle>
        <CardDescription>Tenant: {tenant.slug}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {rows.map((row) => {
          const Icon = row.icon
          return (
            <div
              key={row.label}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)]/40 px-3 py-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className="h-3.5 w-3.5 text-[var(--brand-muted)] shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-[var(--brand-muted)] leading-none mb-0.5">{row.label}</p>
                  <p className="text-xs font-medium text-[var(--brand-text)] truncate">{row.value}</p>
                </div>
              </div>
              {row.badge && (
                <Badge variant={row.badge.variant} className="text-[10px] shrink-0">
                  {row.badge.label}
                </Badge>
              )}
            </div>
          )
        })}

        {/* Retainer expiry block */}
        {tenant.retainer_expiry && (
          <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)]/40 px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <Calendar className="h-3.5 w-3.5 text-[var(--brand-muted)] shrink-0" />
              <div>
                <p className="text-xs text-[var(--brand-muted)] leading-none mb-0.5">Retainer Expiry</p>
                <p className="text-xs font-medium text-[var(--brand-text)]">
                  {new Date(tenant.retainer_expiry).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <div className="ml-auto">
                {expiryBadge && (
                  <Badge variant={expiryBadge.variant} className="text-[10px]">
                    {expiryBadge.label}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
