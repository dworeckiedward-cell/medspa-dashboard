import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { BookingCategory, BookingService } from './types'

/**
 * Fetch all active service categories + services for a tenant's booking page.
 */
export async function getBookingCatalog(tenantSlug: string): Promise<{
  tenantId: string
  tenantName: string
  categories: BookingCategory[]
} | null> {
  const supabase = createSupabaseServerClient()

  // Resolve tenant (try 'tenants' first, fall back to 'clients' for legacy schemas)
  let tenant: { id: string; name: string } | null = null

  const { data: t1 } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('slug', tenantSlug)
    .eq('is_active', true)
    .maybeSingle()
  tenant = t1

  if (!tenant) {
    const { data: t2 } = await supabase
      .from('clients')
      .select('id, name')
      .eq('slug', tenantSlug)
      .eq('is_active', true)
      .maybeSingle()
    tenant = t2
  }

  if (!tenant) return null

  // Fetch categories
  const { data: cats } = await supabase
    .from('tenant_service_categories')
    .select('id, name, description, sort_order')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('sort_order')

  if (!cats) return { tenantId: tenant.id, tenantName: tenant.name, categories: [] }

  // Fetch services
  const { data: services } = await supabase
    .from('tenant_services')
    .select('id, category_id, name, description, duration_minutes, price_cents, currency, practitioners, sort_order, price_varies')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('sort_order')

  // Group services by category
  const servicesByCategory = new Map<string, BookingService[]>()
  for (const s of (services ?? [])) {
    const list = servicesByCategory.get(s.category_id) ?? []
    list.push({
      id: s.id,
      categoryId: s.category_id,
      categoryName: '', // filled below
      name: s.name,
      description: s.description,
      durationMinutes: s.duration_minutes,
      priceCents: s.price_cents,
      currency: s.currency,
      practitioners: s.practitioners ?? [],
      priceVaries: s.price_varies ?? false,
      sortOrder: s.sort_order,
    })
    servicesByCategory.set(s.category_id, list)
  }

  const categories: BookingCategory[] = cats.map(c => {
    const catServices = servicesByCategory.get(c.id) ?? []
    catServices.forEach(s => { s.categoryName = c.name })
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      sortOrder: c.sort_order,
      services: catServices,
    }
  }).filter(c => c.services.length > 0)

  return { tenantId: tenant.id, tenantName: tenant.name, categories }
}

/**
 * Get a single booking by ID for the confirmation page.
 */
export async function getBookingById(bookingId: string) {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase
    .from('bookings')
    .select('*, tenant_services(name, duration_minutes)')
    .eq('id', bookingId)
    .maybeSingle()
  return data
}
