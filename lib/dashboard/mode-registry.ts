/**
 * Dashboard Mode Registry — config-driven mapping of DashboardMode to UI behavior.
 *
 * Pure data file — no side effects, no DB access.
 * Consumed by dashboard page, KPI cards, sidebar, and layout components.
 *
 * Each mode defines:
 *  - KPI cards to display (label, icon, format, color)
 *  - Primary chart configuration
 *  - Lead pipeline stages
 *  - Section visibility flags
 *  - Table columns and tab definitions
 */

import type { DashboardMode } from '@/lib/ops/get-client-type'

// ── KPI Definition ──────────────────────────────────────────────────────────

export interface KpiDefinition {
  key: string
  label: string
  /** Key used to look up the computed value in the metrics object */
  computeKey: string
  /** Lucide icon name */
  icon: string
  color: string
  format: 'number' | 'currency' | 'percent' | 'duration'
  subtitle: string
}

// ── Chart Configuration ─────────────────────────────────────────────────────

export interface ChartConfig {
  type: 'area' | 'bar' | 'funnel'
  title: string
  series: Array<{ key: string; label: string; color: string }>
}

// ── Lead Pipeline Stage ─────────────────────────────────────────────────────

export interface PipelineStage {
  key: string
  label: string
  color: string
}

// ── Section Visibility ──────────────────────────────────────────────────────

export interface SectionVisibility {
  showConversionFunnel: boolean
  showProofStrip: boolean
  showServicePerformance: boolean
  showWeeklyReport: boolean
  showCampaignManager: boolean
  showSpeedToLead: boolean
  showAdROI: boolean
  showTopServices: boolean
}

// ── Tab Definition ──────────────────────────────────────────────────────────

export interface TabDefinition {
  key: string
  label: string
}

// ── Mode Configuration ──────────────────────────────────────────────────────

export interface DashboardModeConfig {
  mode: DashboardMode
  label: string
  description: string
  kpis: KpiDefinition[]
  primaryChart: ChartConfig
  pipeline: PipelineStage[]
  sections: SectionVisibility
  tableColumns: string[]
  tabs: TabDefinition[]
}

// ── Registry ────────────────────────────────────────────────────────────────

export const MODE_REGISTRY: Record<DashboardMode, DashboardModeConfig> = {
  inbound_clinic: {
    mode: 'inbound_clinic',
    label: 'Inbound Clinic',
    description: 'Inbound-focused with bookings, procedure revenue, and AI insights',
    kpis: [
      {
        key: 'appointmentsBooked',
        label: 'Appointments Booked',
        computeKey: 'appointmentsBooked',
        icon: 'CalendarCheck',
        color: 'var(--brand-primary)',
        format: 'number',
        subtitle: 'Last 30 days',
      },
      {
        key: 'potentialRevenue',
        label: 'Potential Revenue',
        computeKey: 'potentialRevenue',
        icon: 'DollarSign',
        color: '#10B981',
        format: 'currency',
        subtitle: 'Estimated pipeline',
      },
      {
        key: 'avgSpeedSec',
        label: 'Avg Speed-to-Lead',
        computeKey: 'avgSpeedSec',
        icon: 'Zap',
        color: '#F59E0B',
        format: 'duration',
        subtitle: 'Avg first response',
      },
      {
        key: 'leadConversionRate',
        label: 'Lead Conversion',
        computeKey: 'leadConversionRate',
        icon: 'Target',
        color: '#F59E0B',
        format: 'percent',
        subtitle: 'Leads → bookings',
      },
    ],
    primaryChart: {
      type: 'area',
      title: 'Revenue Pipeline',
      series: [
        { key: 'inquiries', label: 'Inquiries', color: '#2563EB' },
        { key: 'booked', label: 'Booked', color: '#10B981' },
        { key: 'potential', label: 'Potential', color: '#F59E0B' },
      ],
    },
    pipeline: [
      { key: 'new', label: 'New Lead', color: '#2563EB' },
      { key: 'contacted', label: 'Contacted', color: '#06B6D4' },
      { key: 'interested', label: 'Interested', color: '#8B5CF6' },
      { key: 'booked', label: 'Booked', color: '#10B981' },
      { key: 'lost', label: 'Lost', color: '#6B7280' },
    ],
    sections: {
      showConversionFunnel: true,
      showProofStrip: true,
      showServicePerformance: true,
      showWeeklyReport: true,
      showCampaignManager: false,
      showSpeedToLead: false,
      showAdROI: false,
      showTopServices: true,
    },
    tableColumns: ['name', 'source', 'callType', 'duration', 'revenue', 'status'],
    tabs: [
      { key: 'overview', label: 'Overview' },
      { key: 'inbound', label: 'Inbound' },
      { key: 'outbound', label: 'Outbound' },
      { key: 'setup', label: 'Setup & Tips' },
    ],
  },

  outbound_db: {
    mode: 'outbound_db',
    label: 'Outbound Re-engagement',
    description: 'Old database re-engagement with contact rates, funnels, and campaigns',
    kpis: [
      {
        key: 'callsMade',
        label: 'Calls Made',
        computeKey: 'callsMade',
        icon: 'Phone',
        color: '#2563EB',
        format: 'number',
        subtitle: 'Outbound total',
      },
      {
        key: 'contacted',
        label: 'Contacted',
        computeKey: 'contacted',
        icon: 'UserCheck',
        color: '#10B981',
        format: 'number',
        subtitle: 'Answered (>30s)',
      },
      {
        key: 'contactRate',
        label: 'Contact Rate',
        computeKey: 'contactRate',
        icon: 'Activity',
        color: '#06B6D4',
        format: 'percent',
        subtitle: 'Contacted / called',
      },
      {
        key: 'bookingRate',
        label: 'Booking Rate',
        computeKey: 'bookingRate',
        icon: 'TrendingUp',
        color: '#F59E0B',
        format: 'percent',
        subtitle: 'Booked / contacted',
      },
    ],
    primaryChart: {
      type: 'funnel',
      title: 'Conversion Funnel',
      series: [
        { key: 'calls', label: 'Calls Made', color: '#2563EB' },
        { key: 'contacted', label: 'Contacted', color: '#10B981' },
        { key: 'qualified', label: 'Qualified', color: '#8B5CF6' },
        { key: 'booked', label: 'Booked', color: '#F59E0B' },
      ],
    },
    pipeline: [
      { key: 'uploaded', label: 'Uploaded', color: '#6B7280' },
      { key: 'queued', label: 'Queued', color: '#2563EB' },
      { key: 'contacted', label: 'Contacted', color: '#06B6D4' },
      { key: 'qualified', label: 'Qualified', color: '#8B5CF6' },
      { key: 'booked', label: 'Booked', color: '#10B981' },
      { key: 'not_interested', label: 'Not Interested', color: '#EF4444' },
    ],
    sections: {
      showConversionFunnel: true,
      showProofStrip: false,
      showServicePerformance: false,
      showWeeklyReport: false,
      showCampaignManager: true,
      showSpeedToLead: false,
      showAdROI: false,
      showTopServices: false,
    },
    tableColumns: ['name', 'phone', 'duration', 'qualification', 'disposition', 'revenue'],
    tabs: [
      { key: 'overview', label: 'Overview' },
      { key: 'campaigns', label: 'Campaigns' },
      { key: 'setup', label: 'Setup' },
    ],
  },

  fb_leads: {
    mode: 'fb_leads',
    label: 'FB Ads Leads',
    description: 'Speed-to-lead with ad ROI, cost per lead, and conversion tracking',
    kpis: [
      {
        key: 'newLeads',
        label: 'New Leads',
        computeKey: 'newLeads',
        icon: 'Zap',
        color: '#F59E0B',
        format: 'number',
        subtitle: 'From FB Ads',
      },
      {
        key: 'avgSpeedToLead',
        label: 'Speed-to-Lead',
        computeKey: 'avgSpeedToLeadSec',
        icon: 'Timer',
        color: '#10B981',
        format: 'duration',
        subtitle: 'Avg first contact',
      },
      {
        key: 'costPerLead',
        label: 'Cost per Lead',
        computeKey: 'costPerLeadCents',
        icon: 'DollarSign',
        color: '#EF4444',
        format: 'currency',
        subtitle: 'From ad spend',
      },
      {
        key: 'leadConversionRate',
        label: 'Lead Conversion',
        computeKey: 'leadConversionRate',
        icon: 'Target',
        color: '#8B5CF6',
        format: 'percent',
        subtitle: 'Leads to bookings',
      },
    ],
    primaryChart: {
      type: 'bar',
      title: 'Lead Flow & Conversion',
      series: [
        { key: 'newLeads', label: 'New Leads', color: '#F59E0B' },
        { key: 'contacted', label: 'Contacted', color: '#06B6D4' },
        { key: 'booked', label: 'Booked', color: '#10B981' },
      ],
    },
    pipeline: [
      { key: 'new', label: 'New (FB)', color: '#F59E0B' },
      { key: 'contacted', label: 'Contacted', color: '#06B6D4' },
      { key: 'qualified', label: 'Qualified', color: '#8B5CF6' },
      { key: 'booked', label: 'Booked', color: '#10B981' },
      { key: 'lost', label: 'Lost', color: '#EF4444' },
    ],
    sections: {
      showConversionFunnel: true,
      showProofStrip: false,
      showServicePerformance: false,
      showWeeklyReport: false,
      showCampaignManager: true,
      showSpeedToLead: true,
      showAdROI: true,
      showTopServices: false,
    },
    tableColumns: ['name', 'source', 'speedToLead', 'adCost', 'status', 'revenue'],
    tabs: [
      { key: 'overview', label: 'Overview' },
      { key: 'leads', label: 'Lead Pipeline' },
      { key: 'ads', label: 'Ad Performance' },
      { key: 'setup', label: 'Setup' },
    ],
  },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getModeConfig(mode: DashboardMode): DashboardModeConfig {
  return MODE_REGISTRY[mode]
}

export function getModeKpis(mode: DashboardMode): KpiDefinition[] {
  return MODE_REGISTRY[mode].kpis
}

export function getModeSections(mode: DashboardMode): SectionVisibility {
  return MODE_REGISTRY[mode].sections
}

export function getModePipeline(mode: DashboardMode): PipelineStage[] {
  return MODE_REGISTRY[mode].pipeline
}

export function getModeTabs(mode: DashboardMode): TabDefinition[] {
  return MODE_REGISTRY[mode].tabs
}
