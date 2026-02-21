-- ─── Seed: 2 demo tenants + sample call logs ─────────────────────────────────
-- Run in Supabase SQL Editor AFTER running 001_initial_schema.sql
-- OR use supabase/seed.ts for programmatic seeding
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Tenant 1: Luxe Aesthetics ───────────────────────────────────────────────

INSERT INTO clients (
  id, name, slug, subdomain, custom_domain,
  logo_url, brand_color, accent_color, theme_mode,
  retell_agent_id, retell_phone_number,
  n8n_webhook_url, n8n_api_key_ref,
  stripe_customer_id, stripe_subscription_id,
  retainer_expiry, timezone, currency, is_active
) VALUES (
  'a1000000-0000-0000-0000-000000000001',
  'Luxe Aesthetics',
  'luxe',
  'luxe',
  NULL,
  NULL,
  '#0EA5E9',
  '#8B5CF6',
  'dark',
  'agent_luxe_001',
  '+13055550101',
  'https://n8n.yourcompany.com/webhook/luxe-medspa',
  'n8n_key_ref_luxe',
  'cus_luxe_stripe_001',
  'sub_luxe_stripe_001',
  NOW() + INTERVAL '45 days',
  'America/New_York',
  'USD',
  TRUE
)
ON CONFLICT (slug) DO NOTHING;

-- ─── Tenant 2: Miami Glow ─────────────────────────────────────────────────────

INSERT INTO clients (
  id, name, slug, subdomain, custom_domain,
  logo_url, brand_color, accent_color, theme_mode,
  retell_agent_id, retell_phone_number,
  n8n_webhook_url, n8n_api_key_ref,
  stripe_customer_id, stripe_subscription_id,
  retainer_expiry, timezone, currency, is_active
) VALUES (
  'a2000000-0000-0000-0000-000000000002',
  'Miami Glow MedSpa',
  'miami',
  'miami',
  NULL,
  NULL,
  '#F59E0B',
  '#EC4899',
  'dark',
  'agent_miami_002',
  '+13055550202',
  'https://n8n.yourcompany.com/webhook/miami-glow',
  'n8n_key_ref_miami',
  'cus_miami_stripe_002',
  'sub_miami_stripe_002',
  NOW() + INTERVAL '12 days',
  'America/New_York',
  'USD',
  TRUE
)
ON CONFLICT (slug) DO NOTHING;

-- ─── Services catalog: Luxe Aesthetics ───────────────────────────────────────

INSERT INTO services_catalog (client_id, service_name, aliases, price_min, price_max, avg_price) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Botox', ARRAY['tox','neurotoxin','botulinum'], 300, 800, 550),
  ('a1000000-0000-0000-0000-000000000001', 'Lip Filler', ARRAY['lip augmentation','lip enhancement'], 650, 1200, 850),
  ('a1000000-0000-0000-0000-000000000001', 'Laser Resurfacing', ARRAY['laser','fraxel','co2 laser'], 400, 1500, 900),
  ('a1000000-0000-0000-0000-000000000001', 'Hydrafacial', ARRAY['hydra facial','hydrafacial deluxe'], 150, 300, 200),
  ('a1000000-0000-0000-0000-000000000001', 'PRP Hair Restoration', ARRAY['prp hair','platelet rich plasma'], 800, 1500, 1100);

-- ─── Services catalog: Miami Glow ────────────────────────────────────────────

INSERT INTO services_catalog (client_id, service_name, aliases, price_min, price_max, avg_price) VALUES
  ('a2000000-0000-0000-0000-000000000002', 'Botox', ARRAY['tox','dysport','neurotoxin'], 350, 750, 500),
  ('a2000000-0000-0000-0000-000000000002', 'Juvederm Filler', ARRAY['filler','dermal filler','juvederm'], 700, 1400, 1000),
  ('a2000000-0000-0000-0000-000000000002', 'IPL Photofacial', ARRAY['ipl','photofacial','light therapy'], 300, 600, 450),
  ('a2000000-0000-0000-0000-000000000002', 'Body Contouring', ARRAY['emsculpt','coolsculpt','cryolipolysis'], 600, 2000, 1200);

-- ─── Call logs: Luxe Aesthetics (25 calls over last 30 days) ─────────────────

INSERT INTO call_logs (
  client_id, external_call_id, caller_name, caller_phone,
  semantic_title, call_type, summary,
  duration_seconds, potential_revenue, booked_value, inquiries_value,
  is_booked, lead_confidence, is_lead, human_followup_needed,
  tags, created_at
) VALUES

-- Bookings (high value)
('a1000000-0000-0000-0000-000000000001', 'retell_lx_001', 'Ashley Monroe', '+13055550301',
 'Botox + Filler Consultation Booked', 'booking',
 'Ashley called to book her quarterly botox touch-up and inquired about lip filler for the first time. Scheduled for next Thursday at 2pm. Excited about the lip enhancement offer.',
 247, 1400, 1400, 0, TRUE, 0.95, TRUE, FALSE, ARRAY['botox','filler','repeat-client'],
 NOW() - INTERVAL '1 day'),

('a1000000-0000-0000-0000-000000000001', 'retell_lx_002', 'Jennifer Park', '+13055550302',
 'Laser Resurfacing Package — Full Face Booked', 'booking',
 'Jennifer is preparing for her wedding in 6 weeks. Booked full-face laser resurfacing package. Also interested in a hydrafacial series leading up to the event.',
 312, 1100, 900, 200, TRUE, 0.98, TRUE, FALSE, ARRAY['laser','wedding-prep','high-value'],
 NOW() - INTERVAL '2 days'),

('a1000000-0000-0000-0000-000000000001', 'retell_lx_003', 'Maria Santos', '+13055550303',
 'PRP Hair Restoration — Initial Consultation Booked', 'booking',
 'Maria has been experiencing hair thinning for 2 years. Very interested in PRP treatment. Booked for initial consultation and photo assessment.',
 198, 1100, 1100, 0, TRUE, 0.92, TRUE, FALSE, ARRAY['prp','hair-restoration','new-client'],
 NOW() - INTERVAL '4 days'),

('a1000000-0000-0000-0000-000000000001', 'retell_lx_004', 'Rachel Kim', '+13055550304',
 'Hydrafacial Series — 3 Sessions Booked', 'booking',
 'Rachel is visiting from NYC and wants to establish care locally. Booked 3-session hydrafacial package at discounted rate.',
 156, 600, 600, 0, TRUE, 0.97, TRUE, FALSE, ARRAY['hydrafacial','package','relocation-client'],
 NOW() - INTERVAL '6 days'),

('a1000000-0000-0000-0000-000000000001', 'retell_lx_005', 'Diana Walsh', '+13055550305',
 'Botox Appointment Confirmed for Tomorrow', 'booking',
 'Diana is a regular patient confirming her appointment scheduled for tomorrow. No changes needed.',
 87, 550, 550, 0, TRUE, 0.99, FALSE, FALSE, ARRAY['botox','confirmation','regular-client'],
 NOW() - INTERVAL '7 days'),

-- Inquiries (warm leads)
('a1000000-0000-0000-0000-000000000001', 'retell_lx_006', 'Taylor Nguyen', '+13055550306',
 'Filler Pricing and Before/After Photos Requested', 'inbound_inquiry',
 'Taylor is comparing medspa options and wants pricing details and before/after examples for lip and cheek filler. Sarah sent her the pricing guide and IG handle. Strong intent to book.',
 203, 850, 0, 850, FALSE, 0.78, TRUE, TRUE,
 ARRAY['filler','comparison-shopping','needs-followup'],
 NOW() - INTERVAL '3 days'),

('a1000000-0000-0000-0000-000000000001', 'retell_lx_007', 'Sophie Clark', '+13055550307',
 'Inquiry About Annual Membership Benefits', 'inbound_inquiry',
 'Sophie asked about the annual membership program. She is currently spending ~$2,400/year on botox and wants to know if a membership makes sense. High lifetime value prospect.',
 178, 2400, 0, 2400, FALSE, 0.71, TRUE, TRUE,
 ARRAY['membership','botox','high-ltv'],
 NOW() - INTERVAL '5 days'),

('a1000000-0000-0000-0000-000000000001', 'retell_lx_008', 'Amanda Foster', '+13055550308',
 'Post-Laser Recovery Questions', 'support',
 'Amanda had laser resurfacing last week and is concerned about peeling. Sarah reassured her this is normal healing. No clinical escalation needed.',
 134, 0, 0, 0, FALSE, NULL, FALSE, FALSE,
 ARRAY['post-care','laser','reassurance'],
 NOW() - INTERVAL '8 days'),

('a1000000-0000-0000-0000-000000000001', 'retell_lx_009', 'Lisa Chang', '+13055550309',
 'Bridal Party Package — Group Botox Event Interest', 'inbound_inquiry',
 'Lisa is a bride-to-be asking about group botox events for 6 people. Very high potential value. Sarah captured contact info and flagged for follow-up with provider.',
 267, 3300, 0, 3300, FALSE, 0.82, TRUE, TRUE,
 ARRAY['bridal','group-event','high-value'],
 NOW() - INTERVAL '9 days'),

('a1000000-0000-0000-0000-000000000001', 'retell_lx_010', 'Michelle Torres', '+13055550310',
 'Insurance and Financing Options for Laser', 'inbound_inquiry',
 'Michelle wants to know if laser resurfacing is covered by insurance (it is not) and whether Affirm or CareCredit is accepted.',
 145, 900, 0, 900, FALSE, 0.55, TRUE, FALSE,
 ARRAY['financing','laser','price-sensitive'],
 NOW() - INTERVAL '11 days'),

-- Reschedules
('a1000000-0000-0000-0000-000000000001', 'retell_lx_011', 'Karen Mitchell', '+13055550311',
 'Filler Appointment Rescheduled — Work Conflict', 'reschedule',
 'Karen needs to move her 3pm filler appointment to next week due to a work meeting. New time captured and passed to front desk.',
 98, 850, 850, 0, TRUE, NULL, FALSE, FALSE,
 ARRAY['filler','reschedule'],
 NOW() - INTERVAL '10 days'),

-- Cancellations
('a1000000-0000-0000-0000-000000000001', 'retell_lx_012', 'Unknown Caller', '+13055550312',
 'Botox Appointment Cancelled — Moving Out of State', 'cancellation',
 'Caller is moving to California and needs to cancel her upcoming botox appointment. No rebook opportunity. Friendly close.',
 112, 0, 0, 0, FALSE, NULL, FALSE, FALSE,
 ARRAY['cancellation','botox','churned'],
 NOW() - INTERVAL '13 days'),

-- Spam
('a1000000-0000-0000-0000-000000000001', 'retell_lx_013', NULL, '+13055550399',
 'Robocall — Extended Vehicle Warranty', 'spam',
 'Automated spam call. No action taken.',
 12, 0, 0, 0, FALSE, NULL, FALSE, FALSE,
 ARRAY['spam'],
 NOW() - INTERVAL '14 days'),

('a1000000-0000-0000-0000-000000000001', 'retell_lx_014', 'Emily Rodriguez', '+13055550314',
 'Hydrafacial Booking for Next Week', 'booking',
 'Emily wants to book a hydrafacial before an important event next weekend. Scheduled for Friday afternoon.',
 143, 200, 200, 0, TRUE, 0.96, TRUE, FALSE,
 ARRAY['hydrafacial','new-client'],
 NOW() - INTERVAL '15 days'),

('a1000000-0000-0000-0000-000000000001', 'retell_lx_015', 'Priya Sharma', '+13055550315',
 'Botox First Timer — Detailed Education Call', 'inbound_inquiry',
 'First-time caller with lots of questions about botox safety and longevity. Sarah walked her through the process. She wants to book but needs to check her schedule.',
 389, 550, 0, 550, FALSE, 0.68, TRUE, TRUE,
 ARRAY['botox','first-timer','education'],
 NOW() - INTERVAL '16 days'),

('a1000000-0000-0000-0000-000000000001', 'retell_lx_016', 'Chloe Bennett', '+13055550316',
 'Dysport vs Botox — Product Comparison Call', 'inbound_inquiry',
 'Chloe used Dysport at a previous medspa and wants to know if Luxe offers it. Explained differences and advantages of Botox. Likely to book.',
 231, 550, 0, 550, FALSE, 0.72, TRUE, FALSE,
 ARRAY['botox','dysport','product-question'],
 NOW() - INTERVAL '17 days'),

('a1000000-0000-0000-0000-000000000001', 'retell_lx_017', 'Olivia James', '+13055550317',
 'Post-Botox Concern — Asymmetry After Treatment', 'support',
 'Olivia received botox 2 weeks ago and feels one brow is slightly lower. Sarah escalated to provider for a complementary review appointment.',
 178, 0, 0, 0, FALSE, NULL, FALSE, TRUE,
 ARRAY['botox','post-care','escalation','support'],
 NOW() - INTERVAL '18 days'),

('a1000000-0000-0000-0000-000000000001', 'retell_lx_018', 'Hannah White', '+13055550318',
 'Filler + Botox Combo — Full Treatment Plan Booked', 'booking',
 'Hannah wants a comprehensive treatment plan including botox for forehead and filler for nasolabial folds. Budget approved. Full combo booked.',
 287, 1350, 1350, 0, TRUE, 0.97, TRUE, FALSE,
 ARRAY['botox','filler','combo','high-value'],
 NOW() - INTERVAL '19 days'),

('a1000000-0000-0000-0000-000000000001', 'retell_lx_019', NULL, '+13055550398',
 'Unknown — Hung Up Immediately', 'other',
 'Caller hung up within 5 seconds. No information captured.',
 5, 0, 0, 0, FALSE, NULL, FALSE, FALSE,
 ARRAY['hangup'],
 NOW() - INTERVAL '20 days'),

('a1000000-0000-0000-0000-000000000001', 'retell_lx_020', 'Sarah Johnson', '+13055550320',
 'Laser Resurfacing Consultation Booked — Acne Scars', 'booking',
 'Sarah has acne scarring from her teens and wants to understand her options. Booked for a laser consultation with the provider.',
 234, 900, 900, 0, TRUE, 0.89, TRUE, FALSE,
 ARRAY['laser','acne-scars','consultation'],
 NOW() - INTERVAL '22 days'),

('a1000000-0000-0000-0000-000000000001', 'retell_lx_021', 'Grace Lee', '+13055550321',
 'Annual Botox Refresh + New Filler Interest', 'booking',
 'Grace comes in twice a year for botox. This call she also expressed interest in undereye filler. Booked regular botox; filler consultation added to appointment.',
 198, 1100, 800, 300, TRUE, 0.96, TRUE, FALSE,
 ARRAY['botox','filler','regular-client'],
 NOW() - INTERVAL '24 days'),

('a1000000-0000-0000-0000-000000000001', 'retell_lx_022', 'Natalie Brown', '+13055550322',
 'Membership Pricing — Returning Client Inquiry', 'inbound_inquiry',
 'Natalie has been coming for years and wants to explore the membership to save money. Capture contact for team callback.',
 167, 2000, 0, 2000, FALSE, 0.65, TRUE, TRUE,
 ARRAY['membership','repeat-client'],
 NOW() - INTERVAL '25 days'),

('a1000000-0000-0000-0000-000000000001', 'retell_lx_023', 'Isabella Martin', '+13055550323',
 'Lip Filler Booked — Subtle Enhancement Request', 'booking',
 'Isabella wants a natural lip enhancement, nothing dramatic. Clear expectations set. Booked for next Tuesday.',
 176, 850, 850, 0, TRUE, 0.98, TRUE, FALSE,
 ARRAY['filler','lip','natural-look'],
 NOW() - INTERVAL '27 days'),

('a1000000-0000-0000-0000-000000000001', 'retell_lx_024', 'Emma Davis', '+13055550324',
 'Scalp PRP Interest — Hair Loss Concern', 'inbound_inquiry',
 'Emma is experiencing post-partum hair loss and interested in PRP. Needs to consult her OB first before proceeding. Follow-up in 2 weeks.',
 245, 1100, 0, 1100, FALSE, 0.61, TRUE, TRUE,
 ARRAY['prp','hair-loss','post-partum'],
 NOW() - INTERVAL '28 days'),

('a1000000-0000-0000-0000-000000000001', 'retell_lx_025', 'Sophia Wilson', '+13055550325',
 'Cheek Filler + Botox Package — New Patient Booked', 'booking',
 'Sophia found Luxe through a friend referral. Booked a comprehensive first-timer package: cheek filler + botox forehead. High confidence.',
 312, 1400, 1400, 0, TRUE, 0.97, TRUE, FALSE,
 ARRAY['filler','botox','referral','new-client'],
 NOW() - INTERVAL '29 days');

-- ─── Call logs: Miami Glow (18 calls over last 30 days) ──────────────────────

INSERT INTO call_logs (
  client_id, external_call_id, caller_name, caller_phone,
  semantic_title, call_type, summary,
  duration_seconds, potential_revenue, booked_value, inquiries_value,
  is_booked, lead_confidence, is_lead, human_followup_needed,
  tags, created_at
) VALUES

('a2000000-0000-0000-0000-000000000002', 'retell_mg_001', 'Jessica Alba', '+13055550401',
 'Body Contouring Package — 3 Sessions Booked', 'booking',
 'Jessica wants to target her abdomen and flanks before summer. Booked 3-session body contouring package.',
 287, 3600, 3600, 0, TRUE, 0.97, TRUE, FALSE,
 ARRAY['body-contouring','package','summer-prep'],
 NOW() - INTERVAL '1 day'),

('a2000000-0000-0000-0000-000000000002', 'retell_mg_002', 'Carmen Lopez', '+13055550402',
 'Botox and IPL Combination — Interest + Pricing', 'inbound_inquiry',
 'Carmen wants both botox and IPL photofacial. Comparing with another local medspa. Sent pricing and special offer.',
 198, 950, 0, 950, FALSE, 0.74, TRUE, TRUE,
 ARRAY['botox','ipl','comparison-shopping'],
 NOW() - INTERVAL '3 days'),

('a2000000-0000-0000-0000-000000000002', 'retell_mg_003', 'Ana Gonzalez', '+13055550403',
 'Juvederm Filler Consultation Booked', 'booking',
 'Ana wants to address marionette lines with Juvederm Voluma. Booked consultation with senior injector.',
 234, 1000, 1000, 0, TRUE, 0.95, TRUE, FALSE,
 ARRAY['filler','juvederm','consultation'],
 NOW() - INTERVAL '4 days'),

('a2000000-0000-0000-0000-000000000002', 'retell_mg_004', NULL, '+13055550499',
 'Spam — Marketing Robocall', 'spam',
 'Robocall for business marketing services. Blocked.',
 8, 0, 0, 0, FALSE, NULL, FALSE, FALSE,
 ARRAY['spam'],
 NOW() - INTERVAL '5 days'),

('a2000000-0000-0000-0000-000000000002', 'retell_mg_005', 'Rosa Herrera', '+13055550405',
 'Botox Touch-Up Appointment Rescheduled', 'reschedule',
 'Rosa moved her Friday 3pm botox to the following Monday. Updated in system.',
 78, 500, 500, 0, TRUE, NULL, FALSE, FALSE,
 ARRAY['botox','reschedule'],
 NOW() - INTERVAL '6 days'),

('a2000000-0000-0000-0000-000000000002', 'retell_mg_006', 'Patricia Suarez', '+13055550406',
 'IPL Series for Sun Damage — Package Booked', 'booking',
 'Patricia has significant sun damage from years of outdoor activity. Booked 4-session IPL series.',
 267, 1800, 1800, 0, TRUE, 0.96, TRUE, FALSE,
 ARRAY['ipl','sun-damage','package'],
 NOW() - INTERVAL '8 days'),

('a2000000-0000-0000-0000-000000000002', 'retell_mg_007', 'Monica Reyes', '+13055550407',
 'First-Timer Botox — Nervous About Pain', 'inbound_inquiry',
 'Monica is anxious about getting botox for the first time. Sarah provided detailed reassurance, explained numbing protocol. High intent but needs more time.',
 356, 500, 0, 500, FALSE, 0.62, TRUE, TRUE,
 ARRAY['botox','first-timer','anxiety','nurture'],
 NOW() - INTERVAL '9 days'),

('a2000000-0000-0000-0000-000000000002', 'retell_mg_008', 'Daniela Cruz', '+13055550408',
 'Botox Booked — Quarterly Regular', 'booking',
 'Daniela calls every 3 months for her botox. Confirmed appointment for next week.',
 98, 500, 500, 0, TRUE, 0.99, FALSE, FALSE,
 ARRAY['botox','regular-client','quarterly'],
 NOW() - INTERVAL '11 days'),

('a2000000-0000-0000-0000-000000000002', 'retell_mg_009', 'Sofia Mendez', '+13055550409',
 'Body Contouring Inquiry — Post Baby Weight', 'inbound_inquiry',
 'Sofia is 8 months postpartum and interested in body contouring for her stomach. Needs physician clearance first. Follow-up scheduled.',
 234, 1200, 0, 1200, FALSE, 0.69, TRUE, TRUE,
 ARRAY['body-contouring','postpartum','needs-clearance'],
 NOW() - INTERVAL '12 days'),

('a2000000-0000-0000-0000-000000000002', 'retell_mg_010', 'Valentina Torres', '+13055550410',
 'Full Face Filler + Botox — Bridal Prep Booked', 'booking',
 'Valentina is getting married in 8 weeks. Booked full-face filler and botox refresh for bridal prep. Very excited.',
 312, 1500, 1500, 0, TRUE, 0.98, TRUE, FALSE,
 ARRAY['filler','botox','bridal','high-value'],
 NOW() - INTERVAL '14 days'),

('a2000000-0000-0000-0000-000000000002', 'retell_mg_011', 'Isabella Fernandez', '+13055550411',
 'Reaction Concern After IPL — Redness', 'support',
 'Isabella is experiencing prolonged redness 3 days after her IPL treatment. Sarah advised on skincare protocol and flagged for provider review.',
 189, 0, 0, 0, FALSE, NULL, FALSE, TRUE,
 ARRAY['ipl','reaction','support','escalation'],
 NOW() - INTERVAL '15 days'),

('a2000000-0000-0000-0000-000000000002', 'retell_mg_012', 'Elena Rodriguez', '+13055550412',
 'Botox Cancellation — Budget Constraints', 'cancellation',
 'Elena needs to cancel her upcoming appointment due to unexpected expenses. Interested in booking again in 2-3 months.',
 123, 0, 0, 0, FALSE, NULL, FALSE, FALSE,
 ARRAY['cancellation','botox','budget-sensitive'],
 NOW() - INTERVAL '17 days'),

('a2000000-0000-0000-0000-000000000002', 'retell_mg_013', 'Adriana Silva', '+13055550413',
 'Juvederm Lip Filler Booked — Natural Enhancement', 'booking',
 'Adriana wants a subtle lip enhancement for her 40th birthday. Booked for Juvederm Volbella.',
 198, 1000, 1000, 0, TRUE, 0.97, TRUE, FALSE,
 ARRAY['filler','lip','juvederm','birthday'],
 NOW() - INTERVAL '18 days'),

('a2000000-0000-0000-0000-000000000002', 'retell_mg_014', 'Camila Morales', '+13055550414',
 'Combo Treatment Interest — Botox + Body', 'inbound_inquiry',
 'Camila wants to do a full day of treatments — botox in the morning and body contouring in the afternoon. Interested in package pricing.',
 278, 2000, 0, 2000, FALSE, 0.79, TRUE, TRUE,
 ARRAY['botox','body-contouring','combo','package-interest'],
 NOW() - INTERVAL '20 days'),

('a2000000-0000-0000-0000-000000000002', 'retell_mg_015', 'Lucia Ramirez', '+13055550415',
 'IPL for Rosacea — Targeted Treatment Booked', 'booking',
 'Lucia has been dealing with rosacea for years and heard IPL can help. Booked targeted IPL treatment series after Sarah explained the protocol.',
 245, 900, 900, 0, TRUE, 0.94, TRUE, FALSE,
 ARRAY['ipl','rosacea','new-client'],
 NOW() - INTERVAL '22 days'),

('a2000000-0000-0000-0000-000000000002', 'retell_mg_016', 'Gabriela Vega', '+13055550416',
 'Botox Pricing Question — New Area Inquiry', 'inbound_inquiry',
 'Gabriela wants to know the price for a new area — masseter (jaw slimming). Sarah provided pricing and explained the procedure.',
 167, 600, 0, 600, FALSE, 0.66, TRUE, FALSE,
 ARRAY['botox','masseter','jaw-slimming','new-area'],
 NOW() - INTERVAL '24 days'),

('a2000000-0000-0000-0000-000000000002', 'retell_mg_017', 'Martina Castro', '+13055550417',
 'Body Contouring Booked — Thigh Area', 'booking',
 'Martina has been wanting to address her inner thighs. Booked 2-session contouring package after a detailed consultation call.',
 287, 2400, 2400, 0, TRUE, 0.96, TRUE, FALSE,
 ARRAY['body-contouring','thighs','package'],
 NOW() - INTERVAL '26 days'),

('a2000000-0000-0000-0000-000000000002', 'retell_mg_018', 'Natalia Jimenez', '+13055550418',
 'Filler Inquiry — Budget Conscious First Timer', 'inbound_inquiry',
 'Natalia is interested in cheek filler but concerned about the price. Sarah explained the value and longevity. Sent information package.',
 212, 1000, 0, 1000, FALSE, 0.54, TRUE, FALSE,
 ARRAY['filler','first-timer','price-sensitive'],
 NOW() - INTERVAL '29 days');
