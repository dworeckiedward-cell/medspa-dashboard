-- ============================================================================
-- Migration 015: Chat Conversations + Messages + Leads
-- ============================================================================
-- Supports the read-only Conversations MVP module.
-- Chat automation runs in n8n / ManyChat; this schema stores results
-- for dashboard visibility and ROI attribution.
-- ============================================================================

-- ── Chat conversations ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  channel         text NOT NULL CHECK (channel IN ('sms', 'instagram', 'whatsapp')),
  external_thread_id text,
  external_platform  text,  -- manychat, twilio, whatsapp_cloud, etc.
  contact_name    text,
  contact_phone   text,
  contact_handle  text,     -- IG handle, etc.
  status          text NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new', 'active', 'qualified', 'booked', 'closed_won', 'closed_lost', 'spam')),
  last_message_preview text,
  last_message_at timestamptz,
  first_message_at timestamptz,
  source_campaign text,
  external_url    text,     -- ManyChat / CRM deep link
  metadata        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_chat_conv_client ON chat_conversations(client_id);
-- Status filtering
CREATE INDEX IF NOT EXISTS idx_chat_conv_client_status ON chat_conversations(client_id, status);
-- Recent activity sort
CREATE INDEX IF NOT EXISTS idx_chat_conv_last_msg ON chat_conversations(client_id, last_message_at DESC);
-- External thread dedup
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_conv_ext_thread
  ON chat_conversations(client_id, external_thread_id)
  WHERE external_thread_id IS NOT NULL;

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

-- ── Chat messages ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  client_id           uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  direction           text NOT NULL CHECK (direction IN ('inbound', 'outbound', 'system')),
  message_text        text,
  media_url           text,
  sent_at             timestamptz NOT NULL,
  provider_message_id text,
  metadata            jsonb NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Conversation timeline
CREATE INDEX IF NOT EXISTS idx_chat_msg_conv ON chat_messages(conversation_id, sent_at);
-- Tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_chat_msg_client ON chat_messages(client_id);
-- Provider dedup
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_msg_provider
  ON chat_messages(conversation_id, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- ── Chat leads ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_leads (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  conversation_id     uuid REFERENCES chat_conversations(id) ON DELETE SET NULL,
  name                text,
  phone               text,
  email               text,
  interest_service    text,
  status              text NOT NULL DEFAULT 'new'
                      CHECK (status IN ('new', 'qualified', 'booked', 'lost')),
  booked              boolean NOT NULL DEFAULT false,
  booking_id          text,
  external_booking_id text,
  booked_at           timestamptz,
  attributed_revenue  numeric,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_chat_leads_client ON chat_leads(client_id);
-- Conversation linkage
CREATE INDEX IF NOT EXISTS idx_chat_leads_conv ON chat_leads(conversation_id);

ALTER TABLE chat_leads ENABLE ROW LEVEL SECURITY;
