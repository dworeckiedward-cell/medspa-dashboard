/**
 * /api/webhooks/chat-events — POST ingest chat events from n8n / ManyChat.
 *
 * Supports event types:
 *   - conversation_upsert: Create or update a conversation thread
 *   - message_append: Add a message to a conversation
 *   - lead_capture: Create a lead record from a conversation
 *   - booking_outcome: Record a booking attributed to a conversation
 *
 * Auth: Bearer token via WEBHOOK_API_KEY env var.
 * Idempotent: Uses external IDs for deduplication where possible.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { env } from '@/lib/env'
import { safeCompare } from '@/lib/auth/timing-safe'
import { rateLimit, webhookLimiter } from '@/lib/api/rate-limit'
import {
  upsertConversation,
  appendMessage,
  captureLead,
  recordBookingOutcome,
} from '@/lib/chat/mutations'

// ── Auth ────────────────────────────────────────────────────────────────────

function validateWebhookAuth(request: Request): boolean {
  const key = env.WEBHOOK_API_KEY
  if (!key) return false // no key configured = reject all

  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader

  return safeCompare(token, key)
}

// ── Schemas ─────────────────────────────────────────────────────────────────

const ChannelSchema = z.enum(['sms', 'instagram', 'whatsapp'])
const DirectionSchema = z.enum(['inbound', 'outbound', 'system'])

const ConversationUpsertSchema = z.object({
  eventType: z.literal('conversation_upsert'),
  clientId: z.string().uuid(),
  channel: ChannelSchema,
  externalThreadId: z.string().optional(),
  externalPlatform: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactHandle: z.string().optional(),
  status: z.enum(['new', 'active', 'qualified', 'booked', 'closed_won', 'closed_lost', 'spam']).optional(),
  lastMessagePreview: z.string().optional(),
  lastMessageAt: z.string().optional(),
  firstMessageAt: z.string().optional(),
  sourceCampaign: z.string().optional(),
  externalUrl: z.string().optional(),
  sourceSystem: z.enum(['manychat', 'n8n', 'twilio', 'meta', 'webhook', 'manual', 'unknown']).optional(),
  assignedTo: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const MessageAppendSchema = z.object({
  eventType: z.literal('message_append'),
  clientId: z.string().uuid(),
  conversationId: z.string().uuid(),
  direction: DirectionSchema,
  messageText: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  sentAt: z.string().optional(),
  providerMessageId: z.string().optional(),
  senderType: z.enum(['lead', 'ai', 'staff', 'system', 'unknown']).optional(),
  senderName: z.string().optional(),
  messageType: z.enum(['text', 'image', 'audio', 'file', 'system', 'other']).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const LeadCaptureSchema = z.object({
  eventType: z.literal('lead_capture'),
  clientId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  interestService: z.string().optional(),
  status: z.enum(['new', 'qualified', 'booked', 'lost']).optional(),
})

const BookingOutcomeSchema = z.object({
  eventType: z.literal('booking_outcome'),
  clientId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  bookingId: z.string().optional(),
  externalBookingId: z.string().optional(),
  bookedAt: z.string().optional(),
  attributedRevenue: z.number().optional(),
})

const EventSchema = z.discriminatedUnion('eventType', [
  ConversationUpsertSchema,
  MessageAppendSchema,
  LeadCaptureSchema,
  BookingOutcomeSchema,
])

// ── Route handler ───────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // Rate limit
  const limited = rateLimit(request, webhookLimiter)
  if (limited) return limited

  // Auth check
  if (!validateWebhookAuth(request)) {
    console.warn('[chat-webhook] Unauthorized webhook attempt')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Validate
  const parsed = EventSchema.safeParse(body)
  if (!parsed.success) {
    console.warn('[chat-webhook] Validation failed:', parsed.error.flatten())
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const event = parsed.data

  // Structured log
  console.info(
    JSON.stringify({
      level: 'webhook',
      source: 'chat-events',
      eventType: event.eventType,
      clientId: event.clientId,
      timestamp: new Date().toISOString(),
    }),
  )

  // Dispatch
  let result: { success: boolean; error?: string }

  switch (event.eventType) {
    case 'conversation_upsert': {
      const r = await upsertConversation({
        clientId: event.clientId,
        channel: event.channel,
        externalThreadId: event.externalThreadId,
        externalPlatform: event.externalPlatform,
        contactName: event.contactName,
        contactPhone: event.contactPhone,
        contactHandle: event.contactHandle,
        status: event.status,
        lastMessagePreview: event.lastMessagePreview,
        lastMessageAt: event.lastMessageAt,
        firstMessageAt: event.firstMessageAt,
        sourceCampaign: event.sourceCampaign,
        externalUrl: event.externalUrl,
        sourceSystem: event.sourceSystem,
        assignedTo: event.assignedTo,
        metadata: event.metadata,
      })
      result = r
      break
    }

    case 'message_append': {
      const r = await appendMessage({
        conversationId: event.conversationId,
        clientId: event.clientId,
        direction: event.direction,
        messageText: event.messageText,
        mediaUrl: event.mediaUrl,
        sentAt: event.sentAt,
        providerMessageId: event.providerMessageId,
        senderType: event.senderType,
        senderName: event.senderName,
        messageType: event.messageType,
        metadata: event.metadata,
      })
      result = r
      break
    }

    case 'lead_capture': {
      const r = await captureLead({
        clientId: event.clientId,
        conversationId: event.conversationId,
        name: event.name,
        phone: event.phone,
        email: event.email,
        interestService: event.interestService,
        status: event.status,
      })
      result = r
      break
    }

    case 'booking_outcome': {
      result = await recordBookingOutcome({
        clientId: event.clientId,
        conversationId: event.conversationId,
        leadId: event.leadId,
        bookingId: event.bookingId,
        externalBookingId: event.externalBookingId,
        bookedAt: event.bookedAt,
        attributedRevenue: event.attributedRevenue,
      })
      break
    }
  }

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? 'Processing failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true, eventType: event.eventType })
}
