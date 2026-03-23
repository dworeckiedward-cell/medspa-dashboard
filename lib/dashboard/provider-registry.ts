/**
 * Provider Registry — metadata for all integration providers.
 *
 * Pure data file — no side effects, no DB access.
 * Consumed by IntegrationsCenter and onboarding components.
 *
 * Provider statuses:
 *  - 'available'    → adapter exists, can be connected
 *  - 'coming_soon'  → on the roadmap, show preview tile
 *  - 'via_webhook'  → not native, but can connect via custom webhook
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type ProviderStatus = 'available' | 'coming_soon' | 'via_webhook'
export type ProviderCategory = 'crm' | 'practice_management' | 'marketing' | 'scheduling'

export interface ProviderCapability {
  key: string
  label: string
}

export const CAPABILITIES: Record<string, ProviderCapability> = {
  bookings: { key: 'bookings', label: 'Bookings' },
  availability: { key: 'availability', label: 'Availability' },
  crm_sync: { key: 'crm_sync', label: 'CRM Sync' },
  messaging: { key: 'messaging', label: 'Messaging' },
  contacts: { key: 'contacts', label: 'Contacts' },
  invoicing: { key: 'invoicing', label: 'Invoicing' },
}

export interface ProviderMeta {
  key: string
  name: string
  category: ProviderCategory
  status: ProviderStatus
  description: string
  /** Hex brand color for the icon tile */
  color: string
  /** First letter for default icon */
  initial: string
  /** Capabilities this provider supports (or will support) */
  capabilities: string[]
  /** Helper text shown in the connector section */
  helperText?: string
}

// ── Registry ─────────────────────────────────────────────────────────────────

export const PROVIDER_REGISTRY: ProviderMeta[] = [
  // ── Available (real adapters exist) ──
  {
    key: 'custom_webhook',
    name: 'Custom Webhook',
    category: 'crm',
    status: 'available',
    description: 'Send events to any HTTP endpoint',
    color: '#6366F1',
    initial: 'W',
    capabilities: ['bookings', 'crm_sync', 'contacts'],
  },
  {
    key: 'hubspot',
    name: 'HubSpot',
    category: 'crm',
    status: 'available',
    description: 'Sync contacts and deals to HubSpot CRM',
    color: '#FF7A59',
    initial: 'H',
    capabilities: ['crm_sync', 'contacts'],
  },
  {
    key: 'ghl',
    name: 'GoHighLevel',
    category: 'crm',
    status: 'available',
    description: 'Push leads and bookings to GHL',
    color: '#4CAF50',
    initial: 'G',
    capabilities: ['crm_sync', 'contacts', 'bookings'],
  },

  // ── Practice Management connectors (coming soon) ──
  {
    key: 'mindbody',
    name: 'Mindbody',
    category: 'practice_management',
    status: 'coming_soon',
    description: 'Bookings & availability sync',
    color: '#00A1E0',
    initial: 'M',
    capabilities: ['bookings', 'availability', 'contacts'],
    helperText: 'Native integration on the roadmap. Use Custom Webhook in the meantime.',
  },
  {
    key: 'zenoti',
    name: 'Zenoti',
    category: 'practice_management',
    status: 'coming_soon',
    description: 'Enterprise spa management sync',
    color: '#1B365D',
    initial: 'Z',
    capabilities: ['bookings', 'availability', 'crm_sync', 'invoicing'],
    helperText: 'Native integration on the roadmap. Use Custom Webhook in the meantime.',
  },
  {
    key: 'boulevard',
    name: 'Boulevard',
    category: 'practice_management',
    status: 'coming_soon',
    description: 'Client management & scheduling',
    color: '#000000',
    initial: 'B',
    capabilities: ['bookings', 'availability', 'contacts'],
    helperText: 'Native integration on the roadmap. Use Custom Webhook in the meantime.',
  },
  {
    key: 'jane_app',
    name: 'Jane App',
    category: 'practice_management',
    status: 'available',
    description: 'Practice management for health & wellness',
    color: '#5A67D8',
    initial: 'J',
    capabilities: ['bookings', 'availability', 'contacts'],
    helperText: 'Native integration on the roadmap. Use Custom Webhook in the meantime.',
  },
  {
    key: 'vagaro',
    name: 'Vagaro',
    category: 'practice_management',
    status: 'coming_soon',
    description: 'Salon & spa booking platform',
    color: '#FF6B35',
    initial: 'V',
    capabilities: ['bookings', 'availability'],
    helperText: 'Native integration on the roadmap. Use Custom Webhook in the meantime.',
  },
  {
    key: 'aesthetic_record',
    name: 'Aesthetic Record',
    category: 'practice_management',
    status: 'coming_soon',
    description: 'Aesthetic practice management',
    color: '#C084FC',
    initial: 'A',
    capabilities: ['bookings', 'contacts', 'invoicing'],
    helperText: 'Native integration on the roadmap. Use Custom Webhook in the meantime.',
  },
  {
    key: 'nextech',
    name: 'Nextech',
    category: 'practice_management',
    status: 'coming_soon',
    description: 'Specialty healthcare EHR + practice management',
    color: '#0077B6',
    initial: 'N',
    capabilities: ['bookings', 'contacts', 'crm_sync'],
    helperText: 'Native integration on the roadmap. Use Custom Webhook in the meantime.',
  },
  {
    key: 'phorest',
    name: 'Phorest',
    category: 'practice_management',
    status: 'coming_soon',
    description: 'Salon management & marketing',
    color: '#E63946',
    initial: 'P',
    capabilities: ['bookings', 'contacts', 'messaging'],
    helperText: 'Native integration on the roadmap. Use Custom Webhook in the meantime.',
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getProvider(key: string): ProviderMeta | undefined {
  return PROVIDER_REGISTRY.find((p) => p.key === key)
}

export function getAvailableProviders(): ProviderMeta[] {
  return PROVIDER_REGISTRY.filter((p) => p.status === 'available')
}

export function getComingSoonProviders(): ProviderMeta[] {
  return PROVIDER_REGISTRY.filter((p) => p.status === 'coming_soon')
}

export function getPracticeManagementProviders(): ProviderMeta[] {
  return PROVIDER_REGISTRY.filter((p) => p.category === 'practice_management')
}

/** @deprecated Use `getPracticeManagementProviders()` instead. */
export const getMedSpaProviders = getPracticeManagementProviders
