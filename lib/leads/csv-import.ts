/**
 * CSV import parser for outbound_db mode.
 *
 * Parses a CSV string of contacts (name, phone, email, etc.) and writes
 * them into call_logs with lead_source='csv_upload'. Gracefully handles
 * malformed rows without crashing — errors are collected and returned.
 *
 * Required CSV columns: phone (at minimum)
 * Optional columns: name, email, tags, notes, potential_revenue
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'

export interface CsvImportResult {
  totalRows: number
  imported: number
  duplicates: number
  errors: Array<{ row: number; reason: string }>
}

interface ParsedContact {
  name: string | null
  phone: string
  email: string | null
  tags: string[]
  notes: string | null
  potential_revenue: number
}

/**
 * Parse CSV text into validated contact rows.
 * Returns parsed contacts + per-row errors for invalid rows.
 */
function parseCsv(csvText: string): {
  contacts: Array<{ rowNum: number; contact: ParsedContact }>
  errors: Array<{ row: number; reason: string }>
} {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length < 2) {
    return { contacts: [], errors: [{ row: 0, reason: 'CSV must have a header row and at least one data row' }] }
  }

  // Parse header — normalize to lowercase, trim whitespace
  const headerLine = lines[0]
  const headers = splitCsvRow(headerLine).map((h) => h.toLowerCase().trim())

  const phoneIdx = headers.findIndex((h) => h === 'phone' || h === 'phone_number' || h === 'phonenumber')
  if (phoneIdx === -1) {
    return { contacts: [], errors: [{ row: 0, reason: 'CSV must have a "phone" or "phone_number" column' }] }
  }

  const nameIdx = headers.findIndex((h) => h === 'name' || h === 'full_name' || h === 'fullname')
  const emailIdx = headers.findIndex((h) => h === 'email' || h === 'email_address')
  const tagsIdx = headers.findIndex((h) => h === 'tags')
  const notesIdx = headers.findIndex((h) => h === 'notes' || h === 'note')
  const revenueIdx = headers.findIndex((h) => h === 'potential_revenue' || h === 'revenue' || h === 'value')

  const contacts: Array<{ rowNum: number; contact: ParsedContact }> = []
  const errors: Array<{ row: number; reason: string }> = []

  for (let i = 1; i < lines.length; i++) {
    try {
      const cols = splitCsvRow(lines[i])

      const phone = normalizePhone(cols[phoneIdx] ?? '')
      if (!phone) {
        errors.push({ row: i + 1, reason: 'Missing or invalid phone number' })
        continue
      }

      const revenueStr = revenueIdx >= 0 ? (cols[revenueIdx] ?? '').trim() : ''
      const potential_revenue = revenueStr ? Math.round(parseFloat(revenueStr.replace(/[$,]/g, '')) || 0) : 0

      contacts.push({
        rowNum: i + 1,
        contact: {
          name: nameIdx >= 0 ? (cols[nameIdx]?.trim() || null) : null,
          phone,
          email: emailIdx >= 0 ? (cols[emailIdx]?.trim() || null) : null,
          tags: tagsIdx >= 0 ? (cols[tagsIdx] ?? '').split(';').map((t) => t.trim()).filter(Boolean) : [],
          notes: notesIdx >= 0 ? (cols[notesIdx]?.trim() || null) : null,
          potential_revenue,
        },
      })
    } catch {
      errors.push({ row: i + 1, reason: 'Failed to parse row' })
    }
  }

  return { contacts, errors }
}

/**
 * Split a CSV row respecting quoted fields (handles commas inside quotes).
 */
function splitCsvRow(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++ // skip escaped quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)

  return result.map((s) => s.trim())
}

/**
 * Normalize phone to digits-only (with optional leading +).
 * Returns null if too short to be valid.
 */
function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[^\d+]/g, '')
  if (cleaned.replace(/\D/g, '').length < 7) return null
  return cleaned
}

/**
 * Import contacts from a CSV string into call_logs for a given tenant.
 *
 * - Deduplicates by caller_phone within the tenant (skips existing phone numbers).
 * - Creates call_logs rows with direction='outbound', lead_source='csv_upload',
 *   call_type='other', and status fields for the outbound pipeline.
 */
export async function importLeadsFromCsv(
  clientId: string,
  csvText: string,
): Promise<CsvImportResult> {
  const { contacts, errors } = parseCsv(csvText)

  if (contacts.length === 0) {
    return {
      totalRows: 0,
      imported: 0,
      duplicates: 0,
      errors: errors.length > 0 ? errors : [{ row: 0, reason: 'No valid contacts found in CSV' }],
    }
  }

  const supabase = createSupabaseServerClient()

  // Fetch existing phone numbers for this tenant to deduplicate
  const phones = contacts.map((c) => c.contact.phone)
  const { data: existing } = await supabase
    .from('call_logs')
    .select('caller_phone')
    .eq('client_id', clientId)
    .in('caller_phone', phones)

  const existingPhones = new Set((existing ?? []).map((r) => r.caller_phone))

  const toInsert: Array<Record<string, unknown>> = []
  let duplicates = 0

  const now = new Date().toISOString()

  for (const { contact } of contacts) {
    if (existingPhones.has(contact.phone)) {
      duplicates++
      continue
    }

    // Mark as seen to catch intra-CSV duplicates
    existingPhones.add(contact.phone)

    toInsert.push({
      client_id: clientId,
      caller_name: contact.name,
      caller_phone: contact.phone,
      direction: 'outbound',
      lead_source: 'csv_upload',
      call_type: 'other',
      is_booked: false,
      is_lead: true,
      potential_revenue: contact.potential_revenue,
      booked_value: 0,
      inquiries_value: 0,
      duration_seconds: 0,
      human_followup_needed: false,
      tags: contact.tags,
      summary: contact.notes,
      created_at: now,
      updated_at: now,
    })
  }

  if (toInsert.length === 0) {
    return {
      totalRows: contacts.length,
      imported: 0,
      duplicates,
      errors,
    }
  }

  // Batch insert (Supabase handles up to ~1000 rows per request)
  const BATCH_SIZE = 500
  let imported = 0

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('call_logs').insert(batch)

    if (error) {
      errors.push({
        row: 0,
        reason: `Batch insert failed (rows ${i + 1}–${i + batch.length}): ${error.message}`,
      })
    } else {
      imported += batch.length
    }
  }

  return {
    totalRows: contacts.length,
    imported,
    duplicates,
    errors,
  }
}
