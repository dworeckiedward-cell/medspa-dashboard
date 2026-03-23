import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'

/**
 * GET /api/cron/daily-report
 *
 * Runs daily at 14:00 UTC (8:00 AM MDT / 7:00 AM MST) via Vercel Cron.
 * Sends a daily summary email to info@liveyounger.ca via Resend.
 */

const LIVE_YOUNGER_TENANT_ID = 'f318ff09-2094-4f7f-b617-28aece908ed5'
const REPORT_TO = 'info@liveyounger.ca'
const REPORT_FROM = 'Servify AI <reports@servifylabs.com>'
const DASHBOARD_URL = 'https://app.servifylabs.com'

export async function GET(req: NextRequest) {
  // Verify request is from Vercel Cron (or internal)
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const yesterday = subDays(new Date(), 1)
  const dayStart = startOfDay(yesterday).toISOString()
  const dayEnd = endOfDay(yesterday).toISOString()
  const dayLabel = format(yesterday, 'EEEE, MMMM d, yyyy')

  const supabase = createSupabaseServerClient()

  // Fetch yesterday's call logs
  const { data: callLogs } = await supabase
    .from('call_logs')
    .select('id, is_lead, is_booked, potential_revenue, booked_value, lead_source, intent')
    .eq('client_id', LIVE_YOUNGER_TENANT_ID)
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd)

  // Fetch yesterday's bookings (payment confirmed)
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, amount_cents, payment_status, source')
    .eq('tenant_id', LIVE_YOUNGER_TENANT_ID)
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd)

  const logs = callLogs ?? []
  const bks = bookings ?? []

  const callsHandled = logs.length
  const newLeads = logs.filter((l) => l.is_lead).length
  const bookingsMade = logs.filter((l) => l.is_booked).length + bks.filter((b) => b.source === 'ai_booking_page').length
  const revenueCollected = bks
    .filter((b) => b.payment_status === 'paid')
    .reduce((sum, b) => sum + (b.amount_cents ?? 0), 0) / 100

  // Top campaigns (group by lead_source)
  const sourceCounts: Record<string, number> = {}
  for (const log of logs) {
    if (log.lead_source) {
      sourceCounts[log.lead_source] = (sourceCounts[log.lead_source] ?? 0) + 1
    }
  }
  const topCampaigns = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([src, count]) => `${src}: ${count}`)

  const campaignsText = topCampaigns.length > 0
    ? topCampaigns.map((c) => `• ${c}`).join('\n')
    : '• No campaign data'

  const subject = `📊 Live Younger AI — Daily Report (${format(yesterday, 'MMM d')})`

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 32px;">
  <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden;">

    <div style="background: #0D9488; padding: 24px 32px;">
      <p style="margin: 0; color: rgba(255,255,255,0.8); font-size: 12px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;">Daily Report</p>
      <h1 style="margin: 4px 0 0; color: white; font-size: 20px; font-weight: 700;">Live Younger AI</h1>
      <p style="margin: 4px 0 0; color: rgba(255,255,255,0.75); font-size: 13px;">${dayLabel}</p>
    </div>

    <div style="padding: 28px 32px;">
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
            <span style="color: #6b7280; font-size: 13px;">Calls handled</span>
          </td>
          <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">
            <span style="color: #111827; font-size: 15px; font-weight: 700;">${callsHandled}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
            <span style="color: #6b7280; font-size: 13px;">New leads</span>
          </td>
          <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">
            <span style="color: #111827; font-size: 15px; font-weight: 700;">${newLeads}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
            <span style="color: #6b7280; font-size: 13px;">Bookings made</span>
          </td>
          <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">
            <span style="color: #111827; font-size: 15px; font-weight: 700;">${bookingsMade}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0;">
            <span style="color: #6b7280; font-size: 13px;">Revenue collected</span>
          </td>
          <td style="padding: 12px 0; text-align: right;">
            <span style="color: #059669; font-size: 16px; font-weight: 700;">$${revenueCollected.toFixed(2)}</span>
          </td>
        </tr>
      </table>

      ${topCampaigns.length > 0 ? `
      <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0 0 8px; color: #6b7280; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Top Campaigns</p>
        ${topCampaigns.map((c) => `<p style="margin: 4px 0; color: #374151; font-size: 13px;">• ${c}</p>`).join('')}
      </div>` : ''}

      <a href="${DASHBOARD_URL}" style="display: block; background: #0D9488; color: white; text-align: center; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">
        View Full Dashboard →
      </a>
    </div>

    <div style="padding: 16px 32px; border-top: 1px solid #f3f4f6; background: #f9fafb;">
      <p style="margin: 0; color: #9ca3af; font-size: 11px; text-align: center;">
        Sent by Servify AI · <a href="${DASHBOARD_URL}/dashboard/settings" style="color: #0D9488; text-decoration: none;">Manage settings</a>
      </p>
    </div>
  </div>
</body>
</html>`

  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    console.warn('[daily-report] RESEND_API_KEY not set — skipping email send')
    return NextResponse.json({ ok: true, skipped: true, stats: { callsHandled, newLeads, bookingsMade, revenueCollected } })
  }

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: REPORT_FROM,
      to: [REPORT_TO],
      subject,
      html,
    }),
  })

  if (!emailRes.ok) {
    const body = await emailRes.text()
    console.error('[daily-report] Resend error:', body)
    return NextResponse.json({ error: 'Email send failed', detail: body }, { status: 500 })
  }

  console.info(`[daily-report] Sent to ${REPORT_TO} for ${dayLabel}`, { callsHandled, newLeads, bookingsMade, revenueCollected })
  return NextResponse.json({ ok: true, stats: { callsHandled, newLeads, bookingsMade, revenueCollected } })
}
