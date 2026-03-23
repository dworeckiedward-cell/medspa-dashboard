-- ============================================================================
-- Migration 030: Live Younger Medical Aesthetics tenant
--
-- Creates the Live Younger clinic tenant with:
--   - config_json column on clients (JSONB for tenant-specific config)
--   - Tenant row with Calgary timezone and Jane App config
--   - 15 services in services_catalog
--
-- Idempotent: safe to re-run (uses ON CONFLICT and IF NOT EXISTS).
-- ============================================================================

-- ── Add config_json column to clients (reusable for all tenants) ────────────

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS config_json jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.clients.config_json IS
  'Tenant-specific configuration (Jane App URL, Twilio, Stripe deposit, etc.). '
  'Schema-free JSONB — validated at application layer.';

-- ── Insert Live Younger tenant ──────────────────────────────────────────────

INSERT INTO public.clients (
  name, slug, subdomain,
  brand_color, accent_color, theme_mode,
  retell_phone_number,
  timezone, currency,
  client_type, dashboard_mode, business_vertical,
  config_json,
  is_active
) VALUES (
  'Live Younger Medical Aesthetics',
  'live-younger',
  'live-younger',
  '#2563EB',
  '#8B5CF6',
  'dark',
  '+16478475639',
  'America/Edmonton',
  'CAD',
  'clinic',
  'inbound_clinic',
  'medspa',
  '{
    "jane_url": "liveyounger.janeapp.com",
    "jane_api_key": "PENDING",
    "twilio_from_number": "+16478475639",
    "deposit_amount_cents": 5000,
    "deposit_currency": "cad"
  }'::jsonb,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  timezone = EXCLUDED.timezone,
  currency = EXCLUDED.currency,
  config_json = EXCLUDED.config_json,
  updated_at = NOW();

-- ── Insert services catalog ─────────────────────────────────────────────────

DO $$
DECLARE
  v_client_id uuid;
BEGIN
  SELECT id INTO v_client_id FROM public.clients WHERE slug = 'live-younger';

  -- Delete existing services for idempotency
  DELETE FROM public.services_catalog WHERE client_id = v_client_id;

  INSERT INTO public.services_catalog (client_id, service_name, category, aliases, currency, sort_order, is_active) VALUES
    (v_client_id, 'Botox / Neuromodulators',          'Injectables',     ARRAY['botox', 'tox', 'neuromodulators', 'dysport', 'xeomin'], 'cad', 1,  true),
    (v_client_id, 'CoolSculpting',                     'Body Contouring', ARRAY['coolsculpting', 'cool sculpting', 'fat freezing'],     'cad', 2,  true),
    (v_client_id, 'HydraFacial',                       'Facial',          ARRAY['hydrafacial', 'hydra facial'],                         'cad', 3,  true),
    (v_client_id, 'PDO Thread Lift',                   'Facial',          ARRAY['pdo', 'thread lift', 'threads'],                       'cad', 4,  true),
    (v_client_id, 'IV Nutritional Therapy',            'Wellness',        ARRAY['iv therapy', 'iv drip', 'iv nutrition'],               'cad', 5,  true),
    (v_client_id, 'Acupuncture',                       'Wellness',        ARRAY['acupuncture', 'acu'],                                  'cad', 6,  true),
    (v_client_id, 'Orthopedic Massage',                'Massage',         ARRAY['orthopedic massage', 'ortho massage'],                 'cad', 7,  true),
    (v_client_id, 'Tibetan Massage (Hor-Mey)',         'Massage',         ARRAY['tibetan massage', 'hor-mey', 'hormey'],                'cad', 8,  true),
    (v_client_id, 'Microdermabrasion',                 'Facial',          ARRAY['microdermabrasion', 'microderm'],                       'cad', 9,  true),
    (v_client_id, 'Forever Young BBL',                 'Laser',           ARRAY['bbl', 'forever young', 'broadband light'],             'cad', 10, true),
    (v_client_id, 'Platelet Rich Plasma',              'Regenerative',    ARRAY['prp', 'platelet rich plasma'],                         'cad', 11, true),
    (v_client_id, 'Weight Loss Consultation',          'Consultation',    ARRAY['weight loss', 'weight management'],                    'cad', 12, true),
    (v_client_id, 'Bioidentical Hormones',             'Wellness',        ARRAY['bhrt', 'bioidentical hormones', 'hormone therapy'],    'cad', 13, true),
    (v_client_id, 'Functional Medicine Consultation',  'Consultation',    ARRAY['functional medicine', 'functional med'],               'cad', 14, true),
    (v_client_id, 'Chiropractic',                      'Wellness',        ARRAY['chiropractic', 'chiro', 'adjustment'],                 'cad', 15, true);
END $$;
