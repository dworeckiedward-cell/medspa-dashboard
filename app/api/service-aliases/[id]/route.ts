/**
 * PATCH/DELETE /api/service-aliases/[id]
 *
 * Tenant-scoped service alias update/delete.
 */

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { updateServiceAlias, deleteServiceAlias } from '@/lib/dashboard/service-alias-mutations'
import { apiUnauthorized, apiBadRequest, apiNotFound } from '@/lib/api-utils'
import { log } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const UpdateSchema = z.object({
  aliasText: z.string().min(1).max(200).optional(),
  serviceId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).max(1000).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) return apiUnauthorized()

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiBadRequest('Invalid JSON body')
  }

  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return apiBadRequest('Invalid request body', parsed.error.flatten().fieldErrors)
  }

  const updated = await updateServiceAlias(tenant.id, id, parsed.data)
  if (!updated) return apiNotFound('Alias not found')

  log.info('service-aliases.update', { tenantId: tenant.id, aliasId: id })
  return Response.json({ alias: updated })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) return apiUnauthorized()

  const { id } = await params

  const ok = await deleteServiceAlias(tenant.id, id)
  if (!ok) return apiNotFound('Alias not found')

  log.info('service-aliases.delete', { tenantId: tenant.id, aliasId: id })
  return Response.json({ deleted: true })
}
