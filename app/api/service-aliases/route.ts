/**
 * GET/POST /api/service-aliases
 *
 * Tenant-scoped service alias CRUD.
 * GET:  list all aliases for the current tenant
 * POST: create a new alias
 */

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { listServiceAliases } from '@/lib/dashboard/service-alias-query'
import { createServiceAlias } from '@/lib/dashboard/service-alias-mutations'
import { apiUnauthorized, apiBadRequest } from '@/lib/api-utils'
import { log } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const CreateSchema = z.object({
  aliasText: z.string().min(1).max(200),
  serviceId: z.string().uuid(),
  priority: z.number().int().min(0).max(1000).optional(),
})

export async function GET() {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) return apiUnauthorized()

  const aliases = await listServiceAliases(tenant.id)
  log.info('service-aliases.list', { tenantId: tenant.id, count: aliases.length })
  return Response.json({ aliases })
}

export async function POST(request: NextRequest) {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) return apiUnauthorized()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiBadRequest('Invalid JSON body')
  }

  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return apiBadRequest('Invalid request body', parsed.error.flatten().fieldErrors)
  }

  const alias = await createServiceAlias(tenant.id, parsed.data)
  if (!alias) {
    return apiBadRequest('Failed to create alias (duplicate or invalid service)')
  }

  log.info('service-aliases.create', { tenantId: tenant.id, alias: parsed.data.aliasText })
  return Response.json({ alias }, { status: 201 })
}
