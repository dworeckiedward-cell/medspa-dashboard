-- Migration 006: AI summary pipeline fields on call_logs
-- summary_status tracks ingestion state; summary_updated_at records when the
-- last summary payload was applied (for stale-check polling, UI badges, etc.).

alter table public.call_logs
  add column if not exists summary_status      text        null,
  add column if not exists summary_updated_at  timestamptz null;

-- Partial index to cheaply find calls that still need AI summary processing
create index if not exists idx_call_logs_client_summary_pending
  on public.call_logs (client_id, created_at desc)
  where summary_status = 'pending';
