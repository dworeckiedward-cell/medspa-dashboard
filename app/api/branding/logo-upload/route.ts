/**
 * /api/branding/logo-upload — POST upload a logo image file.
 *
 * Tenant-scoped via resolveTenantAccess().
 * Uploads to Supabase Storage (bucket: branding-assets), then
 * persists the public URL to clients.logo_url.
 *
 * ── Storage bucket requirement ──────────────────────────────────────────
 *
 * Requires a Supabase Storage bucket named `branding-assets` with:
 *   - Public access enabled (for logo display)
 *   - Max file size: 2 MB
 *   - Allowed MIME types: image/png, image/jpeg, image/webp, image/svg+xml
 *
 * If the bucket does not exist, this route returns a clear error message
 * instead of crashing the settings page.
 */

import { NextResponse } from 'next/server'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { updateClientLogoUrl } from '@/lib/dashboard/branding-mutations'

export const dynamic = 'force-dynamic'

const BUCKET_NAME = 'branding-assets'
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2 MB
const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
])

export async function POST(request: Request) {
  // ── Tenant guard ────────────────────────────────────────────────────────
  const { tenant } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse multipart form ────────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // ── Validate file ──────────────────────────────────────────────────────
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Unsupported file type. Use PNG, JPG, WebP, or SVG.' },
      { status: 400 },
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File is too large. Maximum size is 2 MB.' },
      { status: 400 },
    )
  }

  // ── Upload to Supabase Storage ─────────────────────────────────────────
  const supabase = createSupabaseServerClient()

  // Generate tenant-safe path
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const timestamp = Date.now()
  const storagePath = `logos/${tenant.id}/logo-${timestamp}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const fileBuffer = new Uint8Array(arrayBuffer)

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, fileBuffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    console.error('[branding] logo upload error:', uploadError.message)

    // Detect missing bucket
    if (
      uploadError.message.includes('Bucket not found') ||
      uploadError.message.includes('not found')
    ) {
      return NextResponse.json(
        {
          error:
            'Storage bucket not configured. Please create a Supabase Storage bucket named "branding-assets" with public access.',
        },
        { status: 503 },
      )
    }

    return NextResponse.json(
      { error: `Upload failed: ${uploadError.message}` },
      { status: 500 },
    )
  }

  // ── Get public URL ────────────────────────────────────────────────────
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(storagePath)

  const publicUrl = urlData?.publicUrl
  if (!publicUrl) {
    return NextResponse.json(
      { error: 'Upload succeeded but could not generate public URL' },
      { status: 500 },
    )
  }

  // ── Persist to clients.logo_url ───────────────────────────────────────
  const result = await updateClientLogoUrl(tenant.id, publicUrl)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? 'Failed to save logo URL' },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true, logoUrl: publicUrl })
}
