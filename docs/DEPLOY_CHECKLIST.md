# Deployment & Client Onboarding Checklist

Internal operator guide for deploying and onboarding new AI Voice Agent clients.

---

## 1. Environment Variables

### Required

| Variable | Scope | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anon key (RLS-enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Supabase service role key (bypasses RLS) |
| `NEXT_PUBLIC_APP_DOMAIN` | Public | Domain for subdomain routing (e.g. `yourdomain.com`) |
| `WEBHOOK_API_KEY` | Server | Auth key for `/api/retell/webhook` |
| `CALL_SUMMARY_WEBHOOK_SECRET` | Server | Auth key for `/api/webhooks/retell/*` |

### Optional

| Variable | Scope | Default | Description |
|----------|-------|---------|-------------|
| `ENABLE_DEV_ROUTES` | Server | `false` | Enable dev/debug API routes in production |
| `DEV_ACTION_KEY` | Server | _(empty)_ | Header key for `/api/dev/crm/test-delivery` |
| `NODE_ENV` | Server | `development` | Set to `production` for production builds |

Copy `.env.example` to `.env.local` and fill in all required values.

---

## 2. Database Migrations

Run in order against your Supabase project:

```
001_initial_schema.sql          — clients, call_logs, user_tenants base tables
002_call_logs_upsert_index.sql  — upsert index for external_call_id
003_user_tenants.sql            — user-tenant relationship table
004_call_logs_enriched.sql      — AI enrichment columns (direction, sentiment, etc.)
005_crm_delivery_logs.sql       — CRM event delivery logging
006_call_ai_enrichments.sql     — AI summary fields
007_services_catalog_extend.sql — service category + duration columns
008_client_integrations.sql     — client integration config table
009_client_onboarding_state.sql — onboarding wizard persistence
```

All migrations are idempotent (`CREATE TABLE IF NOT EXISTS`).

If migration 009 is not applied, the onboarding wizard falls back to localStorage — no crash.

---

## 3. Seed / Demo Tenant

To set up a demo tenant:

1. Insert a row into `clients` table with desired `slug`, `name`, `brand_color`
2. For authenticated access, add a `user_tenants` row linking a Supabase auth user to the client
3. For demo/dev access, use the `?tenant=<slug>` query param or subdomain routing

The dashboard auto-resolves tenants via:
- Supabase Auth session → `user_tenants` lookup
- Middleware-injected slug from subdomain or query param
- Falls back to tenant-not-found screen

---

## 4. Dev Routes

These routes are **disabled in production** by default:

| Route | Purpose | Production gate |
|-------|---------|-----------------|
| `/api/tenant/debug` | Inspect tenant resolution | `NODE_ENV !== 'production'` |
| `/api/auth/debug` | Inspect auth + tenant stack | `NODE_ENV !== 'production'` |
| `/api/dev/crm/test-delivery` | Trigger synthetic CRM event | `ENABLE_DEV_ROUTES` + `DEV_ACTION_KEY` header |
| `/api/dev/crm/retry-delivery` | Replay failed CRM delivery | `ENABLE_DEV_ROUTES` |
| `/api/reports/monthly/preview` | Report payload as JSON | `ENABLE_DEV_ROUTES` |

To enable in production: set `ENABLE_DEV_ROUTES=true` (use with caution).

---

## 5. Smoke Test Checklist

After deployment, verify each flow:

### Authentication
- [ ] Visit `/dashboard` — redirects to login or shows tenant selection
- [ ] Login with valid credentials — dashboard loads with correct tenant
- [ ] Visit with `?tenant=<slug>` — resolves demo/dev access

### Dashboard Overview
- [ ] KPI cards render with real data (or show sensible zeroes)
- [ ] ROI chart renders
- [ ] Call logs table loads and paginates
- [ ] System status card shows correct integration/billing state
- [ ] Quick actions strip links work

### Integrations
- [ ] `/dashboard/integrations` loads without error
- [ ] Can create a Custom Webhook integration
- [ ] Can test integration connection
- [ ] Health card reflects real delivery success/failure

### Reports & ROI
- [ ] `/dashboard/reports` loads without error
- [ ] ROI summary card shows calculated values
- [ ] Executive report "Copy" button works (toast appears)
- [ ] Booking proof table renders

### Onboarding
- [ ] `/dashboard/onboarding` loads wizard correctly
- [ ] Can complete and skip steps
- [ ] Wizard state persists across page refreshes
- [ ] Dismiss wizard → it stays hidden

### Presentation Mode
- [ ] Click presentation toggle in header — sidebar hides, header compacts
- [ ] Click again — restores normal view
- [ ] `Cmd+Shift+P` keyboard shortcut works
- [ ] `Escape` exits presentation mode
- [ ] Tenant branding visible in presentation mode

### Services
- [ ] Can view, add, edit, and soft-delete services
- [ ] Service prices appear in ROI calculations

### Error States
- [ ] Dashboard error boundary catches thrown errors (test by temporarily breaking a query)
- [ ] Loading skeletons appear during navigation transitions

---

## 6. Known Scaffolds & Stubs

These features are scaffolded but **not fully implemented**:

| Feature | Status | What works | What doesn't |
|---------|--------|-----------|--------------|
| PDF export | Button visible, disabled | Tooltip explains "Coming Soon" | No PDF generation |
| Email report | Button visible, disabled | Tooltip explains "Coming Soon" | No email sending |
| HubSpot integration | Config CRUD works | Can save webhookUrl/apiKey | No real HubSpot API calls |
| GoHighLevel integration | Config CRUD works | Can save config | No real GHL API calls |
| Native Practice Management connectors | Provider registry metadata | Shows in UI with "Coming Soon" badges | No API integration |
| Onboarding DB persistence | Table + API ready | Works when migration 009 applied | Falls back to localStorage if not |

---

## 7. Architecture Notes

- **Multi-tenant**: All data scoped by `client_id`. Server queries always filter by resolved tenant.
- **Auth model**: Supabase Auth + `user_tenants` join table. Demo mode via middleware slug injection.
- **Supabase client**: Uses service-role key server-side (no RLS). RLS recommended when adding user-scoped features.
- **Theming**: CSS custom properties (`--brand-*`, `--user-accent-*`) set via blocking inline script in root layout to prevent FOUC.
- **i18n**: Client-side via `useLanguage()` hook. Supports EN, PL, ES.
