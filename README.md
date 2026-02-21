# MedSpa Dashboard — AI Receptionist White-Label Platform

A **production-grade multi-tenant white-label dashboard** for the "Sarah" AI MedSpa Receptionist SaaS.

**One codebase. New client = one row in Supabase.**

Built with: Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase · Recharts

---

## Architecture Overview

```
Request → Middleware → Root Layout → Dashboard Page
   │           │             │              │
   │     Extracts slug   Fetches full   Fetches KPIs
   │     from subdomain  tenant config  + call logs
   │     or query param  + injects      from Supabase
   │     into x-tenant-  CSS vars into  (filtered by
   │     slug header      :root          client_id)
```

**Tenant isolation:** Every DB query is filtered by `client_id` resolved from the trusted server-side tenant context — never from URL parameters.

**White-label:** CSS variables (`--brand-primary`, `--brand-accent`, etc.) are injected from the `clients` Supabase row into `:root` on every request. Changing `brand_color` in Supabase = instant rebrand. Zero code changes.

---

## 1. Local Setup

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials (see section below)

# 3. Run database migrations
# Open Supabase Dashboard → SQL Editor → paste + run:
#   supabase/migrations/001_initial_schema.sql

# 4. Seed demo data
# Option A — SQL (full 43-call demo dataset, recommended):
#   Paste supabase/seed.sql into Supabase SQL Editor and run

# Option B — TypeScript (clients + services catalog only):
npm run db:seed

# 5. Start dev server
npm run dev
```

### Required `.env.local`

```bash
# Supabase (find these at: supabase.com → Project Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # server-only, never exposed to browser

# App domain — drives subdomain extraction in middleware
# Dev: set to "lvh.me" so luxe.lvh.me:3000 works without /etc/hosts
# Prod: set to "yourdomain.com" so luxe.yourdomain.com works
NEXT_PUBLIC_APP_DOMAIN=lvh.me

# Webhook auth secret — checked by /api/retell/webhook
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
WEBHOOK_API_KEY=replace-with-a-secure-random-string

NODE_ENV=development
```

---

## 2. Subdomain Dev via `lvh.me`

`lvh.me` is a public wildcard DNS that resolves all subdomains to `127.0.0.1`. No `/etc/hosts` editing required.

```bash
# In .env.local:
NEXT_PUBLIC_APP_DOMAIN=lvh.me

# Then visit:
http://luxe.lvh.me:3000/dashboard     # Luxe Aesthetics (sky blue theme)
http://miami.lvh.me:3000/dashboard    # Miami Glow (amber theme)
```

### Alternative: query param (no DNS setup)

```
http://localhost:3000/dashboard?tenant=luxe
http://localhost:3000/dashboard?tenant=miami
```

### Alternative: request header (curl / Postman)

```bash
curl -H "x-tenant-slug: luxe" http://localhost:3000/dashboard
```

---

## 3. Seed Demo Tenants

### SQL seed (recommended — full 43-call dataset with charts)

1. Open **Supabase Dashboard → SQL Editor**
2. Paste `supabase/migrations/001_initial_schema.sql` → Run
3. Paste `supabase/seed.sql` → Run

**Demo tenants after seeding:**

| Tenant | Slug | Brand Color | Retainer |
|--------|------|-------------|----------|
| Luxe Aesthetics | `luxe` | `#0EA5E9` sky blue | 45 days |
| Miami Glow MedSpa | `miami` | `#F59E0B` amber | 12 days |

Each tenant has: 15–25 call logs (bookings, inquiries, reschedules, spam), services catalog, and realistic revenue values that populate the chart.

### TypeScript seed (clients + services only)

```bash
npm run db:seed
```

---

## 4. Test Webhook Ingestion

The `/api/retell/webhook` endpoint accepts POST from Retell or n8n and writes to `call_logs`.

### curl test

```bash
API_KEY="your-webhook-secret-from-env"  # WEBHOOK_API_KEY value

curl -X POST http://localhost:3000/api/retell/webhook \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "call_id": "retell_test_001",
    "agent_id": "agent_luxe_001",
    "from_number": "+13055559999",
    "call_duration_ms": 187000,
    "call_summary": "Patient called to book a botox touch-up for next Thursday.",
    "metadata": {
      "semantic_title": "Botox Touch-Up — Confirmed Booking",
      "caller_name": "Jane Test",
      "call_type": "booking",
      "is_booked": true,
      "is_lead": true,
      "lead_confidence": 0.95,
      "potential_revenue": 550,
      "booked_value": 550,
      "inquiries_value": 0,
      "tags": ["botox", "repeat-client"]
    }
  }'

# Expected response:
# {"success":true,"call_log_id":"...uuid..."}
```

### Tenant resolution in webhook (priority order)

1. `metadata.client_slug` — explicit slug (n8n best practice)
2. `client_slug` — top-level slug field
3. `agent_id` — matches `clients.retell_agent_id`

### n8n Setup

HTTP Request node config:
- **Method:** POST
- **URL:** `https://yourdomain.com/api/retell/webhook`
- **Headers:** `x-api-key: {{$env.WEBHOOK_API_KEY}}`
- **Auth:** Bearer token also accepted (`Authorization: Bearer <key>`)

---

## 5. Debug Tenant Resolution (dev only)

```bash
# Check what tenant resolves for current hostname
curl "http://localhost:3000/api/tenant/debug?tenant=luxe"

# With header
curl -H "x-tenant-slug: miami" http://localhost:3000/api/tenant/debug

# With subdomain (lvh.me)
curl http://luxe.lvh.me:3000/api/tenant/debug
```

Returns resolved slug, source, and masked tenant config. Disabled in production.

---

## 6. Adding a New Client

Zero code changes required:

```sql
INSERT INTO clients (name, slug, subdomain, brand_color, accent_color, retell_agent_id, n8n_webhook_url)
VALUES ('New Clinic', 'newclinic', 'newclinic', '#EC4899', '#F97316', 'agent_xyz_123', 'https://...');
```

Access: `http://newclinic.lvh.me:3000/dashboard`

---

## Project Structure

```
medspa-dashboard/
├── middleware.ts                      # Tenant slug extraction (Edge-compatible)
├── app/
│   ├── layout.tsx                     # Root layout — injects CSS vars from Supabase
│   ├── page.tsx                       # Redirects → /dashboard
│   ├── not-found.tsx
│   ├── dashboard/
│   │   └── page.tsx                   # Dashboard (Server Component — all data fetched here)
│   └── api/
│       ├── retell/webhook/route.ts    # Retell + n8n post-call webhook
│       └── tenant/debug/route.ts     # Dev-only tenant resolution debug
├── components/
│   ├── ui/                            # shadcn/ui: button, card, badge, table, input, select…
│   └── dashboard/
│       ├── layout.tsx                 # Sidebar + header wrapper
│       ├── sidebar.tsx                # Responsive sidebar with dynamic branding
│       ├── header.tsx                 # Sticky header with tenant name
│       ├── kpi-cards.tsx              # 4 KPI stat cards
│       ├── roi-chart.tsx              # Recharts area chart (Client Component)
│       ├── call-logs-table.tsx        # Filterable table (Client Component)
│       └── tenant-info-card.tsx       # Integration status
├── lib/
│   ├── utils.ts                       # cn, formatCurrency, formatDuration, etc.
│   ├── supabase/
│   │   ├── server.ts                  # Service role client (server-only)
│   │   └── client.ts                  # Anon client (browser)
│   ├── tenant/
│   │   ├── resolve-tenant.ts          # Slug extraction (Edge-safe, no DB)
│   │   └── get-tenant-config.ts       # Tenant DB lookups
│   └── dashboard/
│       └── metrics.ts                 # KPI computation + call log queries
├── types/database.ts                  # TypeScript interfaces (mirrors Supabase schema)
└── supabase/
    ├── migrations/001_initial_schema.sql
    ├── seed.sql                        # 2 tenants + 43 call log samples
    └── seed.ts                         # TypeScript seed (clients + services)
```

---

## Next 5 Production Upgrades

### 1. Auth + RLS (Priority: HIGH)
- Add Supabase Auth (magic link or password)
- Scope JWT to `tenant_slug` claim
- Enable Row Level Security — SQL stubs are already in `001_initial_schema.sql`
- Protect `/dashboard` routes behind session check in middleware

### 2. Real Retell Field Mapping (Priority: HIGH)
- Map actual Retell API v2 field names (see `TODO` comments in `webhook/route.ts`)
- Add deduplication on `external_call_id` to handle webhook retries
- Handle `call.started` events for real-time call count

### 3. Admin Panel (Priority: MEDIUM)
- `/admin/clients` — create/edit/deactivate tenants
- Logo upload to Supabase Storage
- Services catalog CRUD (drives auto-valuation of calls)
- KB version management (`kb_versions` table already exists)

### 4. Stripe Subscription Sync (Priority: MEDIUM)
- Webhook: `customer.subscription.updated/deleted`
- Auto-update `retainer_expiry` and `is_active` from subscription state
- Retainer expiry countdown already wired in `TenantInfoCard`

### 5. n8n AI Enrichment Pipeline (Priority: LOW)
- Auto-compute `potential_revenue` from service tags × `services_catalog.avg_price`
- Trigger manual follow-up workflows from the dashboard
- Sync Retell agent config changes back to `clients.retell_agent_id`
