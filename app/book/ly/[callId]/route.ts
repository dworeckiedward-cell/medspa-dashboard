import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * GET /book/ly/[callId]?to=<jane_url>
 *
 * SMS booking link handler. When a patient clicks the booking link sent via SMS:
 * 1. Updates the call_log's lead_status to 'clicked_link'
 * 2. 302 redirects to the Jane booking URL from ?to= param
 *
 * This is a public endpoint (no auth) — accessed by patients via SMS link.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { callId: string } },
) {
  const { callId } = params
  const toUrl = req.nextUrl.searchParams.get('to')

  // Fallback if no destination URL provided
  const fallback = 'https://liveyounger.janeapp.com'
  const destination = toUrl && isValidJaneUrl(toUrl) ? toUrl : fallback

  // Fire-and-forget: update lead status (don't block redirect on DB failure)
  updateLeadStatus(callId).catch((err) => {
    console.error('[book/ly] Failed to update lead status:', err)
  })

  return NextResponse.redirect(destination, { status: 302 })
}

async function updateLeadStatus(callId: string): Promise<void> {
  const supabase = createSupabaseServerClient()

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('call_logs')
    .update({
      lead_status: 'clicked_link',
      booking_link_clicked_at: now,
      updated_at: now,
    })
    .eq('id', callId)

  if (error) {
    console.error('[book/ly] DB update error:', error.message)
  } else {
    console.log('[book/ly] lead_status → clicked_link for call:', callId)
  }
}

/** Only allow redirects to Jane / known booking URLs */
function isValidJaneUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      parsed.hostname.endsWith('.janeapp.com') ||
      parsed.hostname.endsWith('.janeapp.ca') ||
      parsed.hostname === 'liveyounger.janeapp.com'
    )
  } catch {
    return false
  }
}
