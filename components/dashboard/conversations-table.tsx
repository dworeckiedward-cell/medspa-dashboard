'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  MessageSquare,
  Search,
  Phone,
  Instagram,
  ExternalLink,
  User,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  FileImage,
  Headphones,
  FileText,
  Bot,
  UserCircle,
  Cog,
  Eye,
  Mail,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { buildTenantApiUrl } from '@/lib/dashboard/tenant-api'
import type {
  ConversationWithDetails,
  ChatChannel,
  ConversationStatus,
  BookingOutcome,
  InboxViewPreset,
  ChatMessage,
  SenderType,
  MessageType,
  MessageStatus,
} from '@/lib/chat/types'

interface ConversationsTableProps {
  conversations: ConversationWithDetails[]
  tenantSlug: string
}

// ── Channel config ──────────────────────────────────────────────────────────

const CHANNEL_CONFIG: Record<ChatChannel, { label: string; icon: React.ElementType; color: string }> = {
  sms: { label: 'SMS', icon: Phone, color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30' },
  instagram: { label: 'Instagram', icon: Instagram, color: 'text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/30' },
  whatsapp: { label: 'WhatsApp', icon: MessageSquare, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' },
}

// ── Status config ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ConversationStatus, { label: string; variant: string }> = {
  new: { label: 'New', variant: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400' },
  active: { label: 'Active', variant: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' },
  qualified: { label: 'Qualified', variant: 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400' },
  booked: { label: 'Booked', variant: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' },
  closed_won: { label: 'Won', variant: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' },
  closed_lost: { label: 'Lost', variant: 'bg-slate-50 text-slate-600 dark:bg-slate-950/30 dark:text-slate-400' },
  spam: { label: 'Spam', variant: 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400' },
}

const BOOKING_CONFIG: Record<BookingOutcome, { label: string; variant: string }> = {
  none: { label: '—', variant: '' },
  pending: { label: 'Pending', variant: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' },
  booked: { label: 'Booked', variant: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' },
  canceled: { label: 'Canceled', variant: 'bg-slate-50 text-slate-600 dark:bg-slate-950/30 dark:text-slate-400' },
  no_show: { label: 'No-show', variant: 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400' },
}

// ── View presets ────────────────────────────────────────────────────────────

interface ViewPresetDef {
  key: InboxViewPreset
  label: string
}

const VIEW_PRESETS: ViewPresetDef[] = [
  { key: 'all', label: 'All' },
  { key: 'inbound', label: 'Inbound' },
  { key: 'outbound', label: 'Outbound' },
  { key: 'needs_review', label: 'Needs Review' },
  { key: 'booked', label: 'Booked' },
]

type SortKey = 'lastActivity' | 'messages' | 'channel'

// ── Main component ──────────────────────────────────────────────────────────

export function ConversationsTable({ conversations, tenantSlug }: ConversationsTableProps) {
  const [search, setSearch] = useState('')
  const [channelFilter, setChannelFilter] = useState<ChatChannel | 'all'>('all')
  const [viewPreset, setViewPreset] = useState<InboxViewPreset>('all')
  const [sortKey, setSortKey] = useState<SortKey>('lastActivity')
  const [sortAsc, setSortAsc] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [threadMessages, setThreadMessages] = useState<ChatMessage[]>([])
  const [loadingThread, setLoadingThread] = useState(false)

  const filtered = useMemo(() => {
    let result = [...conversations]

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (c) =>
          (c.contactName?.toLowerCase().includes(q)) ||
          (c.contactPhone?.toLowerCase().includes(q)) ||
          (c.contactHandle?.toLowerCase().includes(q)) ||
          (c.lastMessagePreview?.toLowerCase().includes(q)),
      )
    }

    // Channel filter
    if (channelFilter !== 'all') {
      result = result.filter((c) => c.channel === channelFilter)
    }

    // View preset (client-side filtering for scaffold data)
    if (viewPreset !== 'all') {
      switch (viewPreset) {
        case 'inbound':
          result = result.filter((c) => c.directionLast === 'inbound')
          break
        case 'outbound':
          result = result.filter((c) => c.directionLast === 'outbound')
          break
        case 'chatbot':
          result = result.filter((c) =>
            c.sourceSystem === 'manychat' || c.sourceSystem === 'n8n',
          )
          break
        case 'needs_review':
          result = result.filter((c) =>
            (c.status === 'new' || c.status === 'active') && c.unreadCount > 0,
          )
          break
        case 'booked':
          result = result.filter((c) => c.status === 'booked' || c.bookingOutcome === 'booked')
          break
      }
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'lastActivity':
          cmp = (a.lastMessageAt ?? '').localeCompare(b.lastMessageAt ?? '')
          break
        case 'messages':
          cmp = a.messageCount - b.messageCount
          break
        case 'channel':
          cmp = a.channel.localeCompare(b.channel)
          break
      }
      return sortAsc ? cmp : -cmp
    })

    return result
  }, [conversations, search, channelFilter, viewPreset, sortKey, sortAsc])

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  )

  // Fetch thread messages when conversation is selected
  const fetchThread = useCallback(async (convId: string) => {
    if (convId.startsWith('scaffold-')) {
      // Generate scaffold messages for demo
      setThreadMessages(getScaffoldMessages(convId))
      return
    }

    setLoadingThread(true)
    try {
      const url = buildTenantApiUrl(`/api/conversations/${convId}`, tenantSlug)
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setThreadMessages(data.messages ?? [])
        // Mark as read
        await fetch(buildTenantApiUrl(`/api/conversations/${convId}`, tenantSlug), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'mark_read' }),
        })
      }
    } catch {
      // Fail silently
    } finally {
      setLoadingThread(false)
    }
  }, [tenantSlug])

  useEffect(() => {
    if (selectedId) {
      fetchThread(selectedId)
    }
  }, [selectedId, fetchThread])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  // Mobile: show thread panel full-width when selected
  const showThreadPanel = selectedConversation !== null

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[var(--brand-muted)]" />
            Inbox
          </CardTitle>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--brand-muted)]" />
            <Input
              placeholder="Search contacts or messages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-8 text-xs"
            />
          </div>
        </div>

        {/* View presets */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {VIEW_PRESETS.map((preset) => (
            <button
              key={preset.key}
              onClick={() => setViewPreset(preset.key)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[10px] font-medium transition-all duration-150',
                viewPreset === preset.key
                  ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border border-[var(--brand-primary)]/20'
                  : 'bg-[var(--brand-bg)] text-[var(--brand-muted)] border border-[var(--brand-border)]/60 hover:text-[var(--brand-text)] hover:border-[var(--brand-border)]',
              )}
            >
              {preset.label}
            </button>
          ))}

          {/* Channel filter removed — SMS only view */}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center px-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-border)]/40">
              <MessageSquare className="h-5 w-5 text-[var(--brand-muted)] opacity-50" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--brand-text)]">No conversations yet</p>
              <p className="text-xs text-[var(--brand-muted)] mt-1 max-w-xs mx-auto">
                SMS conversations with your patients will appear here once connected.
              </p>
            </div>
          </div>
        )}

        {/* Split panel */}
        {filtered.length > 0 && (
          <div className="flex min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] border-t border-[var(--brand-border)]">
            {/* Left panel: conversation list */}
            <div
              className={cn(
                'border-r border-[var(--brand-border)] overflow-y-auto',
                showThreadPanel ? 'hidden md:block md:w-[280px] lg:w-[340px] shrink-0' : 'w-full',
              )}
            >
              {/* Sort header */}
              <div className="flex items-center gap-2 px-3 py-2 text-[10px] font-medium text-[var(--brand-muted)] uppercase tracking-wider border-b border-[var(--brand-border)] bg-[var(--brand-bg)]/50">
                <button onClick={() => toggleSort('lastActivity')} className="flex items-center gap-0.5 hover:text-[var(--brand-text)]">
                  Time
                  {sortKey === 'lastActivity' && (sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                </button>
                <span className="mx-1">|</span>
                <button onClick={() => toggleSort('messages')} className="flex items-center gap-0.5 hover:text-[var(--brand-text)]">
                  Messages
                  {sortKey === 'messages' && (sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                </button>
                <span className="ml-auto text-[var(--brand-muted)]">{filtered.length}</span>
              </div>

              {/* List */}
              <div className="divide-y divide-[var(--brand-border)]">
                {filtered.map((conv) => (
                  <ConversationListItem
                    key={conv.id}
                    conversation={conv}
                    selected={selectedId === conv.id}
                    onSelect={() => setSelectedId(conv.id)}
                  />
                ))}
              </div>
            </div>

            {/* Right panel: thread detail */}
            {showThreadPanel ? (
              <div className="flex-1 flex flex-col min-w-0">
                <ConversationThreadPanel
                  conversation={selectedConversation}
                  messages={threadMessages}
                  loading={loadingThread}
                  onBack={() => setSelectedId(null)}
                />
              </div>
            ) : (
              <div className="hidden lg:flex flex-1 items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="h-10 w-10 text-[var(--brand-muted)] opacity-30 mx-auto mb-3" />
                  <p className="text-sm text-[var(--brand-muted)]">Select a conversation</p>
                  <p className="text-[10px] text-[var(--brand-muted)] mt-1">Choose from the list to view the message thread</p>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Conversation list item ──────────────────────────────────────────────────

function ConversationListItem({
  conversation: conv,
  selected,
  onSelect,
}: {
  conversation: ConversationWithDetails
  selected: boolean
  onSelect: () => void
}) {
  const chConfig = CHANNEL_CONFIG[conv.channel]
  const stConfig = STATUS_CONFIG[conv.status]
  const ChannelIcon = chConfig.icon

  const contactDisplay = conv.contactName
    ?? conv.contactHandle
    ?? conv.contactPhone
    ?? 'Unknown contact'

  const timeAgo = conv.lastMessageAt ? formatTimeAgo(conv.lastMessageAt) : '—'

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full flex items-start gap-3 px-3 py-3 text-left transition-colors',
        selected
          ? 'bg-[var(--brand-primary)]/[0.06] border-l-2 border-l-[var(--brand-primary)]'
          : 'hover:bg-[var(--brand-bg)]/50 border-l-2 border-l-transparent',
      )}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-border)]/40">
          <User className="h-4 w-4 text-[var(--brand-muted)]" />
        </div>
        {conv.unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--brand-primary)] text-white text-[9px] font-bold">
            {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            'text-xs truncate',
            conv.unreadCount > 0 ? 'font-semibold text-[var(--brand-text)]' : 'font-medium text-[var(--brand-text)]',
          )}>
            {contactDisplay}
          </span>
          <span className="text-[10px] text-[var(--brand-muted)] tabular-nums shrink-0">
            {timeAgo}
          </span>
        </div>

        <div className="flex items-center gap-1.5 mt-0.5">
          <ChannelIcon className={cn('h-3 w-3 shrink-0', chConfig.color.split(' ')[0])} />
          <span className={cn('inline-flex items-center rounded-full px-1.5 py-0 text-[9px] font-medium', stConfig.variant)}>
            {stConfig.label}
          </span>
          {conv.bookingOutcome === 'booked' && (
            <span className="inline-flex items-center rounded-full px-1.5 py-0 text-[9px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
              Booked
            </span>
          )}
        </div>

        {conv.lastMessagePreview && (
          <p className={cn(
            'text-[10px] truncate mt-1 max-w-[260px]',
            conv.unreadCount > 0 ? 'text-[var(--brand-text)]' : 'text-[var(--brand-muted)]',
          )}>
            {conv.lastMessagePreview}
          </p>
        )}
      </div>
    </button>
  )
}

// ── Thread panel ────────────────────────────────────────────────────────────

function ConversationThreadPanel({
  conversation,
  messages,
  loading,
  onBack,
}: {
  conversation: ConversationWithDetails | null
  messages: ChatMessage[]
  loading: boolean
  onBack: () => void
}) {
  if (!conversation) return null

  const contactDisplay = conversation.contactName
    ?? conversation.contactHandle
    ?? conversation.contactPhone
    ?? 'Unknown contact'

  const chConfig = CHANNEL_CONFIG[conversation.channel]
  const ChannelIcon = chConfig.icon

  return (
    <>
      {/* Thread header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--brand-border)] bg-[var(--brand-surface)]">
        <button
          onClick={onBack}
          className="lg:hidden text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
          aria-label="Back to list"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-border)]/40 shrink-0">
          <User className="h-3.5 w-3.5 text-[var(--brand-muted)]" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[var(--brand-text)] truncate">
            {contactDisplay}
          </p>
          <div className="flex items-center gap-1.5">
            <ChannelIcon className={cn('h-3 w-3', chConfig.color.split(' ')[0])} />
            <span className="text-[10px] text-[var(--brand-muted)]">{chConfig.label}</span>
            {conversation.sourceSystem && (
              <>
                <span className="text-[var(--brand-muted)]">&middot;</span>
                <span className="text-[10px] text-[var(--brand-muted)]">{conversation.sourceSystem}</span>
              </>
            )}
          </div>
        </div>

        <span className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0',
          STATUS_CONFIG[conversation.status].variant,
        )}>
          {STATUS_CONFIG[conversation.status].label}
        </span>
      </div>

      {/* Messages timeline */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[var(--brand-bg)]/30">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2 text-xs text-[var(--brand-muted)]">
              <div className="h-4 w-4 rounded-full border-2 border-[var(--brand-primary)] border-t-transparent animate-spin" />
              Loading messages...
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs text-[var(--brand-muted)]">No messages in this thread yet</p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}
      </div>

      {/* Info cards + disabled composer */}
      <div className="border-t border-[var(--brand-border)]">
        {/* Linked lead / booking cards */}
        {(conversation.lead || conversation.bookingOutcome !== 'none') && (
          <div className="px-4 py-2 space-y-2 border-b border-[var(--brand-border)] bg-[var(--brand-surface)]">
            {conversation.lead && (
              <div className="flex items-center gap-2 text-[10px]">
                <UserCircle className="h-3 w-3 text-violet-500" />
                <span className="text-[var(--brand-muted)]">Lead:</span>
                <span className="font-medium text-[var(--brand-text)]">
                  {conversation.lead.name ?? 'Unknown'}
                </span>
                {conversation.lead.interestService && (
                  <>
                    <span className="text-[var(--brand-muted)]">&middot;</span>
                    <span className="text-[var(--brand-muted)]">{conversation.lead.interestService}</span>
                  </>
                )}
                {conversation.lead.attributedRevenue != null && (
                  <span className="ml-auto font-medium text-emerald-600 dark:text-emerald-400">
                    ${conversation.lead.attributedRevenue.toLocaleString()}
                  </span>
                )}
              </div>
            )}
            {conversation.bookingOutcome !== 'none' && (
              <div className="flex items-center gap-2 text-[10px]">
                <Eye className="h-3 w-3 text-amber-500" />
                <span className="text-[var(--brand-muted)]">Booking:</span>
                <span className={cn('inline-flex items-center rounded-full px-1.5 py-0 text-[9px] font-medium', BOOKING_CONFIG[conversation.bookingOutcome].variant)}>
                  {BOOKING_CONFIG[conversation.bookingOutcome].label}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Metadata drawer */}
        {(conversation.externalUrl || conversation.sourceCampaign || conversation.assignedTo) && (
          <div className="px-4 py-2 space-y-1 border-b border-[var(--brand-border)] bg-[var(--brand-surface)]">
            {conversation.sourceCampaign && (
              <MetaRow label="Campaign" value={conversation.sourceCampaign} />
            )}
            {conversation.assignedTo && (
              <MetaRow label="Assigned" value={conversation.assignedTo} />
            )}
            {conversation.externalUrl && (
              <a
                href={conversation.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-[var(--brand-primary)] hover:underline"
              >
                Open in ManyChat
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}

        {/* Disabled composer */}
        <div className="px-4 py-3 bg-[var(--brand-bg)]/50">
          <div className="flex items-center gap-2 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-2.5 opacity-60">
            <Mail className="h-3.5 w-3.5 text-[var(--brand-muted)]" />
            <span className="text-[11px] text-[var(--brand-muted)]">
              Replying is handled in your connected channels
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Message bubble ──────────────────────────────────────────────────────────

const SENDER_TYPE_CONFIG: Record<SenderType, { label: string; icon: React.ElementType }> = {
  lead: { label: 'Contact', icon: User },
  ai: { label: 'AI', icon: Bot },
  staff: { label: 'Staff', icon: UserCircle },
  system: { label: 'System', icon: Cog },
  unknown: { label: '', icon: User },
}

const MESSAGE_TYPE_ICONS: Partial<Record<MessageType, React.ElementType>> = {
  image: FileImage,
  audio: Headphones,
  file: FileText,
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isInbound = message.direction === 'inbound'
  const isSystem = message.direction === 'system'
  const senderType = message.senderType ?? (isInbound ? 'lead' : 'ai')
  const senderConfig = SENDER_TYPE_CONFIG[senderType]
  const SenderIcon = senderConfig.icon
  const MediaIcon = MESSAGE_TYPE_ICONS[message.messageType]

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <span className="text-[10px] text-[var(--brand-muted)] bg-[var(--brand-border)]/30 rounded-full px-3 py-1">
          {message.messageText ?? 'System event'}
        </span>
      </div>
    )
  }

  const timeStr = formatMessageTime(message.sentAt)

  return (
    <div className={cn('flex gap-2', isInbound ? 'justify-start' : 'justify-end')}>
      {isInbound && (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand-border)]/40 mt-1">
          <SenderIcon className="h-3 w-3 text-[var(--brand-muted)]" />
        </div>
      )}

      <div className={cn('max-w-[75%] space-y-0.5')}>
        {/* Sender label */}
        <div className={cn('flex items-center gap-1', isInbound ? '' : 'justify-end')}>
          <span className="text-[9px] text-[var(--brand-muted)]">
            {message.senderName ?? senderConfig.label}
          </span>
        </div>

        {/* Bubble */}
        <div
          className={cn(
            'rounded-xl px-3 py-2 text-xs',
            isInbound
              ? 'bg-[var(--brand-surface)] border border-[var(--brand-border)] text-[var(--brand-text)] rounded-tl-sm'
              : 'bg-[var(--brand-primary)]/10 text-[var(--brand-text)] rounded-tr-sm',
          )}
        >
          {/* Media indicator */}
          {MediaIcon && message.messageType !== 'text' && (
            <div className="flex items-center gap-1.5 mb-1.5 text-[var(--brand-muted)]">
              <MediaIcon className="h-3.5 w-3.5" />
              <span className="text-[10px] capitalize">{message.messageType}</span>
            </div>
          )}

          {message.messageText && (
            <p className="whitespace-pre-wrap break-words">{message.messageText}</p>
          )}

          {!message.messageText && !MediaIcon && (
            <p className="text-[var(--brand-muted)] italic">No content</p>
          )}
        </div>

        {/* Timestamp + status */}
        <div className={cn('flex items-center gap-1.5', isInbound ? '' : 'justify-end')}>
          <span className="text-[9px] text-[var(--brand-muted)] tabular-nums">{timeStr}</span>
          {!isInbound && message.status !== 'received' && (
            <MessageStatusBadge status={message.status} />
          )}
        </div>
      </div>

      {!isInbound && (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)]/10 mt-1">
          <SenderIcon className="h-3 w-3 text-[var(--brand-primary)]" />
        </div>
      )}
    </div>
  )
}

function MessageStatusBadge({ status }: { status: MessageStatus }) {
  const labels: Record<MessageStatus, string> = {
    sent: 'Sent',
    delivered: 'Delivered',
    read: 'Read',
    failed: 'Failed',
    received: '',
    processed: 'Processed',
  }
  const label = labels[status]
  if (!label) return null

  return (
    <span className={cn(
      'text-[8px] font-medium',
      status === 'failed' ? 'text-rose-500' : 'text-[var(--brand-muted)]',
    )}>
      {label}
    </span>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="text-[var(--brand-muted)]">{label}:</span>
      <span className="text-[var(--brand-text)] font-medium">{value}</span>
    </div>
  )
}

// ── Scaffold messages (for demo) ────────────────────────────────────────────

function getScaffoldMessages(convId: string): ChatMessage[] {
  const idx = parseInt(convId.replace('scaffold-conv-', '')) || 0
  const previews = [
    'Hi! I\'d like to book a Botox appointment',
    'Do you offer lip filler packages?',
    'What are your hours this week?',
    'I saw your Instagram post about the facial treatment',
    'Can I reschedule my appointment?',
  ]
  const aiReplies = [
    'Hi! I\'d love to help you schedule a Botox appointment. We have openings this week. What day works best for you?',
    'Yes! We offer several lip filler packages starting at $399. Would you like me to send you our menu?',
    'We\'re open Monday through Friday 9am-6pm and Saturday 10am-3pm. Would you like to book a visit?',
    'Thank you for your interest! That treatment is our Hydra-Glow Facial, starting at $179. Would you like to learn more?',
    'Of course! Let me check available times for you. What day were you thinking?',
  ]

  const now = Date.now()
  return [
    {
      id: `scaffold-msg-${convId}-0`,
      conversationId: convId,
      clientId: '',
      direction: 'inbound' as const,
      messageText: previews[idx] ?? previews[0],
      mediaUrl: null,
      sentAt: new Date(now - 3600000).toISOString(),
      providerMessageId: null,
      metadata: {},
      createdAt: new Date(now - 3600000).toISOString(),
      senderType: 'lead' as const,
      senderName: null,
      messageType: 'text' as const,
      deliveredAt: null,
      readAt: null,
      failedAt: null,
      status: 'received' as const,
    },
    {
      id: `scaffold-msg-${convId}-1`,
      conversationId: convId,
      clientId: '',
      direction: 'outbound' as const,
      messageText: aiReplies[idx] ?? aiReplies[0],
      mediaUrl: null,
      sentAt: new Date(now - 3500000).toISOString(),
      providerMessageId: null,
      metadata: {},
      createdAt: new Date(now - 3500000).toISOString(),
      senderType: 'ai' as const,
      senderName: 'Sarah AI',
      messageType: 'text' as const,
      deliveredAt: new Date(now - 3490000).toISOString(),
      readAt: new Date(now - 3400000).toISOString(),
      failedAt: null,
      status: 'read' as const,
    },
  ]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - Date.parse(isoDate)
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

function formatMessageTime(isoDate: string): string {
  try {
    const d = new Date(isoDate)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()

    if (isToday) {
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}
