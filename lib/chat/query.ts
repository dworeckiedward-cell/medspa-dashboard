/**
 * Chat Query Helpers — read operations for conversations, messages, and leads.
 *
 * Server-only. Uses service-role client (bypasses RLS).
 * All queries are tenant-scoped via client_id.
 *
 * Falls back gracefully with scaffold data when tables don't exist.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type {
  ChatConversation,
  ChatMessage,
  ChatLead,
  ConversationWithDetails,
  ConversationsKpiSummary,
  ChannelAttribution,
  ChatChannel,
  ConversationStatus,
  BookingOutcome,
  InboxViewPreset,
  MessageDirection,
  SenderType,
  MessageType,
  MessageStatus,
  SourceSystem,
} from './types'

// ── Conversations list ──────────────────────────────────────────────────────

export interface ListConversationsOpts {
  channel?: ChatChannel
  status?: ConversationStatus[]
  search?: string
  limit?: number
  offset?: number
  viewPreset?: InboxViewPreset
  unreadOnly?: boolean
}

export async function listConversations(
  clientId: string,
  opts: ListConversationsOpts = {},
): Promise<ConversationWithDetails[]> {
  try {
    const supabase = createSupabaseServerClient()
    let query = supabase
      .from('chat_conversations')
      .select('*')
      .eq('client_id', clientId)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (opts.channel) {
      query = query.eq('channel', opts.channel)
    }
    if (opts.status && opts.status.length > 0) {
      query = query.in('status', opts.status)
    }
    if (opts.search) {
      query = query.or(
        `contact_name.ilike.%${opts.search}%,contact_phone.ilike.%${opts.search}%,last_message_preview.ilike.%${opts.search}%`,
      )
    }
    if (opts.unreadOnly) {
      query = query.gt('unread_count', 0)
    }

    // View preset filters
    if (opts.viewPreset && opts.viewPreset !== 'all') {
      switch (opts.viewPreset) {
        case 'inbound':
          query = query.eq('direction_last', 'inbound')
          break
        case 'outbound':
          query = query.eq('direction_last', 'outbound')
          break
        case 'chatbot':
          query = query.in('source_system', ['manychat', 'n8n'])
          break
        case 'needs_review':
          query = query.in('status', ['new', 'active']).gt('unread_count', 0)
          break
        case 'booked':
          query = query.eq('status', 'booked')
          break
      }
    }

    if (opts.limit) {
      query = query.limit(opts.limit)
    }
    if (opts.offset) {
      query = query.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1)
    }

    const { data, error } = await query

    if (error) {
      console.error('[chat] listConversations error:', error.message)
      return getScaffoldConversations(clientId)
    }

    if (!data || data.length === 0) {
      return getScaffoldConversations(clientId)
    }

    // Fetch linked leads for all conversations
    const convIds = data.map((c) => c.id)
    const { data: leads } = await supabase
      .from('chat_leads')
      .select('*')
      .eq('client_id', clientId)
      .in('conversation_id', convIds)

    const leadsByConv = new Map<string, ChatLead>()
    for (const lead of (leads ?? [])) {
      leadsByConv.set(lead.conversation_id, mapDbLead(lead))
    }

    return data.map((row) => {
      const conv = mapDbConversation(row)
      const lead = leadsByConv.get(conv.id) ?? null
      return {
        ...conv,
        lead,
        bookingOutcome: deriveBookingOutcome(conv, lead),
      }
    })
  } catch {
    return getScaffoldConversations(clientId)
  }
}

// ── Single conversation with messages ───────────────────────────────────────

export async function getConversationWithMessages(
  clientId: string,
  conversationId: string,
): Promise<{
  conversation: ConversationWithDetails | null
  messages: ChatMessage[]
}> {
  try {
    const supabase = createSupabaseServerClient()

    const [convResult, msgsResult, leadResult] = await Promise.all([
      supabase
        .from('chat_conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('client_id', clientId)
        .maybeSingle(),
      supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('client_id', clientId)
        .order('sent_at', { ascending: true }),
      supabase
        .from('chat_leads')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('client_id', clientId)
        .maybeSingle(),
    ])

    if (convResult.error || !convResult.data) {
      return { conversation: null, messages: [] }
    }

    const conv = mapDbConversation(convResult.data)
    const lead = leadResult.data ? mapDbLead(leadResult.data) : null
    const messages = (msgsResult.data ?? []).map(mapDbMessage)

    return {
      conversation: {
        ...conv,
        lead,
        bookingOutcome: deriveBookingOutcome(conv, lead),
      },
      messages,
    }
  } catch {
    return { conversation: null, messages: [] }
  }
}

// ── KPI summary ─────────────────────────────────────────────────────────────

export async function getConversationsKpiSummary(
  clientId: string,
): Promise<ConversationsKpiSummary> {
  try {
    const supabase = createSupabaseServerClient()

    const [convsResult, leadsResult] = await Promise.all([
      supabase
        .from('chat_conversations')
        .select('id, channel, status, unread_count')
        .eq('client_id', clientId),
      supabase
        .from('chat_leads')
        .select('id, booked, status')
        .eq('client_id', clientId),
    ])

    const convs = convsResult.data ?? []
    const leads = leadsResult.data ?? []

    if (convs.length === 0) {
      return getScaffoldKpi()
    }

    const channelBreakdown: Record<ChatChannel, number> = { sms: 0, instagram: 0, whatsapp: 0 }
    const statusBreakdown = {} as Record<ConversationStatus, number>
    let unreadConversations = 0
    let openConversations = 0

    for (const c of convs) {
      const ch = c.channel as ChatChannel
      if (ch in channelBreakdown) channelBreakdown[ch]++
      const st = c.status as ConversationStatus
      statusBreakdown[st] = (statusBreakdown[st] ?? 0) + 1
      if ((c.unread_count ?? 0) > 0) unreadConversations++
      if (st === 'new' || st === 'active') openConversations++
    }

    const chatBookings = leads.filter((l) => l.booked).length
    const chatLeadsCaptured = leads.length

    return {
      totalConversations: convs.length,
      chatLeadsCaptured,
      chatBookings,
      chatBookingRate: chatLeadsCaptured > 0 ? Math.round((chatBookings / chatLeadsCaptured) * 100) : 0,
      channelBreakdown,
      statusBreakdown,
      unreadConversations,
      openConversations,
    }
  } catch {
    return getScaffoldKpi()
  }
}

// ── Channel attribution ─────────────────────────────────────────────────────

export async function getChannelAttribution(
  clientId: string,
): Promise<ChannelAttribution[]> {
  try {
    const supabase = createSupabaseServerClient()

    const [convsResult, leadsResult] = await Promise.all([
      supabase
        .from('chat_conversations')
        .select('id, channel')
        .eq('client_id', clientId),
      supabase
        .from('chat_leads')
        .select('id, conversation_id, booked, attributed_revenue')
        .eq('client_id', clientId),
    ])

    const convs = convsResult.data ?? []
    const leads = leadsResult.data ?? []

    if (convs.length === 0) return []

    // Map conversation_id → channel
    const convChannelMap = new Map<string, ChatChannel>()
    const channelConvCounts: Record<ChatChannel, number> = { sms: 0, instagram: 0, whatsapp: 0 }
    for (const c of convs) {
      const ch = c.channel as ChatChannel
      convChannelMap.set(c.id, ch)
      if (ch in channelConvCounts) channelConvCounts[ch]++
    }

    // Aggregate leads by channel
    const channelLeads: Record<ChatChannel, number> = { sms: 0, instagram: 0, whatsapp: 0 }
    const channelBookings: Record<ChatChannel, number> = { sms: 0, instagram: 0, whatsapp: 0 }
    const channelRevenue: Record<ChatChannel, number> = { sms: 0, instagram: 0, whatsapp: 0 }

    for (const lead of leads) {
      const ch = lead.conversation_id ? convChannelMap.get(lead.conversation_id) : null
      if (!ch) continue
      channelLeads[ch]++
      if (lead.booked) channelBookings[ch]++
      if (lead.attributed_revenue) channelRevenue[ch] += lead.attributed_revenue
    }

    const channels: ChatChannel[] = ['sms', 'instagram', 'whatsapp']
    return channels.map((ch) => ({
      channel: ch,
      conversations: channelConvCounts[ch],
      leads: channelLeads[ch],
      bookings: channelBookings[ch],
      revenue: channelRevenue[ch],
      conversionRate: channelLeads[ch] > 0
        ? Math.round((channelBookings[ch] / channelLeads[ch]) * 100)
        : 0,
    }))
  } catch {
    return []
  }
}

// ── Cross-tenant ops overview ──────────────────────────────────────────────

export interface OpsConversationOverview {
  clientId: string
  clientName: string
  totalConversations: number
  openConversations: number
  unreadCount: number
  bookedFromChat: number
  lastActivityAt: string | null
}

export async function getOpsConversationOverviews(): Promise<OpsConversationOverview[]> {
  try {
    const supabase = createSupabaseServerClient()

    // Fetch all conversations grouped by client
    const { data: convs, error } = await supabase
      .from('chat_conversations')
      .select('client_id, status, unread_count, last_message_at')

    if (error || !convs || convs.length === 0) return []

    // Get client names
    const clientIds = Array.from(new Set(convs.map((c) => c.client_id)))
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name')
      .in('id', clientIds)

    const clientNameMap = new Map<string, string>()
    for (const c of (clients ?? [])) {
      clientNameMap.set(c.id, c.name)
    }

    // Aggregate
    const byClient = new Map<string, {
      total: number
      open: number
      unread: number
      booked: number
      lastActivity: string | null
    }>()

    for (const c of convs) {
      const existing = byClient.get(c.client_id) ?? {
        total: 0, open: 0, unread: 0, booked: 0, lastActivity: null,
      }
      existing.total++
      if (c.status === 'new' || c.status === 'active') existing.open++
      existing.unread += (c.unread_count ?? 0)
      if (c.status === 'booked') existing.booked++
      if (c.last_message_at && (!existing.lastActivity || c.last_message_at > existing.lastActivity)) {
        existing.lastActivity = c.last_message_at
      }
      byClient.set(c.client_id, existing)
    }

    return Array.from(byClient.entries()).map(([clientId, data]) => ({
      clientId,
      clientName: clientNameMap.get(clientId) ?? 'Unknown',
      totalConversations: data.total,
      openConversations: data.open,
      unreadCount: data.unread,
      bookedFromChat: data.booked,
      lastActivityAt: data.lastActivity,
    }))
  } catch {
    return []
  }
}

// ── DB row mappers ──────────────────────────────────────────────────────────

function mapDbConversation(row: Record<string, unknown>): ChatConversation {
  return {
    id: row.id as string,
    clientId: row.client_id as string,
    channel: row.channel as ChatChannel,
    externalThreadId: (row.external_thread_id as string) ?? null,
    externalPlatform: (row.external_platform as string) ?? null,
    contactName: (row.contact_name as string) ?? null,
    contactPhone: (row.contact_phone as string) ?? null,
    contactHandle: (row.contact_handle as string) ?? null,
    status: row.status as ConversationStatus,
    lastMessagePreview: (row.last_message_preview as string) ?? null,
    lastMessageAt: (row.last_message_at as string) ?? null,
    firstMessageAt: (row.first_message_at as string) ?? null,
    sourceCampaign: (row.source_campaign as string) ?? null,
    externalUrl: (row.external_url as string) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    // Enhanced fields
    directionLast: (row.direction_last as MessageDirection) ?? null,
    sourceSystem: (row.source_system as SourceSystem) ?? null,
    assignedTo: (row.assigned_to as string) ?? null,
    unreadCount: (row.unread_count as number) ?? 0,
    messageCount: (row.message_count as number) ?? 0,
  }
}

function mapDbMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    clientId: row.client_id as string,
    direction: row.direction as MessageDirection,
    messageText: (row.message_text as string) ?? null,
    mediaUrl: (row.media_url as string) ?? null,
    sentAt: row.sent_at as string,
    providerMessageId: (row.provider_message_id as string) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
    // Enhanced fields
    senderType: (row.sender_type as SenderType) ?? null,
    senderName: (row.sender_name as string) ?? null,
    messageType: (row.message_type as MessageType) ?? 'text',
    deliveredAt: (row.delivered_at as string) ?? null,
    readAt: (row.read_at as string) ?? null,
    failedAt: (row.failed_at as string) ?? null,
    status: (row.status as MessageStatus) ?? 'received',
  }
}

function mapDbLead(row: Record<string, unknown>): ChatLead {
  return {
    id: row.id as string,
    clientId: row.client_id as string,
    conversationId: (row.conversation_id as string) ?? null,
    name: (row.name as string) ?? null,
    phone: (row.phone as string) ?? null,
    email: (row.email as string) ?? null,
    interestService: (row.interest_service as string) ?? null,
    status: row.status as ChatLead['status'],
    booked: (row.booked as boolean) ?? false,
    bookingId: (row.booking_id as string) ?? null,
    externalBookingId: (row.external_booking_id as string) ?? null,
    bookedAt: (row.booked_at as string) ?? null,
    attributedRevenue: (row.attributed_revenue as number) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function deriveBookingOutcome(conv: ChatConversation, lead: ChatLead | null): BookingOutcome {
  if (!lead) return 'none'
  if (lead.booked) return 'booked'
  if (lead.status === 'booked') return 'booked'
  if (conv.status === 'booked') return 'pending'
  return 'none'
}

// ── Scaffold data (shown when tables don't exist / no data) ──────────────

function getScaffoldConversations(clientId: string): ConversationWithDetails[] {
  const now = new Date().toISOString()
  const channels: ChatChannel[] = ['sms', 'instagram', 'whatsapp']
  const statuses: ConversationStatus[] = ['new', 'active', 'qualified', 'booked', 'closed_won']
  const names = ['Sarah M.', 'Jessica L.', 'Amanda K.', 'Maria R.', 'Emily T.']
  const previews = [
    'Hi! I\'d like to book a Botox appointment',
    'Do you offer lip filler packages?',
    'What are your hours this week?',
    'I saw your Instagram post about the facial treatment',
    'Can I reschedule my appointment?',
  ]

  return names.map((name, i) => ({
    id: `scaffold-conv-${i}`,
    clientId,
    channel: channels[i % channels.length],
    externalThreadId: null,
    externalPlatform: null,
    contactName: name,
    contactPhone: i % 2 === 0 ? `+1555000${1000 + i}` : null,
    contactHandle: i % 3 === 1 ? `@${name.toLowerCase().replace(/[. ]/g, '')}` : null,
    status: statuses[i % statuses.length],
    lastMessagePreview: previews[i],
    lastMessageAt: new Date(Date.now() - i * 3600000).toISOString(),
    firstMessageAt: new Date(Date.now() - i * 86400000).toISOString(),
    sourceCampaign: i === 3 ? 'IG Spring Promo' : null,
    externalUrl: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
    directionLast: (i % 2 === 0 ? 'inbound' : 'outbound') as MessageDirection,
    sourceSystem: 'manychat' as SourceSystem,
    assignedTo: null,
    unreadCount: i < 2 ? 1 + i : 0,
    messageCount: 3 + i * 2,
    lead: i < 3 ? {
      id: `scaffold-lead-${i}`,
      clientId,
      conversationId: `scaffold-conv-${i}`,
      name,
      phone: `+1555000${1000 + i}`,
      email: null,
      interestService: i === 0 ? 'Botox' : i === 1 ? 'Lip Filler' : 'Facial',
      status: i === 0 ? 'booked' as const : 'qualified' as const,
      booked: i === 0,
      bookingId: i === 0 ? 'scaffold-booking-0' : null,
      externalBookingId: null,
      bookedAt: i === 0 ? now : null,
      attributedRevenue: i === 0 ? 450 : null,
      createdAt: now,
      updatedAt: now,
    } : null,
    bookingOutcome: i === 0 ? 'booked' as const : 'none' as const,
  }))
}

function getScaffoldKpi(): ConversationsKpiSummary {
  return {
    totalConversations: 0,
    chatLeadsCaptured: 0,
    chatBookings: 0,
    chatBookingRate: 0,
    channelBreakdown: { sms: 0, instagram: 0, whatsapp: 0 },
    statusBreakdown: {} as Record<ConversationStatus, number>,
    unreadConversations: 0,
    openConversations: 0,
  }
}
