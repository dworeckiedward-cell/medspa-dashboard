-- Migration 002: Full unique index for idempotent webhook upsert
--
-- Enables safe ON CONFLICT (client_id, external_call_id) in PostgREST/Supabase.
-- A partial index (WHERE external_call_id IS NOT NULL) would cause PostgREST
-- to fail because it cannot supply the WHERE predicate in the ON CONFLICT clause.
-- A full unique index works because PostgreSQL treats NULL as non-equal,
-- so multiple rows with external_call_id IS NULL are still permitted.

drop index if exists public.call_logs_client_external_uniq;
drop index if exists public.call_logs_external_call_id_unique;

create unique index if not exists call_logs_client_external_uniq
  on public.call_logs (client_id, external_call_id);
