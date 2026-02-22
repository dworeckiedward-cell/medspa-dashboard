/**
 * Chat Mutations — write operations for conversations, messages, and leads.
 *
 * Server-only. Uses service-role client (bypasses RLS).
 * All operations are tenant-scoped via client_id.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type {
  ChatChannel,
  ConversationStatus,
  ChatLeadStatus,
  MessageDirection,
  SenderType,
  MessageType,
  SourceSystem,
} from './types'

// ── Conversation upsert ─────────────────────────────────────────────────────

export interface UpsertConversationInput {
  clientId: string
  channel: ChatChannel
  externalThreadId?: string | null
  externalPlatform?: string | null
  contactName?: string | null
  contactPhone?: string | null
  contactHandle?: string | null
  status?: ConversationStatus
  lastMessagePreview?: string | null
  lastMessageAt?: string | null
  firstMessageAt?: string | null
  sourceCampaign?: string | null
  externalUrl?: string | null
  metadata?: Record<string, unknown>
  sourceSystem?: SourceSystem | null
  assignedTo?: string | null
}

export async function upsertConversation(
  input: UpsertConversationInput,
): Promise<{ success: boolean; conversationId?: string; error?: string }> {
  const supabase = createSupabaseServerClient()
  const now = new Date().toISOString()

  // If external_thread_id is provided, try to find existing conversation
  if (input.externalThreadId) {
    const { data: existing } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('client_id', input.clientId)
      .eq('external_thread_id', input.externalThreadId)
      .maybeSingle()

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('chat_conversations')
        .update({
          contact_name: input.contactName ?? undefined,
          contact_phone: input.contactPhone ?? undefined,
          contact_handle: input.contactHandle ?? undefined,
          status: input.status ?? undefined,
          last_message_preview: input.lastMessagePreview ?? undefined,
          last_message_at: input.lastMessageAt ?? undefined,
          source_campaign: input.sourceCampaign ?? undefined,
          external_url: input.externalUrl ?? undefined,
          metadata: input.metadata ?? undefined,
          source_system: input.sourceSystem ?? undefined,
          assigned_to: input.assignedTo ?? undefined,
          updated_at: now,
        })
        .eq('id', existing.id)

      if (error) {
        console.error('[chat] update conversation error:', error.message)
        return { success: false, error: error.message }
      }
      return { success: true, conversationId: existing.id }
    }
  }

  // Insert new
  const { data, error } = await supabase
    .from('chat_conversations')
    .insert({
      client_id: input.clientId,
      channel: input.channel,
      external_thread_id: input.externalThreadId ?? null,
      external_platform: input.externalPlatform ?? null,
      contact_name: input.contactName ?? null,
      contact_phone: input.contactPhone ?? null,
      contact_handle: input.contactHandle ?? null,
      status: input.status ?? 'new',
      last_message_preview: input.lastMessagePreview ?? null,
      last_message_at: input.lastMessageAt ?? now,
      first_message_at: input.firstMessageAt ?? now,
      source_campaign: input.sourceCampaign ?? null,
      external_url: input.externalUrl ?? null,
      metadata: input.metadata ?? {},
      source_system: input.sourceSystem ?? null,
      assigned_to: input.assignedTo ?? null,
      unread_count: 0,
      message_count: 0,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[chat] insert conversation error:', error.message)
    return { success: false, error: error.message }
  }

  return { success: true, conversationId: data.id }
}

// ── Append message ──────────────────────────────────────────────────────────

export interface AppendMessageInput {
  conversationId: string
  clientId: string
  direction: MessageDirection
  messageText?: string | null
  mediaUrl?: string | null
  sentAt?: string
  providerMessageId?: string | null
  metadata?: Record<string, unknown>
  senderType?: SenderType | null
  senderName?: string | null
  messageType?: MessageType
}

export async function appendMessage(
  input: AppendMessageInput,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const supabase = createSupabaseServerClient()
  const now = new Date().toISOString()
  const sentAt = input.sentAt ?? now

  // Check idempotency via provider_message_id
  if (input.providerMessageId) {
    const { data: existing } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('conversation_id', input.conversationId)
      .eq('provider_message_id', input.providerMessageId)
      .maybeSingle()

    if (existing) {
      return { success: true, messageId: existing.id }
    }
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      conversation_id: input.conversationId,
      client_id: input.clientId,
      direction: input.direction,
      message_text: input.messageText ?? null,
      media_url: input.mediaUrl ?? null,
      sent_at: sentAt,
      provider_message_id: input.providerMessageId ?? null,
      metadata: input.metadata ?? {},
      sender_type: input.senderType ?? (input.direction === 'inbound' ? 'lead' : 'ai'),
      sender_name: input.senderName ?? null,
      message_type: input.messageType ?? 'text',
      status: input.direction === 'inbound' ? 'received' : 'sent',
      created_at: now,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[chat] insert message error:', error.message)
    return { success: false, error: error.message }
  }

  // Update conversation aggregates
  const preview = (input.messageText ?? '').slice(0, 200)
  const isInbound = input.direction === 'inbound'

  // Use RPC-style increment for unread_count + message_count to avoid races
  // Fallback: read-then-write (safe enough for MVP ingestion rates)
  const { data: convRow } = await supabase
    .from('chat_conversations')
    .select('message_count, unread_count')
    .eq('id', input.conversationId)
    .single()

  await supabase
    .from('chat_conversations')
    .update({
      last_message_preview: preview || null,
      last_message_at: sentAt,
      direction_last: input.direction,
      status: 'active',
      message_count: (convRow?.message_count ?? 0) + 1,
      unread_count: isInbound ? (convRow?.unread_count ?? 0) + 1 : (convRow?.unread_count ?? 0),
      updated_at: now,
    })
    .eq('id', input.conversationId)

  return { success: true, messageId: data.id }
}

// ── Update conversation status ──────────────────────────────────────────────

export async function updateConversationStatus(
  clientId: string,
  conversationId: string,
  status: ConversationStatus,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseServerClient()

  const { error } = await supabase
    .from('chat_conversations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', conversationId)
    .eq('client_id', clientId)

  if (error) {
    console.error('[chat] update status error:', error.message)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// ── Mark conversation read ──────────────────────────────────────────────────

export async function markConversationRead(
  clientId: string,
  conversationId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseServerClient()

  const { error } = await supabase
    .from('chat_conversations')
    .update({ unread_count: 0, updated_at: new Date().toISOString() })
    .eq('id', conversationId)
    .eq('client_id', clientId)

  if (error) {
    console.error('[chat] mark read error:', error.message)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// ── Capture lead ────────────────────────────────────────────────────────────

export interface CaptureLeadInput {
  clientId: string
  conversationId?: string | null
  name?: string | null
  phone?: string | null
  email?: string | null
  interestService?: string | null
  status?: ChatLeadStatus
}

export async function captureLead(
  input: CaptureLeadInput,
): Promise<{ success: boolean; leadId?: string; error?: string }> {
  const supabase = createSupabaseServerClient()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('chat_leads')
    .insert({
      client_id: input.clientId,
      conversation_id: input.conversationId ?? null,
      name: input.name ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      interest_service: input.interestService ?? null,
      status: input.status ?? 'new',
      booked: false,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[chat] capture lead error:', error.message)
    return { success: false, error: error.message }
  }

  // Update conversation status to qualified if linked
  if (input.conversationId) {
    await supabase
      .from('chat_conversations')
      .update({ status: 'qualified', updated_at: now })
      .eq('id', input.conversationId)
  }

  return { success: true, leadId: data.id }
}

// ── Record booking outcome ──────────────────────────────────────────────────

export interface BookingOutcomeInput {
  clientId: string
  conversationId?: string | null
  leadId?: string | null
  bookingId?: string | null
  externalBookingId?: string | null
  bookedAt?: string | null
  attributedRevenue?: number | null
}

export async function recordBookingOutcome(
  input: BookingOutcomeInput,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseServerClient()
  const now = new Date().toISOString()

  // Update lead if provided
  if (input.leadId) {
    await supabase
      .from('chat_leads')
      .update({
        booked: true,
        status: 'booked',
        booking_id: input.bookingId ?? null,
        external_booking_id: input.externalBookingId ?? null,
        booked_at: input.bookedAt ?? now,
        attributed_revenue: input.attributedRevenue ?? null,
        updated_at: now,
      })
      .eq('id', input.leadId)
      .eq('client_id', input.clientId)
  }

  // Update conversation status
  if (input.conversationId) {
    await supabase
      .from('chat_conversations')
      .update({ status: 'booked', updated_at: now })
      .eq('id', input.conversationId)
      .eq('client_id', input.clientId)
  }

  return { success: true }
}
