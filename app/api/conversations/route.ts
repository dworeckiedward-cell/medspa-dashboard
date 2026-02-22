/**
 * /api/conversations — tenant-scoped conversations list + ingest.
 *
 * GET  → list conversations for the authenticated tenant
 * POST → ingest a conversation event (webhook-style, for n8n/ManyChat)
 *
 * Auth: tenant-scoped via resolveTenantAccess() for GET,
 *       bearer token via WEBHOOK_API_KEY for POST.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { env } from '@/lib/env'
import { safeCompare } from '@/lib/auth/timing-safe'
import { rateLimit, webhookLimiter } from '@/lib/api/rate-limit'
import { listConversations, getChannelAttribution } from '@/lib/chat/query'
import { upsertConversation, appendMessage } from '@/lib/chat/mutations'
import type { ChatChannel, ConversationStatus, InboxViewPreset } from '@/lib/chat/types'

// ── GET: tenant-scoped list ─────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const params = request.nextUrl.searchParams
  const channel = params.get('channel') as ChatChannel | null
  const status = params.get('status')
  const search = params.get('search') ?? undefined
  const limit = Math.min(parseInt(params.get('limit') ?? '50'), 100)
  const offset = parseInt(params.get('offset') ?? '0')
  const viewPreset = params.get('view') as InboxViewPreset | null
  const unreadOnly = params.get('unread') === 'true'
  const includeAttribution = params.get('attribution') === 'true'

  const statusArr = status ? status.split(',') as ConversationStatus[] : undefined

  const [conversations, attribution] = await Promise.all([
    listConversations(tenant.id, {
      channel: channel ?? undefined,
      status: statusArr,
      search,
      limit,
      offset,
      viewPreset: viewPreset ?? undefined,
      unreadOnly,
    }),
    includeAttribution ? getChannelAttribution(tenant.id) : Promise.resolve(null),
  ])

  return NextResponse.json({
    conversations,
    total: conversations.length,
    ...(attribution ? { attribution } : {}),
  })
}

// ── POST: ingest endpoint ──────────────────────────────────────────────────

const IngestSchema = z.object({
  clientId: z.string().uuid(),
  channel: z.enum(['sms', 'instagram', 'whatsapp']),
  externalThreadId: z.string().optional(),
  externalPlatform: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactHandle: z.string().optional(),
  status: z.enum(['new', 'active', 'qualified', 'booked', 'closed_won', 'closed_lost', 'spam']).optional(),
  lastMessagePreview: z.string().optional(),
  lastMessageAt: z.string().optional(),
  firstMessageAt: z.string().optional(),
  sourceSystem: z.enum(['manychat', 'n8n', 'twilio', 'meta', 'webhook', 'manual', 'unknown']).optional(),
  messages: z.array(z.object({
    direction: z.enum(['inbound', 'outbound', 'system']),
    messageText: z.string().optional(),
    mediaUrl: z.string().url().optional(),
    sentAt: z.string().optional(),
    providerMessageId: z.string().optional(),
    senderType: z.enum(['lead', 'ai', 'staff', 'system', 'unknown']).optional(),
    senderName: z.string().optional(),
    messageType: z.enum(['text', 'image', 'audio', 'file', 'system', 'other']).optional(),
  })).optional(),
})

export async function POST(request: Request) {
  // Rate limit
  const limited = rateLimit(request, webhookLimiter)
  if (limited) return limited

  // Auth check
  const key = env.WEBHOOK_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  if (!safeCompare(token, key)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = IngestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const event = parsed.data

  // Upsert conversation
  const convResult = await upsertConversation({
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
    sourceSystem: event.sourceSystem,
  })

  if (!convResult.success) {
    return NextResponse.json({ error: convResult.error }, { status: 500 })
  }

  // Append messages if provided
  let messagesAppended = 0
  if (event.messages && convResult.conversationId) {
    for (const msg of event.messages) {
      const r = await appendMessage({
        conversationId: convResult.conversationId,
        clientId: event.clientId,
        direction: msg.direction,
        messageText: msg.messageText,
        mediaUrl: msg.mediaUrl,
        sentAt: msg.sentAt,
        providerMessageId: msg.providerMessageId,
        senderType: msg.senderType,
        senderName: msg.senderName,
        messageType: msg.messageType,
      })
      if (r.success) messagesAppended++
    }
  }

  return NextResponse.json({
    success: true,
    conversationId: convResult.conversationId,
    messagesAppended,
  })
}
