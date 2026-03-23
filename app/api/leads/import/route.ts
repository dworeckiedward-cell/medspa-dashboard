/**
 * POST /api/leads/import — CSV upload for outbound_db lead import.
 *
 * Accepts either:
 *   - multipart/form-data with a "file" field (CSV file upload)
 *   - application/json with a "csv" field (raw CSV text)
 *
 * Tenant resolved from middleware headers (x-tenant-slug).
 * Returns import results: total, imported, duplicates, errors.
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { importLeadsFromCsv } from '@/lib/leads/csv-import'

const MAX_CSV_SIZE = 5 * 1024 * 1024 // 5 MB

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  // ── Wallet guardrail — reject if no pre-paid seconds remain ────────────
  if ((tenant.available_seconds ?? 0) <= 0) {
    return NextResponse.json(
      { error: 'Insufficient balance. Please top up your account before importing new leads.' },
      { status: 402 },
    )
  }

  let csvText: string

  const contentType = req.headers.get('content-type') ?? ''

  try {
    if (contentType.includes('multipart/form-data')) {
      // ── File upload path ────────────────────────────────────────────────
      const formData = await req.formData()
      const file = formData.get('file')

      if (!file || !(file instanceof File)) {
        return NextResponse.json(
          { error: 'Missing "file" field in form data. Upload a CSV file.' },
          { status: 400 },
        )
      }

      if (file.size > MAX_CSV_SIZE) {
        return NextResponse.json(
          { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 5 MB.` },
          { status: 413 },
        )
      }

      csvText = await file.text()
    } else if (contentType.includes('application/json')) {
      // ── Raw JSON path ───────────────────────────────────────────────────
      const body = await req.json()

      if (typeof body.csv !== 'string' || body.csv.trim().length === 0) {
        return NextResponse.json(
          { error: 'Missing "csv" field in JSON body. Provide raw CSV text.' },
          { status: 400 },
        )
      }

      if (body.csv.length > MAX_CSV_SIZE) {
        return NextResponse.json(
          { error: 'CSV text too large. Max 5 MB.' },
          { status: 413 },
        )
      }

      csvText = body.csv
    } else {
      return NextResponse.json(
        { error: 'Unsupported Content-Type. Use multipart/form-data or application/json.' },
        { status: 415 },
      )
    }
  } catch {
    return NextResponse.json(
      { error: 'Failed to read request body.' },
      { status: 400 },
    )
  }

  // ── Import ────────────────────────────────────────────────────────────────

  const result = await importLeadsFromCsv(tenant.id, csvText)

  const status = result.imported > 0 ? 201 : result.errors.length > 0 ? 207 : 200

  return NextResponse.json(result, { status })
}
