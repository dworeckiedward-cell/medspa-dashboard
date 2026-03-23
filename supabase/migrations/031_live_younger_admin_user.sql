-- ============================================================================
-- Migration 031: Admin user for Live Younger tenant
--
-- Creates a workspace invite for dworeckiedward@gmail.com as admin
-- on the live-younger tenant.
--
-- After deploy, complete these steps in Supabase Dashboard:
--   1. Go to Authentication → Users → "Invite user"
--   2. Enter: dworeckiedward@gmail.com
--   3. User accepts invite email → creates auth.users row
--   4. Run the POST-SIGNUP block below with the real user UUID
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ── Step 1: Create workspace invite ─────────────────────────────────────────

DO $$
DECLARE
  v_client_id uuid;
  v_token     text;
BEGIN
  SELECT id INTO v_client_id FROM public.clients WHERE slug = 'live-younger';

  IF v_client_id IS NULL THEN
    RAISE NOTICE 'live-younger tenant not found — skipping invite creation';
    RETURN;
  END IF;

  -- Generate a secure random token
  v_token := encode(gen_random_bytes(32), 'hex');

  -- Upsert: create or update existing invite
  INSERT INTO public.workspace_invites (
    client_id, email, role, status,
    invited_by, inviter_email, token, expires_at
  ) VALUES (
    v_client_id,
    'dworeckiedward@gmail.com',
    'admin',
    'pending',
    '00000000-0000-0000-0000-000000000000',  -- system
    'system@servifylabs.com',
    v_token,
    NOW() + INTERVAL '90 days'
  )
  ON CONFLICT ON CONSTRAINT workspace_invites_token_key DO NOTHING;

  -- Also create owner invite for Dr. Natasha (placeholder — email TBD)
  -- Will be updated when we have her email address

  RAISE NOTICE 'Workspace invite created for dworeckiedward@gmail.com on live-younger (token: %)', v_token;
END $$;

-- ── Step 2: Auto-map user on signup (trigger) ───────────────────────────────
-- This function checks workspace_invites when a new user signs up.
-- If a pending invite matches their email, it auto-creates the user_tenants
-- row and marks the invite as accepted.

CREATE OR REPLACE FUNCTION public.auto_accept_workspace_invite()
RETURNS TRIGGER AS $$
DECLARE
  v_invite RECORD;
BEGIN
  -- Check for pending invites matching this user's email
  FOR v_invite IN
    SELECT id, client_id, role
    FROM public.workspace_invites
    WHERE email = LOWER(NEW.email)
      AND status = 'pending'
      AND expires_at > NOW()
  LOOP
    -- Create user_tenants mapping
    INSERT INTO public.user_tenants (user_id, client_id, role)
    VALUES (NEW.id, v_invite.client_id, v_invite.role)
    ON CONFLICT (user_id, client_id) DO UPDATE SET role = EXCLUDED.role;

    -- Mark invite as accepted
    UPDATE public.workspace_invites
    SET status = 'accepted', accepted_at = NOW()
    WHERE id = v_invite.id;

    RAISE NOTICE 'Auto-accepted workspace invite % for user %', v_invite.id, NEW.email;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users (fires after insert = after signup)
DROP TRIGGER IF EXISTS on_auth_user_created_accept_invites ON auth.users;
CREATE TRIGGER on_auth_user_created_accept_invites
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_accept_workspace_invite();

-- ============================================================================
-- POST-SIGNUP: Run this AFTER the user has signed up via Supabase Dashboard.
-- Replace <USER_UUID> with the actual UUID from auth.users.
--
-- If the trigger above works correctly, this should NOT be needed.
-- It's here as a manual fallback.
--
--   DO $$
--   DECLARE
--     v_client_id uuid;
--     v_user_id   uuid := '<USER_UUID>';  -- Replace with real UUID
--   BEGIN
--     SELECT id INTO v_client_id FROM public.clients WHERE slug = 'live-younger';
--
--     INSERT INTO public.user_tenants (user_id, client_id, role)
--     VALUES (v_user_id, v_client_id, 'admin')
--     ON CONFLICT (user_id, client_id) DO UPDATE SET role = 'admin';
--
--     UPDATE public.workspace_invites
--     SET status = 'accepted', accepted_at = NOW()
--     WHERE client_id = v_client_id
--       AND email = 'dworeckiedward@gmail.com'
--       AND status = 'pending';
--   END $$;
-- ============================================================================
