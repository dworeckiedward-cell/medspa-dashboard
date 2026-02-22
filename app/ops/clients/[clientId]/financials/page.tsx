/**
 * /ops/clients/[clientId]/financials
 *
 * Ops-only client financial detail page.
 * Shows commercial snapshot, setup fee, retainer, payment ledger,
 * and edit/add actions.
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { logOperatorAction } from '@/lib/ops/audit'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getClientCacRow } from '@/lib/ops/unit-economics/query'
import { buildClientUnitEconomics } from '@/lib/ops/unit-economics/calc'
import { getClientCommercialDetail } from '@/lib/ops-financials/query'
import type { Client } from '@/types/database'
import { ClientFinancialDetailView } from './client-financial-detail-view'

export const dynamic = 'force-dynamic'

export default async function ClientFinancialsPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const access = await resolveOperatorAccess()
  if (!access.authorized) redirect('/login')

  const { clientId } = await params
  if (!clientId) redirect('/ops')

  // Fetch client
  const supabase = createSupabaseServerClient()
  const { data: clientData, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .maybeSingle()

  if (clientError || !clientData) {
    return (
      <div className="min-h-screen bg-[var(--brand-bg)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-[var(--brand-muted)]">Client not found</p>
          <Link href="/ops" className="text-xs text-[var(--brand-primary)] hover:underline mt-2 inline-block">
            Back to Ops Console
          </Link>
        </div>
      </div>
    )
  }

  const client = clientData as unknown as Client

  // Build unit economics + commercial detail
  const cacRow = await getClientCacRow(clientId)
  const unitEcon = buildClientUnitEconomics(client, cacRow)
  const detail = await getClientCommercialDetail(client, unitEcon)

  // Audit log
  await logOperatorAction({
    operatorId: access.userId ?? 'unknown',
    operatorEmail: access.email,
    action: 'client_financial_detail_viewed',
    targetClientId: clientId,
    targetClientSlug: client.slug,
  })

  return (
    <div className="min-h-screen bg-[var(--brand-bg)]">
      {/* Header */}
      <header className="border-b border-[var(--brand-border)] bg-[var(--brand-surface)] px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link
            href="/ops"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--brand-border)] text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:border-[var(--brand-text)]/20 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white text-sm font-bold"
              style={{ background: client.brand_color ?? '#2563EB' }}
            >
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-base font-semibold text-[var(--brand-text)]">
                {client.name}
              </h1>
              <div className="flex items-center gap-2">
                <p className="text-xs text-[var(--brand-muted)]">{client.slug}</p>
                <span className="text-[10px] rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 font-medium">
                  Ops Only
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <ClientFinancialDetailView
          clientId={clientId}
          clientName={client.name}
          snapshot={detail.snapshot}
          profile={detail.profile}
          payments={detail.payments}
        />
      </div>
    </div>
  )
}
