# Lovable → Next.js Dashboard Auth Integration

Practical handoff guide for wiring Lovable (React + Vite) login to the
white-label Next.js dashboard using Supabase Auth.

---

## 1. Required environment variables

### Next.js dashboard (`.env.local`)

```env
# Supabase project — must be the SAME project used by Lovable
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # server-only, never expose

# App domain — used by middleware for subdomain routing
NEXT_PUBLIC_APP_DOMAIN=yourdomain.com
```

### Lovable app (`.env` or Lovable project settings)

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co   # same project
VITE_SUPABASE_ANON_KEY=<anon-key>
```

> ⚠️ Both apps must point to the **same Supabase project**. The session cookie
> is project-scoped — mismatched projects = no shared session.

---

## 2. Same Supabase project requirement

Supabase Auth issues cookies scoped to the project reference. The cookie name
follows the pattern `sb-<project-ref>-auth-token`. Both Lovable and the
dashboard must use the same `<project-ref>` for the cookie to be readable
across apps.

---

## 3. Session sharing options

### Option A — Shared root domain (recommended for production)

Deploy both apps under the same root domain:

| App | URL |
|-----|-----|
| Lovable (login / marketing) | `app.yourdomain.com` |
| Dashboard (tenant) | `luxe.yourdomain.com`, `miami.yourdomain.com` |

Configure Supabase Auth to set cookies on `.yourdomain.com`:

```
Supabase Dashboard → Authentication → URL Configuration
  Site URL:             https://app.yourdomain.com
  Redirect URLs:        https://*.yourdomain.com/**
  Cookie domain:        .yourdomain.com          ← key setting
```

The `sb-*-auth-token` cookie is then readable by all `*.yourdomain.com`
subdomains, including the Next.js dashboard.

### Option B — PKCE / URL token handoff (cross-domain fallback)

If both apps cannot share a root domain (e.g. `app.lovable.app` →
`yourdomain.com`):

1. After login, Lovable calls `supabase.auth.signInWithOtp()` or OAuth.
2. Supabase redirects to `https://yourdomain.com/auth/callback?code=<pkce-code>`.
3. A Next.js route handler at `/api/auth/callback` exchanges the code for a
   session and sets the cookie on the dashboard domain.

```ts
// app/api/auth/callback/route.ts  (to be implemented when needed)
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  if (code) {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(),
                   setAll: (c) => c.forEach(({ name, value, options }) =>
                     cookieStore.set(name, value, options)) } }
    )
    await supabase.auth.exchangeCodeForSession(code)
  }
  return NextResponse.redirect(new URL('/dashboard', request.url))
}
```

---

## 4. Callback URL requirements

Add to **Supabase → Authentication → URL Configuration → Redirect URLs**:

```
https://yourdomain.com/**
https://*.yourdomain.com/**
http://localhost:3000/**          # local dev
```

---

## 5. Expected flow after login

```
User on Lovable app
  │
  ├─ clicks "Login" → Supabase magic link email / OAuth
  │
  ├─ Supabase redirects to Lovable with session
  │    Lovable app sets the sb-*-auth-token cookie on the root domain
  │
  ├─ User navigates (or is redirected) to dashboard URL
  │    e.g. https://luxe.yourdomain.com/dashboard
  │
  ├─ Next.js middleware runs → resolves x-tenant-slug from subdomain
  │
  ├─ Dashboard page calls resolveTenantAccess()
  │    Path A: reads sb-*-auth-token cookie via @supabase/ssr
  │    supabase.auth.getUser() → verifies JWT → user.id
  │    service client → user_tenants WHERE user_id = user.id
  │
  ├─ 1 tenant  → dashboard renders normally (accessMode: 'authenticated')
  ├─ >1 tenants → redirect to /dashboard/select-tenant → user picks one
  └─ 0 tenants  → TenantNotFound reason="no_workspace" → contact support
```

---

## 6. Database setup (migration 003)

Run `supabase/migrations/003_user_tenants.sql` before enabling auth.

After running, seed a test row:

```sql
insert into public.user_tenants (user_id, client_id, role)
values (
  '<your-supabase-auth-user-id>',   -- from auth.users.id
  '<client-row-id>',                -- from public.clients.id
  'owner'
);
```

Get user ID from: Supabase Dashboard → Authentication → Users → copy UUID.

---

## 7. Troubleshooting checklist

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `accessMode: 'demo'` after login | Cookie not shared across domains | Use shared root domain or PKCE callback |
| `sessionDetected: false` in `/api/auth/debug` | Cookie missing or wrong project | Check `NEXT_PUBLIC_SUPABASE_URL` matches on both apps |
| `sessionDetected: true` but `tenantCount: 0` | Missing `user_tenants` row | Run migration 003 + insert row |
| `needsTenantSelection: true` unexpectedly | User has >1 row in `user_tenants` | Expected — routes user to `/dashboard/select-tenant` |
| Dashboard shows demo data after login | Auth path resolves to same tenant via demo slug | Expected for single-tenant users — demo slug matches auth tenant |
| `TenantNotFound reason="no_workspace"` | Auth works but no tenant mapping | Insert row in `user_tenants` |
| Cookie visible in browser but not in Next.js | `SameSite` / domain mismatch | Set cookie domain to `.yourdomain.com` in Supabase config |

### Quick diagnostic

```bash
# Check auth + tenant resolution state (dev only)
curl http://localhost:3000/api/auth/debug
curl "http://localhost:3000/api/auth/debug?tenant=luxe"
open http://luxe.lvh.me:3000/api/auth/debug
```

Expected output when working:
```json
{
  "auth": { "sessionDetected": true, "userId": "uuid", "email": "user@example.com", "tenantCount": 1 },
  "resolution": { "path": "A1", "description": "authenticated — single tenant" }
}
```

---

## 8. Files involved (dashboard side)

| File | Role |
|------|------|
| `lib/supabase/auth-server.ts` | SSR auth client; reads cookies, queries `user_tenants` |
| `lib/dashboard/resolve-tenant-access.ts` | Central resolver; auth-first + demo fallback |
| `app/api/auth/debug/route.ts` | Dev diagnostic endpoint |
| `app/dashboard/select-tenant/page.tsx` | Workspace picker for multi-tenant users |
| `supabase/migrations/003_user_tenants.sql` | Schema for user→tenant mapping |
| `components/shared/tenant-not-found.tsx` | Error UI for `no_workspace` case |
