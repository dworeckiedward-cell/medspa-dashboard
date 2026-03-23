-- ============================================================================
-- Migration 035: Seed Live Younger Medical Aesthetics — 89 Services
--
-- Populates tenant_service_categories and tenant_services for the
-- Live Younger booking page at /book/live-younger.
--
-- Idempotent: Uses ON CONFLICT DO NOTHING (tenant_id + name unique together).
-- ============================================================================

-- Helper: get Live Younger tenant ID
DO $$
DECLARE
  tid uuid;
  cat_aesthetics uuid;
  cat_acupuncture uuid;
  cat_osteopathy uuid;
  cat_nutrition uuid;
  cat_sound uuid;
  cat_massage uuid;
  cat_functional uuid;
  cat_bbl_forever uuid;
  cat_coolsculpting uuid;
  cat_bbl_photo uuid;
  cat_laser_hair uuid;
  cat_skin_tight uuid;
  cat_glow uuid;
  cat_microneedling uuid;
  cat_peels uuid;
  cat_laser_resurfacing uuid;
  cat_injectables uuid;
  cat_facials uuid;
  cat_orthopedic uuid;
BEGIN
  -- Try 'tenants' first (production), fall back to 'clients' (legacy schema)
  SELECT id INTO tid FROM tenants WHERE slug = 'live-younger' LIMIT 1;
  IF tid IS NULL THEN
    SELECT id INTO tid FROM clients WHERE slug = 'live-younger' LIMIT 1;
  END IF;
  IF tid IS NULL THEN
    RAISE NOTICE 'Tenant live-younger not found — skipping seed.';
    RETURN;
  END IF;

  -- ── Categories ──────────────────────────────────────────────────────────

  INSERT INTO tenant_service_categories (id, tenant_id, name, description, sort_order, campaign_types)
  VALUES
    (gen_random_uuid(), tid, 'Aesthetics', 'Skin consultations and body composition scans', 1, ARRAY['skin'])
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_aesthetics;
  IF cat_aesthetics IS NULL THEN SELECT id INTO cat_aesthetics FROM tenant_service_categories WHERE tenant_id = tid AND name = 'Aesthetics'; END IF;

  INSERT INTO tenant_service_categories (id, tenant_id, name, description, sort_order, campaign_types)
  VALUES (gen_random_uuid(), tid, 'Acupuncture', 'Traditional and cosmetic acupuncture treatments', 2, ARRAY['acupuncture', 'facial_acupuncture'])
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_acupuncture;
  IF cat_acupuncture IS NULL THEN SELECT id INTO cat_acupuncture FROM tenant_service_categories WHERE tenant_id = tid AND name = 'Acupuncture'; END IF;

  INSERT INTO tenant_service_categories (id, tenant_id, name, description, sort_order, campaign_types)
  VALUES (gen_random_uuid(), tid, 'Osteopathy', 'Manual osteopathic treatments', 3, NULL)
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_osteopathy;
  IF cat_osteopathy IS NULL THEN SELECT id INTO cat_osteopathy FROM tenant_service_categories WHERE tenant_id = tid AND name = 'Osteopathy'; END IF;

  INSERT INTO tenant_service_categories (id, tenant_id, name, description, sort_order, campaign_types)
  VALUES (gen_random_uuid(), tid, 'Nutrition', 'Personalized nutrition consultations', 4, NULL)
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_nutrition;
  IF cat_nutrition IS NULL THEN SELECT id INTO cat_nutrition FROM tenant_service_categories WHERE tenant_id = tid AND name = 'Nutrition'; END IF;

  INSERT INTO tenant_service_categories (id, tenant_id, name, description, sort_order, campaign_types)
  VALUES (gen_random_uuid(), tid, 'Sound Wellness Therapy', 'Sound-based therapeutic treatments', 5, NULL)
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_sound;
  IF cat_sound IS NULL THEN SELECT id INTO cat_sound FROM tenant_service_categories WHERE tenant_id = tid AND name = 'Sound Wellness Therapy'; END IF;

  INSERT INTO tenant_service_categories (id, tenant_id, name, description, sort_order, campaign_types)
  VALUES (gen_random_uuid(), tid, 'Massage Therapy', 'Therapeutic and relaxation massage', 6, NULL)
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_massage;
  IF cat_massage IS NULL THEN SELECT id INTO cat_massage FROM tenant_service_categories WHERE tenant_id = tid AND name = 'Massage Therapy'; END IF;

  INSERT INTO tenant_service_categories (id, tenant_id, name, description, sort_order, campaign_types)
  VALUES (gen_random_uuid(), tid, 'Functional Medicine', 'Longevity, hormones, and functional fitness', 7, NULL)
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_functional;
  IF cat_functional IS NULL THEN SELECT id INTO cat_functional FROM tenant_service_categories WHERE tenant_id = tid AND name = 'Functional Medicine'; END IF;

  INSERT INTO tenant_service_categories (id, tenant_id, name, description, sort_order, campaign_types)
  VALUES (gen_random_uuid(), tid, 'Forever Young BBL', 'Broadband Light anti-aging treatments', 8, ARRAY['skin'])
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_bbl_forever;
  IF cat_bbl_forever IS NULL THEN SELECT id INTO cat_bbl_forever FROM tenant_service_categories WHERE tenant_id = tid AND name = 'Forever Young BBL'; END IF;

  INSERT INTO tenant_service_categories (id, tenant_id, name, description, sort_order, campaign_types)
  VALUES (gen_random_uuid(), tid, 'CoolSculpting', 'Non-invasive fat reduction', 9, NULL)
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_coolsculpting;
  IF cat_coolsculpting IS NULL THEN SELECT id INTO cat_coolsculpting FROM tenant_service_categories WHERE tenant_id = tid AND name = 'CoolSculpting'; END IF;

  INSERT INTO tenant_service_categories (id, tenant_id, name, description, sort_order, campaign_types)
  VALUES (gen_random_uuid(), tid, 'Broadband Light Treatments', 'Photo rejuvenation and skin correction', 10, ARRAY['skin'])
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_bbl_photo;
  IF cat_bbl_photo IS NULL THEN SELECT id INTO cat_bbl_photo FROM tenant_service_categories WHERE tenant_id = tid AND name = 'Broadband Light Treatments'; END IF;

  INSERT INTO tenant_service_categories (id, tenant_id, name, description, sort_order, campaign_types)
  VALUES (gen_random_uuid(), tid, 'Laser Hair Removal', 'Permanent hair reduction treatments', 11, NULL)
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_laser_hair;
  IF cat_laser_hair IS NULL THEN SELECT id INTO cat_laser_hair FROM tenant_service_categories WHERE tenant_id = tid AND name = 'Laser Hair Removal'; END IF;

  INSERT INTO tenant_service_categories (id, tenant_id, name, description, sort_order, campaign_types)
  VALUES (gen_random_uuid(), tid, 'Skin Tightening Treatments', 'Thermage and SkinTyte treatments', 12, ARRAY['skin'])
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_skin_tight;
  IF cat_skin_tight IS NULL THEN SELECT id INTO cat_skin_tight FROM tenant_service_categories WHERE tenant_id = tid AND name = 'Skin Tightening Treatments'; END IF;

  INSERT INTO tenant_service_categories (id, tenant_id, name, description, sort_order, campaign_types)
  VALUES (gen_random_uuid(), tid, 'Glowing Skin Program', 'Signature glow treatments', 13, ARRAY['skin'])
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_glow;
  IF cat_glow IS NULL THEN SELECT id INTO cat_glow FROM tenant_service_categories WHERE tenant_id = tid AND name = 'Glowing Skin Program'; END IF;

  INSERT INTO tenant_service_categories (id, tenant_id, name, description, sort_order, campaign_types)
  VALUES (gen_random_uuid(), tid, 'Microneedling & Skin Infusion', 'Collagen induction and skin infusion', 14, ARRAY['skin'])
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_microneedling;
  IF cat_microneedling IS NULL THEN SELECT id INTO cat_microneedling FROM tenant_service_categories WHERE tenant_id = tid AND name = 'Microneedling & Skin Infusion'; END IF;

  INSERT INTO tenant_service_categories (id, tenant_id, name, description, sort_order, campaign_types)
  VALUES (gen_random_uuid(), tid, 'Peels', 'Chemical and enzymatic skin peels', 15, ARRAY['skin'])
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_peels;
  IF cat_peels IS NULL THEN SELECT id INTO cat_peels FROM tenant_service_categories WHERE tenant_id = tid AND name = 'Peels'; END IF;

  INSERT INTO tenant_service_categories (id, tenant_id, name, description, sort_order, campaign_types)
  VALUES (gen_random_uuid(), tid, 'Laser Resurfacing', 'Advanced laser skin treatments', 16, NULL)
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_laser_resurfacing;
  IF cat_laser_resurfacing IS NULL THEN SELECT id INTO cat_laser_resurfacing FROM tenant_service_categories WHERE tenant_id = tid AND name = 'Laser Resurfacing'; END IF;

  INSERT INTO tenant_service_categories (id, tenant_id, name, description, sort_order, campaign_types)
  VALUES (gen_random_uuid(), tid, 'Injectables', 'Neuromodulators, PRP, and skin boosters', 17, NULL)
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_injectables;
  IF cat_injectables IS NULL THEN SELECT id INTO cat_injectables FROM tenant_service_categories WHERE tenant_id = tid AND name = 'Injectables'; END IF;

  INSERT INTO tenant_service_categories (id, tenant_id, name, description, sort_order, campaign_types)
  VALUES (gen_random_uuid(), tid, 'Facials', 'Premium facial treatments', 18, ARRAY['skin'])
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_facials;
  IF cat_facials IS NULL THEN SELECT id INTO cat_facials FROM tenant_service_categories WHERE tenant_id = tid AND name = 'Facials'; END IF;

  INSERT INTO tenant_service_categories (id, tenant_id, name, description, sort_order, campaign_types)
  VALUES (gen_random_uuid(), tid, 'Orthopedic', 'Pain therapy and orthopedic treatments', 19, ARRAY['pain'])
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_orthopedic;
  IF cat_orthopedic IS NULL THEN SELECT id INTO cat_orthopedic FROM tenant_service_categories WHERE tenant_id = tid AND name = 'Orthopedic'; END IF;

  -- ── Services ────────────────────────────────────────────────────────────

  -- Aesthetics
  INSERT INTO tenant_services (tenant_id, category_id, name, duration_minutes, price_cents, currency, practitioners, sort_order) VALUES
    (tid, cat_aesthetics, 'Skin Consultation', 30, 0, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 1),
    (tid, cat_aesthetics, 'Seca Scan', 15, 9500, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 2),
    (tid, cat_aesthetics, 'Seca Scan Special', 15, 5000, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 3)
  ON CONFLICT DO NOTHING;

  -- Acupuncture
  INSERT INTO tenant_services (tenant_id, category_id, name, duration_minutes, price_cents, currency, practitioners, sort_order) VALUES
    (tid, cat_acupuncture, 'Lasheka Morgan - 1.5hr Initial Consultation + Treatment', 90, 16500, 'cad', ARRAY['Dr. Lasheka Morgan'], 1),
    (tid, cat_acupuncture, 'Lasheka Morgan - Follow-up (1hr)', 60, 11500, 'cad', ARRAY['Dr. Lasheka Morgan'], 2),
    (tid, cat_acupuncture, 'Lasheka Morgan - Cosmetic Rejuvenation Acupuncture (1.5hr)', 90, 23500, 'cad', ARRAY['Dr. Lasheka Morgan'], 3),
    (tid, cat_acupuncture, 'Lasheka Morgan - Floral Acupuncture Add-on', 10, 3500, 'cad', ARRAY['Dr. Lasheka Morgan'], 4),
    (tid, cat_acupuncture, 'Dr. Matthew Rider - Initial Treatment (90 min)', 90, 16499, 'cad', ARRAY['Dr. Matthew Rider'], 5),
    (tid, cat_acupuncture, 'Dr. Matthew Rider - Follow-up (1h)', 60, 11500, 'cad', ARRAY['Dr. Matthew Rider'], 6),
    (tid, cat_acupuncture, 'Lasheka Morgan - Floral Acupuncture Follow-up', 70, 15000, 'cad', ARRAY['Dr. Lasheka Morgan'], 7),
    (tid, cat_acupuncture, 'Lasheka Morgan - Cosmetic Acupuncture', 60, 17000, 'cad', ARRAY['Dr. Lasheka Morgan'], 8),
    (tid, cat_acupuncture, 'Sports Acupuncture & Massage', 75, 14500, 'cad', ARRAY['Dr. Lasheka Morgan'], 9),
    (tid, cat_acupuncture, 'Acupuncture Consultation', 30, 6500, 'cad', ARRAY['Dr. Lasheka Morgan', 'Dr. Matthew Rider'], 10),
    (tid, cat_acupuncture, 'Lasheka Morgan - 1hr Cosmetic Acupuncture', 60, 17000, 'cad', ARRAY['Dr. Lasheka Morgan'], 11),
    (tid, cat_acupuncture, 'Acupuncture Consultation + 3 Treatments', 60, 29325, 'cad', ARRAY['Dr. Lasheka Morgan', 'Dr. Matthew Rider'], 12)
  ON CONFLICT DO NOTHING;

  -- Osteopathy
  INSERT INTO tenant_services (tenant_id, category_id, name, duration_minutes, price_cents, currency, practitioners, sort_order) VALUES
    (tid, cat_osteopathy, 'Osteopathy Initial (45min)', 45, 16000, 'cad', ARRAY['Dr. Salma Mitha'], 1),
    (tid, cat_osteopathy, 'Osteopathy Follow Up (30min)', 30, 14000, 'cad', ARRAY['Dr. Salma Mitha'], 2),
    (tid, cat_osteopathy, 'Osteopathy Taping', 10, 1000, 'cad', ARRAY['Dr. Salma Mitha'], 3)
  ON CONFLICT DO NOTHING;

  -- Nutrition
  INSERT INTO tenant_services (tenant_id, category_id, name, duration_minutes, price_cents, currency, practitioners, sort_order) VALUES
    (tid, cat_nutrition, 'Nutrition Initial Consultation (1 hr)', 60, 30000, 'cad', ARRAY['Michal Ofer'], 1),
    (tid, cat_nutrition, 'Nutrition Follow Up (30 min)', 30, 15000, 'cad', ARRAY['Michal Ofer'], 2),
    (tid, cat_nutrition, 'Nutrition Follow Up (1 hr)', 60, 24000, 'cad', ARRAY['Michal Ofer'], 3)
  ON CONFLICT DO NOTHING;

  -- Sound Wellness Therapy
  INSERT INTO tenant_services (tenant_id, category_id, name, duration_minutes, price_cents, currency, practitioners, sort_order) VALUES
    (tid, cat_sound, 'Sound Wellness Therapy Initial (2 hr)', 120, 15000, 'cad', ARRAY['Natalie Stuber'], 1),
    (tid, cat_sound, 'Sound Wellness Therapy Follow Up (1.5 hr)', 90, 13000, 'cad', ARRAY['Natalie Stuber'], 2),
    (tid, cat_sound, 'Sound Wellness Therapy Deep Relaxation (1 hr)', 60, 10000, 'cad', ARRAY['Natalie Stuber'], 3)
  ON CONFLICT DO NOTHING;

  -- Massage Therapy
  INSERT INTO tenant_services (tenant_id, category_id, name, duration_minutes, price_cents, currency, practitioners, sort_order) VALUES
    (tid, cat_massage, 'Massage Therapy (1 hr)', 60, 11000, 'cad', ARRAY['Young Suk Cho'], 1),
    (tid, cat_massage, 'Massage Therapy (1.5 hr)', 90, 15000, 'cad', ARRAY['Young Suk Cho'], 2),
    (tid, cat_massage, 'Massage Therapy (2 hr)', 120, 19000, 'cad', ARRAY['Young Suk Cho'], 3),
    (tid, cat_massage, 'Lasheka Morgan - Sports Massage (60 min)', 60, 13500, 'cad', ARRAY['Dr. Lasheka Morgan'], 4),
    (tid, cat_massage, 'Lasheka Morgan - Sports Massage (30 min)', 30, 7000, 'cad', ARRAY['Dr. Lasheka Morgan'], 5),
    (tid, cat_massage, 'Lasheka Morgan - Relaxation Massage (60 min)', 60, 13500, 'cad', ARRAY['Dr. Lasheka Morgan'], 6),
    (tid, cat_massage, 'Buccal Massage/Jaw Release (10 min)', 10, 3000, 'cad', ARRAY['Dr. Lasheka Morgan', 'Young Suk Cho'], 7),
    (tid, cat_massage, 'Fire Cupping/Gua Sha Massage (10 min)', 10, 3000, 'cad', ARRAY['Dr. Lasheka Morgan', 'Young Suk Cho'], 8)
  ON CONFLICT DO NOTHING;

  -- Functional Medicine
  INSERT INTO tenant_services (tenant_id, category_id, name, duration_minutes, price_cents, currency, practitioners, sort_order) VALUES
    (tid, cat_functional, 'Longevity Assessment', 30, 0, 'cad', ARRAY['Hanna Stoliarova'], 1),
    (tid, cat_functional, 'Functional Fitness', 60, 20000, 'cad', ARRAY['Tamara Jarrett'], 2),
    (tid, cat_functional, 'Dr. Kar - Clinic Fee', 45, 55000, 'cad', ARRAY['Tamara Jarrett', 'Hanna Stoliarova'], 3),
    (tid, cat_functional, 'Hormones in Harmony - Coaching', 30, 20000, 'cad', ARRAY['Tamara Jarrett', 'Hanna Stoliarova'], 4)
  ON CONFLICT DO NOTHING;

  -- Forever Young BBL
  INSERT INTO tenant_services (tenant_id, category_id, name, duration_minutes, price_cents, currency, practitioners, sort_order) VALUES
    (tid, cat_bbl_forever, 'BBL Forever Young: Face', 60, 42500, 'cad', ARRAY['Hanna Dutkowska', 'Taylor Lekach', 'Hanna Stoliarova'], 1),
    (tid, cat_bbl_forever, 'BBL Forever Young: Neck', 45, 22500, 'cad', ARRAY['Hanna Dutkowska', 'Taylor Lekach', 'Hanna Stoliarova'], 2),
    (tid, cat_bbl_forever, 'BBL Forever Young: Hands', 45, 19500, 'cad', ARRAY['Hanna Dutkowska', 'Taylor Lekach', 'Hanna Stoliarova'], 3)
  ON CONFLICT DO NOTHING;

  -- CoolSculpting
  INSERT INTO tenant_services (tenant_id, category_id, name, duration_minutes, price_cents, currency, practitioners, sort_order) VALUES
    (tid, cat_coolsculpting, 'CoolMini', 60, 100000, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 1),
    (tid, cat_coolsculpting, 'CoolAdvantage', 60, 75000, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 2),
    (tid, cat_coolsculpting, 'CoolMax', 90, 150000, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 3)
  ON CONFLICT DO NOTHING;

  -- Broadband Light Treatments
  INSERT INTO tenant_services (tenant_id, category_id, name, duration_minutes, price_cents, currency, practitioners, sort_order) VALUES
    (tid, cat_bbl_photo, 'BBL Photo Rejuvenation - Face', 45, 39500, 'cad', ARRAY['Hanna Dutkowska', 'Taylor Lekach', 'Hanna Stoliarova'], 1),
    (tid, cat_bbl_photo, 'BBL Photo Rejuvenation - Neck/Hands', 30, 19500, 'cad', ARRAY['Hanna Dutkowska', 'Taylor Lekach', 'Hanna Stoliarova'], 2),
    (tid, cat_bbl_photo, 'BBL Photo Rejuvenation - Chest', 40, 40000, 'cad', ARRAY['Hanna Dutkowska', 'Taylor Lekach', 'Hanna Stoliarova'], 3),
    (tid, cat_bbl_photo, 'BBL Photo Rejuvenation - Lower Arms', 45, 39500, 'cad', ARRAY['Hanna Dutkowska', 'Taylor Lekach', 'Hanna Stoliarova'], 4)
  ON CONFLICT DO NOTHING;

  -- Laser Hair Removal
  INSERT INTO tenant_services (tenant_id, category_id, name, duration_minutes, price_cents, currency, practitioners, sort_order) VALUES
    (tid, cat_laser_hair, 'Laser Hair Removal (15 min)', 15, 5000, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 1),
    (tid, cat_laser_hair, 'Laser Hair Removal (30 min)', 30, 11500, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 2),
    (tid, cat_laser_hair, 'Laser Hair Removal (45 min)', 45, 20000, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 3),
    (tid, cat_laser_hair, 'Laser Hair Removal (1 hr)', 60, 25000, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 4),
    (tid, cat_laser_hair, 'Laser Hair Removal (90 min)', 90, 39000, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 5)
  ON CONFLICT DO NOTHING;

  -- Skin Tightening Treatments
  INSERT INTO tenant_services (tenant_id, category_id, name, duration_minutes, price_cents, currency, practitioners, sort_order) VALUES
    (tid, cat_skin_tight, 'Thermage: Body Part T900', 180, 330000, 'cad', ARRAY['Hanna Dutkowska', 'Taylor Lekach', 'Hanna Stoliarova'], 1),
    (tid, cat_skin_tight, 'Thermage: Body Part T1200', 180, 450000, 'cad', ARRAY['Hanna Dutkowska', 'Taylor Lekach', 'Hanna Stoliarova'], 2),
    (tid, cat_skin_tight, 'Thermage: Eyes', 60, 195000, 'cad', ARRAY['Hanna Dutkowska', 'Taylor Lekach', 'Hanna Stoliarova'], 3),
    (tid, cat_skin_tight, 'SkinTyte - Face', 45, 32500, 'cad', ARRAY['Hanna Dutkowska', 'Taylor Lekach', 'Hanna Stoliarova'], 4),
    (tid, cat_skin_tight, 'SkinTyte - Neck', 30, 27000, 'cad', ARRAY['Hanna Dutkowska', 'Taylor Lekach', 'Hanna Stoliarova'], 5),
    (tid, cat_skin_tight, 'Mini SkinTyte - Jaw Line', 30, 19500, 'cad', ARRAY['Hanna Dutkowska', 'Taylor Lekach', 'Hanna Stoliarova'], 6),
    (tid, cat_skin_tight, 'SkinTyte - Hands', 30, 19500, 'cad', ARRAY['Hanna Dutkowska', 'Taylor Lekach', 'Hanna Stoliarova'], 7),
    (tid, cat_skin_tight, 'SkinTyte - Stomach/Thighs', 30, 45000, 'cad', ARRAY['Hanna Dutkowska', 'Taylor Lekach', 'Hanna Stoliarova'], 8)
  ON CONFLICT DO NOTHING;

  -- Glowing Skin Program
  INSERT INTO tenant_services (tenant_id, category_id, name, duration_minutes, price_cents, currency, practitioners, sort_order) VALUES
    (tid, cat_glow, 'Glow Facial', 60, 7900, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 1)
  ON CONFLICT DO NOTHING;

  -- Microneedling & Skin Infusion
  INSERT INTO tenant_services (tenant_id, category_id, name, duration_minutes, price_cents, currency, practitioners, sort_order) VALUES
    (tid, cat_microneedling, 'Microneedling', 90, 23000, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 1),
    (tid, cat_microneedling, 'Mesoglow', 60, 23000, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 2),
    (tid, cat_microneedling, 'V2 Beauty Booster', 90, 56500, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 3),
    (tid, cat_microneedling, 'PRP Treatment', 60, 57500, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 4)
  ON CONFLICT DO NOTHING;

  -- Peels
  INSERT INTO tenant_services (tenant_id, category_id, name, duration_minutes, price_cents, currency, practitioners, sort_order) VALUES
    (tid, cat_peels, 'Dermaplaning', 40, 14900, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 1),
    (tid, cat_peels, 'Natural Pro-Retinol Peel', 45, 14900, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 2),
    (tid, cat_peels, 'Zena Algae Peel', 60, 19900, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 3),
    (tid, cat_peels, 'Derma Pro Clinical', 30, 17498, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 4),
    (tid, cat_peels, 'The Perfect Derma Peel', 60, 27500, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 5),
    (tid, cat_peels, 'Red Carpet Peel - Face', 60, 13900, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 6),
    (tid, cat_peels, 'Red Carpet Peel - Promo', 60, 12000, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 7)
  ON CONFLICT DO NOTHING;

  -- Laser Resurfacing
  INSERT INTO tenant_services (tenant_id, category_id, name, duration_minutes, price_cents, currency, practitioners, sort_order) VALUES
    (tid, cat_laser_resurfacing, 'Nanolaser Peel', 90, 35000, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 1),
    (tid, cat_laser_resurfacing, 'Profractional Laser', 105, 195000, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 2),
    (tid, cat_laser_resurfacing, 'Laser Resurfacing 50-100 Microns', 105, 120000, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 3),
    (tid, cat_laser_resurfacing, 'Laser Resurfacing 100+ Microns', 105, 250000, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 4),
    (tid, cat_laser_resurfacing, 'Laser Resurfacing Eyes with Lift', 90, 125000, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 5)
  ON CONFLICT DO NOTHING;

  -- Injectables
  INSERT INTO tenant_services (tenant_id, category_id, name, duration_minutes, price_cents, currency, practitioners, sort_order, price_varies) VALUES
    (tid, cat_injectables, 'Neuromodulator (Botox)', 30, 0, 'cad', ARRAY['Hanna Dutkowska', 'Taylor Lekach', 'Hanna Stoliarova'], 1, true),
    (tid, cat_injectables, 'PRP G-Shot x1', 60, 120000, 'cad', ARRAY['Hanna Dutkowska', 'Taylor Lekach', 'Hanna Stoliarova'], 2, false),
    (tid, cat_injectables, 'NCTF Filorga', 40, 47500, 'cad', ARRAY['Hanna Dutkowska', 'Taylor Lekach', 'Hanna Stoliarova'], 3, false)
  ON CONFLICT DO NOTHING;

  -- Facials
  INSERT INTO tenant_services (tenant_id, category_id, name, duration_minutes, price_cents, currency, practitioners, sort_order) VALUES
    (tid, cat_facials, 'Korean Firm & Glow Facial', 60, 29700, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 1),
    (tid, cat_facials, 'Radiance Facial', 45, 13500, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 2),
    (tid, cat_facials, 'HydraFacial Signature', 60, 19900, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 3),
    (tid, cat_facials, 'HydraFacial Platinum', 80, 32500, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 4),
    (tid, cat_facials, 'HydraFacial Deluxe', 60, 22500, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 5),
    (tid, cat_facials, 'Hydrojelly Facial', 45, 9500, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 6),
    (tid, cat_facials, 'HydraFacial Age-Refinement', 60, 25000, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 7),
    (tid, cat_facials, 'Facial Anti-aging/Collagen', 75, 17500, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 8),
    (tid, cat_facials, 'Hydrojelly Facial - Promo', 45, 6500, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 9),
    (tid, cat_facials, 'Anti-Aging Collagen Facial - Promo', 45, 10500, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 10),
    (tid, cat_facials, 'Add on - Mask and Ampule', 10, 6000, 'cad', ARRAY['Hanna Dutkowska', 'Hanna Stoliarova'], 11)
  ON CONFLICT DO NOTHING;

  -- Orthopedic
  INSERT INTO tenant_services (tenant_id, category_id, name, duration_minutes, price_cents, currency, practitioners, sort_order) VALUES
    (tid, cat_orthopedic, 'Acoustic Sound Pain Therapy', 60, 25000, 'cad', ARRAY['Hanna Stoliarova'], 1),
    (tid, cat_orthopedic, 'Pleasure Pulse Protocol', 60, 55000, 'cad', ARRAY['Hanna Stoliarova'], 2),
    (tid, cat_orthopedic, 'Pleasure Pulse Protocol 3 Treatments', 60, 165000, 'cad', ARRAY['Dr. Matthew Rider', 'Hanna Stoliarova'], 3),
    (tid, cat_orthopedic, 'Pleasure Pulse Protocol 6 Treatments', 60, 330000, 'cad', ARRAY['Dr. Matthew Rider', 'Hanna Stoliarova'], 4),
    (tid, cat_orthopedic, 'Pleasure Pulse Protocol 12 Treatments', 60, 660000, 'cad', ARRAY['Dr. Matthew Rider', 'Hanna Stoliarova'], 5)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Seeded Live Younger services successfully.';
END $$;
