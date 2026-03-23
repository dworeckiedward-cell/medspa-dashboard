-- 028: Wallet system — usage-based billing via available_seconds.
--
-- Each client has a bucket of pre-paid seconds. Calls decrement this balance.
-- When balance hits 0, outbound call initiation is blocked (guardrail in app layer).

-- Add available_seconds column with a safe default
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS available_seconds integer NOT NULL DEFAULT 0;

-- Backfill: grant 300 minutes (18 000 s) to all existing clients so their
-- service is not interrupted by this migration.
UPDATE public.clients
  SET available_seconds = 18000
  WHERE available_seconds = 0;

-- Prevent negative balance at the DB level.
-- The app layer also enforces this, but a CHECK constraint is a safety net.
DO $$ BEGIN
  ALTER TABLE public.clients
    ADD CONSTRAINT clients_available_seconds_nonneg
    CHECK (available_seconds >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RPC function for atomic wallet decrement (avoids race conditions).
-- Clamps at 0 via GREATEST so the CHECK constraint is never violated.
CREATE OR REPLACE FUNCTION public.decrement_wallet(
  p_client_id uuid,
  p_seconds integer
) RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.clients
  SET available_seconds = GREATEST(0, available_seconds - p_seconds),
      updated_at = now()
  WHERE id = p_client_id;
$$;
