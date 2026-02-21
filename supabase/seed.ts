/**
 * Seed script — run with: npm run db:seed
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *
 * This is a convenience wrapper. The canonical seed is in seed.sql.
 * This script reads seed.sql and executes it via Supabase's rpc or REST.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load env manually (tsx doesn't auto-load .env.local)
const envFile = join(process.cwd(), '.env.local')
try {
  const envContent = readFileSync(envFile, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
} catch {
  console.log('No .env.local found — using existing environment variables')
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.error('    Create .env.local with these values and try again.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function seed() {
  console.log('🌱  Seeding demo tenants...\n')

  const clients = [
    {
      id: 'a1000000-0000-0000-0000-000000000001',
      name: 'Luxe Aesthetics',
      slug: 'luxe',
      subdomain: 'luxe',
      brand_color: '#0EA5E9',
      accent_color: '#8B5CF6',
      theme_mode: 'dark',
      retell_agent_id: 'agent_luxe_001',
      retell_phone_number: '+13055550101',
      n8n_webhook_url: 'https://n8n.yourcompany.com/webhook/luxe-medspa',
      stripe_customer_id: 'cus_luxe_stripe_001',
      stripe_subscription_id: 'sub_luxe_stripe_001',
      retainer_expiry: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
      timezone: 'America/New_York',
      currency: 'USD',
      is_active: true,
    },
    {
      id: 'a2000000-0000-0000-0000-000000000002',
      name: 'Miami Glow MedSpa',
      slug: 'miami',
      subdomain: 'miami',
      brand_color: '#F59E0B',
      accent_color: '#EC4899',
      theme_mode: 'dark',
      retell_agent_id: 'agent_miami_002',
      retell_phone_number: '+13055550202',
      n8n_webhook_url: 'https://n8n.yourcompany.com/webhook/miami-glow',
      stripe_customer_id: 'cus_miami_stripe_002',
      stripe_subscription_id: 'sub_miami_stripe_002',
      retainer_expiry: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
      timezone: 'America/New_York',
      currency: 'USD',
      is_active: true,
    },
  ]

  for (const client of clients) {
    const { error } = await supabase
      .from('clients')
      .upsert(client, { onConflict: 'slug' })

    if (error) {
      console.error(`❌  Failed to upsert client ${client.slug}:`, error.message)
    } else {
      console.log(`✅  Client: ${client.name} (${client.slug})`)
    }
  }

  console.log('\n📋  Inserting call logs...')
  console.log('    For full call log seed, run supabase/seed.sql in Supabase SQL Editor.')
  console.log('    (TypeScript seed contains clients + services only for brevity)\n')

  const services = [
    { client_id: 'a1000000-0000-0000-0000-000000000001', service_name: 'Botox', aliases: ['tox', 'neurotoxin'], price_min: 300, price_max: 800, avg_price: 550 },
    { client_id: 'a1000000-0000-0000-0000-000000000001', service_name: 'Lip Filler', aliases: ['lip augmentation'], price_min: 650, price_max: 1200, avg_price: 850 },
    { client_id: 'a1000000-0000-0000-0000-000000000001', service_name: 'Laser Resurfacing', aliases: ['laser', 'fraxel'], price_min: 400, price_max: 1500, avg_price: 900 },
    { client_id: 'a2000000-0000-0000-0000-000000000002', service_name: 'Botox', aliases: ['tox', 'dysport'], price_min: 350, price_max: 750, avg_price: 500 },
    { client_id: 'a2000000-0000-0000-0000-000000000002', service_name: 'Juvederm Filler', aliases: ['filler', 'dermal filler'], price_min: 700, price_max: 1400, avg_price: 1000 },
  ]

  for (const service of services) {
    const { error } = await supabase.from('services_catalog').upsert(service, { onConflict: 'id' })
    if (error) console.error(`  ❌  ${service.service_name}:`, error.message)
    else console.log(`  ✅  Service: ${service.service_name} (${service.client_id.slice(0, 8)}...)`)
  }

  console.log('\n✨  Seed complete!')
  console.log('\nNext steps:')
  console.log('  1. Run seed.sql in Supabase SQL Editor for full call log demo data')
  console.log('  2. Start dev: npm run dev')
  console.log('  3. Visit: http://luxe.lvh.me:3000/dashboard')
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
