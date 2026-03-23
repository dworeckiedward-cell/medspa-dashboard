import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { JaneClient } from '@/lib/jane/client'

/**
 * GET /api/book/live-younger/availability?serviceId=X&date=YYYY-MM-DD
 *
 * Returns available time slots for a service on a given date.
 * Uses Jane API when JANE_API_ENABLED=true, otherwise falls back to static schedule.
 */
export async function GET(request: NextRequest) {
  const serviceId = request.nextUrl.searchParams.get('serviceId')
  const date = request.nextUrl.searchParams.get('date')

  if (!serviceId || !date) {
    return NextResponse.json({ error: 'serviceId and date required' }, { status: 400 })
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()

  // Get service + tenant
  const { data: service } = await supabase
    .from('tenant_services')
    .select('id, tenant_id, practitioners, jane_treatment_id')
    .eq('id', serviceId)
    .maybeSingle()

  if (!service) {
    return NextResponse.json({ error: 'Service not found' }, { status: 404 })
  }

  const jane = new JaneClient(service.tenant_id)
  const slots = await jane.getAvailability(
    service.jane_treatment_id ?? serviceId,
    date,
    service.practitioners ?? [],
  )

  return NextResponse.json(
    { slots, date, serviceId },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    },
  )
}
