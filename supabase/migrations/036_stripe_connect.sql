-- ============================================================================
-- Migration 036: Stripe Connect — Payment Columns
-- ============================================================================

-- Add Stripe Connect fields to clients table
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS platform_fee_percent decimal(5,2) NOT NULL DEFAULT 5.0;

-- Add Stripe payment tracking columns back to bookings table
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id text,
  ADD COLUMN IF NOT EXISTS no_show_fee_cents int NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS no_show_charged boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN clients.stripe_connect_account_id IS 'Stripe Connect Express account ID (acct_xxx)';
COMMENT ON COLUMN clients.stripe_connect_onboarded IS 'True when clinic completed Stripe Connect onboarding';
COMMENT ON COLUMN clients.platform_fee_percent IS 'Platform fee % taken from each booking (default 5%)';
COMMENT ON COLUMN bookings.stripe_session_id IS 'Stripe Checkout Session ID';
COMMENT ON COLUMN bookings.stripe_payment_intent_id IS 'Stripe PaymentIntent ID';
COMMENT ON COLUMN bookings.stripe_customer_id IS 'Stripe Customer ID (platform account)';
COMMENT ON COLUMN bookings.stripe_payment_method_id IS 'Saved payment method ID for no-show charges';
COMMENT ON COLUMN bookings.no_show_fee_cents IS 'No-show fee in cents (default 5000 = $50 CAD)';
COMMENT ON COLUMN bookings.no_show_charged IS 'True when no-show fee has been charged';
