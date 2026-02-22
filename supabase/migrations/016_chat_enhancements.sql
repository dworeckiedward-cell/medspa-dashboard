-- ============================================================================
-- Migration 016: Chat Conversations Enhancements
-- ============================================================================
-- Adds missing columns to chat_conversations and chat_messages tables
-- for richer inbox UX: unread tracking, sender type, message status,
-- assignment, and direction tracking.
-- ============================================================================

-- ── chat_conversations enhancements ───────────────────────────────────────────

ALTER TABLE chat_conversations
  ADD COLUMN IF NOT EXISTS direction_last text CHECK (direction_last IS NULL OR direction_last IN ('inbound', 'outbound', 'system')),
  ADD COLUMN IF NOT EXISTS source_system text CHECK (source_system IS NULL OR source_system IN ('manychat', 'n8n', 'twilio', 'meta', 'webhook', 'manual', 'unknown')),
  ADD COLUMN IF NOT EXISTS assigned_to text,
  ADD COLUMN IF NOT EXISTS unread_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS message_count integer NOT NULL DEFAULT 0;

-- Index for unread backlog queries
CREATE INDEX IF NOT EXISTS idx_chat_conv_unread
  ON chat_conversations(client_id, unread_count)
  WHERE unread_count > 0;

-- ── chat_messages enhancements ────────────────────────────────────────────────

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS sender_type text CHECK (sender_type IS NULL OR sender_type IN ('lead', 'ai', 'staff', 'system', 'unknown')),
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'file', 'system', 'other')),
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'received' CHECK (status IN ('sent', 'delivered', 'read', 'failed', 'received', 'processed'));
