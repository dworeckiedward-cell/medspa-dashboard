import { NextResponse } from 'next/server'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * GET /api/dashboard-data
 *
 * Server-side data fetch for the dashboard cache.
 * Uses service-role client (bypasses RLS) so the browser can't access
 * the tables directly with the anon key.
 *
 * Returns: { calls: CallLog[], bookings: BookingRow[] }
 */
export async function GET() {
  try {
    const { tenant } = await resolveTenantAccess()
    if (!tenant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSupabaseServerClient()

    const [callsRes, bookingsRes] = await Promise.all([
      supabase
        .from('call_logs')
        .select('*')
        .eq('client_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .from('bookings')
        .select(
          'id, patient_name, patient_phone, patient_email, appointment_date, appointment_time, practitioner_name, duration_minutes, amount_cents, currency, payment_status, status, source, created_at, patient_notes, call_log_id, stripe_payment_method_id, no_show_charged, tenant_services(name)',
        )
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(200),
    ])

    if (callsRes.error) {
      console.error('[dashboard-data] calls error:', callsRes.error.message)
    }
    if (bookingsRes.error) {
      console.error('[dashboard-data] bookings error:', bookingsRes.error.message)
    }

    return NextResponse.json({
      calls: callsRes.data ?? [],
      bookings: bookingsRes.data ?? [],
    })
  } catch (err) {
    console.error('[dashboard-data] unexpected error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
