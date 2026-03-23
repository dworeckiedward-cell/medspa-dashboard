import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getBookingCatalog } from '@/lib/booking/query'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { BookingPageClient } from './booking-client'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Book Your Appointment | Live Younger Medical Aesthetics',
  description: 'Book your appointment at Live Younger Medical Aesthetics in Calgary. Premium medical aesthetics, acupuncture, and wellness treatments.',
}

// Jane deep-link mapping by category param
const JANE_LINKS: Record<string, string> = {
  acupuncture:         'https://liveyounger.janeapp.com/#/discipline/2/treatment/340',
  facial_acupuncture:  'https://liveyounger.janeapp.com/#/discipline/2/treatment/340',
  skin:                'https://liveyounger.janeapp.com/#/discipline/1/treatment/2',
  pain:                'https://liveyounger.janeapp.com/#/discipline/34/treatment/335',
}

const LIVE_YOUNGER_TENANT_ID = 'f318ff09-2094-4f7f-b617-28aece908ed5'

export default async function LiveYoungerBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; ref?: string; name?: string; phone?: string; direct?: string }>
}) {
  const sp = await searchParams

  // ?direct=true → show full booking UI (for when Jane API is ready)
  if (sp.direct === 'true') {
    const catalog = await getBookingCatalog('live-younger')
    if (!catalog) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
          <p className="text-gray-500">Booking page not available.</p>
        </div>
      )
    }
    return (
      <Suspense fallback={<BookingShell />}>
        <BookingPageClient
          categories={catalog.categories}
          tenantId={catalog.tenantId}
          initialCategory={sp.category}
          initialRef={sp.ref}
          initialName={sp.name}
          initialPhone={sp.phone}
        />
      </Suspense>
    )
  }

  // Default: log lead then redirect to Jane
  const janeUrl = JANE_LINKS[sp.category ?? ''] ?? 'https://liveyounger.janeapp.com'

  // Fire-and-forget: log the visit as a lead (don't block redirect on failure)
  try {
    const supabase = createSupabaseServerClient()
    const uniqueId = `sms-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    await supabase.from('call_logs').insert({
      client_id: LIVE_YOUNGER_TENANT_ID,
      external_call_id: uniqueId,
      is_lead: true,
      caller_name: sp.name ?? null,
      caller_phone: sp.phone ?? null,
      call_type: 'lead',
      direction: 'inbound',
      lead_source: 'sms_link',
      semantic_title: sp.category
        ? `SMS link visit — ${sp.category}`
        : 'SMS link visit',
      raw_payload: {
        category: sp.category ?? null,
        ref: sp.ref ?? null,
        name: sp.name ?? null,
        phone: sp.phone ?? null,
        jane_url: janeUrl,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  } catch {
    // Silently ignore — redirect always happens
  }

  redirect(janeUrl)
}

function BookingShell() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
