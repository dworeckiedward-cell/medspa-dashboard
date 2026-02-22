/**
 * Chat / Conversations domain types.
 *
 * Models chat conversations from SMS, Instagram, and WhatsApp channels.
 * The chatbot backend runs in n8n / ManyChat — this dashboard layer
 * only visualizes and stores results for ROI visibility.
 *
 * ── Wording conventions ────────────────────────────────────────────────
 *   "Conversation" = a thread with a contact on a chat channel
 *   "Chat lead"    = a lead captured from a chat conversation
 *   "Chat booking" = a booking attributed to a chat conversation
 */

// ── Channel ─────────────────────────────────────────────────────────────

export type ChatChannel = 'sms' | 'instagram' | 'whatsapp'

// ── Source system ────────────────────────────────────────────────────────

export type SourceSystem = 'manychat' | 'n8n' | 'twilio' | 'meta' | 'webhook' | 'manual' | 'unknown'

// ── Conversation status ─────────────────────────────────────────────────

export type ConversationStatus =
  | 'new'
  | 'active'
  | 'qualified'
  | 'booked'
  | 'closed_won'
  | 'closed_lost'
  | 'spam'

// ── Lead status ─────────────────────────────────────────────────────────

export type ChatLeadStatus = 'new' | 'qualified' | 'booked' | 'lost'

// ── Booking outcome ─────────────────────────────────────────────────────

export type BookingOutcome = 'none' | 'pending' | 'booked' | 'canceled' | 'no_show'

// ── Message direction ───────────────────────────────────────────────────

export type MessageDirection = 'inbound' | 'outbound' | 'system'

// ── Sender type ─────────────────────────────────────────────────────────

export type SenderType = 'lead' | 'ai' | 'staff' | 'system' | 'unknown'

// ── Message type ────────────────────────────────────────────────────────

export type MessageType = 'text' | 'image' | 'audio' | 'file' | 'system' | 'other'

// ── Message status ──────────────────────────────────────────────────────

export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed' | 'received' | 'processed'

// ── Conversation entity ─────────────────────────────────────────────────

export interface ChatConversation {
  id: string
  clientId: string
  channel: ChatChannel
  externalThreadId: string | null
  externalPlatform: string | null // manychat, twilio, whatsapp_cloud, etc.
  contactName: string | null
  contactPhone: string | null
  contactHandle: string | null // IG handle, etc.
  status: ConversationStatus
  lastMessagePreview: string | null
  lastMessageAt: string | null
  firstMessageAt: string | null
  sourceCampaign: string | null
  externalUrl: string | null // ManyChat/CRM deep link
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
  // Enhanced fields (016)
  directionLast: MessageDirection | null
  sourceSystem: SourceSystem | null
  assignedTo: string | null
  unreadCount: number
  messageCount: number
}

// ── Chat message ────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  conversationId: string
  clientId: string
  direction: MessageDirection
  messageText: string | null
  mediaUrl: string | null
  sentAt: string
  providerMessageId: string | null
  metadata: Record<string, unknown>
  createdAt: string
  // Enhanced fields (016)
  senderType: SenderType | null
  senderName: string | null
  messageType: MessageType
  deliveredAt: string | null
  readAt: string | null
  failedAt: string | null
  status: MessageStatus
}

// ── Chat lead ───────────────────────────────────────────────────────────

export interface ChatLead {
  id: string
  clientId: string
  conversationId: string | null
  name: string | null
  phone: string | null
  email: string | null
  interestService: string | null
  status: ChatLeadStatus
  booked: boolean
  bookingId: string | null
  externalBookingId: string | null
  bookedAt: string | null
  attributedRevenue: number | null
  createdAt: string
  updatedAt: string
}

// ── Conversation with lead/booking info (for list view) ──────────────────

export interface ConversationWithDetails extends ChatConversation {
  lead: ChatLead | null
  bookingOutcome: BookingOutcome
}

// ── Conversations KPI summary ───────────────────────────────────────────

export interface ConversationsKpiSummary {
  totalConversations: number
  chatLeadsCaptured: number
  chatBookings: number
  chatBookingRate: number // 0–100
  channelBreakdown: Record<ChatChannel, number>
  statusBreakdown: Record<ConversationStatus, number>
  unreadConversations: number
  openConversations: number
}

// ── Channel attribution stats ──────────────────────────────────────────

export interface ChannelAttribution {
  channel: ChatChannel
  conversations: number
  leads: number
  bookings: number
  revenue: number
  conversionRate: number // leads->bookings as 0–100
}

// ── View preset for inbox filters ──────────────────────────────────────

export type InboxViewPreset = 'all' | 'inbound' | 'outbound' | 'chatbot' | 'needs_review' | 'booked'

// ── Webhook event types (for ingest) ────────────────────────────────────

export type ChatEventType =
  | 'conversation_upsert'
  | 'message_append'
  | 'lead_capture'
  | 'booking_outcome'

export interface ChatWebhookEvent {
  eventType: ChatEventType
  clientId: string
  externalThreadId: string
  channel: ChatChannel
  payload: Record<string, unknown>
  timestamp: string
}
