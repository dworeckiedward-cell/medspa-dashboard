/**
 * Role-Based Access Control — typed permission system.
 *
 * Extends the existing user_tenants.role column ('owner' | 'admin' | 'viewer')
 * with a fourth role ('staff') and a structured permission map.
 *
 * ── Role hierarchy (highest → lowest) ────────────────────────────────────────
 *
 *   owner    → Full access. Billing, team management, danger zone.
 *   manager  → Operational access. Services, integrations, branding. No billing.
 *   staff    → Day-to-day access. View calls, reports, follow-ups. No config.
 *   analyst  → Read-only. View reports and metrics. No mutations.
 *
 * ── DB note ──────────────────────────────────────────────────────────────────
 *
 * The user_tenants table currently has CHECK (role IN ('owner','admin','viewer')).
 * Migration 013 will ALTER the check to include 'manager','staff','analyst'.
 * Until then, 'admin' maps to 'manager' and 'viewer' maps to 'analyst'.
 */

// ── Role types ───────────────────────────────────────────────────────────────

export type WorkspaceRole = 'owner' | 'manager' | 'staff' | 'analyst'

/** Roles stored in user_tenants before migration 013. */
export type LegacyRole = 'owner' | 'admin' | 'viewer'

/**
 * Normalize legacy role values to the new 4-role system.
 * Safe to call on already-normalized values.
 */
export function normalizeRole(role: string): WorkspaceRole {
  switch (role) {
    case 'owner':
      return 'owner'
    case 'admin':
    case 'manager':
      return 'manager'
    case 'staff':
      return 'staff'
    case 'viewer':
    case 'analyst':
      return 'analyst'
    default:
      return 'analyst' // fail-safe: lowest privilege
  }
}

// ── Permissions ──────────────────────────────────────────────────────────────

export type Permission =
  | 'team.view'
  | 'team.invite'
  | 'team.remove'
  | 'team.change_role'
  | 'billing.view'
  | 'billing.manage'
  | 'services.view'
  | 'services.edit'
  | 'integrations.view'
  | 'integrations.manage'
  | 'branding.view'
  | 'branding.edit'
  | 'calls.view'
  | 'calls.follow_up'
  | 'reports.view'
  | 'settings.advanced'
  | 'workspace.danger_zone'
  | 'activity.view'

/**
 * Static permission map — source of truth for role capabilities.
 * Checked at runtime by `hasPermission()`.
 */
export const ROLE_PERMISSIONS: Record<WorkspaceRole, readonly Permission[]> = {
  owner: [
    'team.view',
    'team.invite',
    'team.remove',
    'team.change_role',
    'billing.view',
    'billing.manage',
    'services.view',
    'services.edit',
    'integrations.view',
    'integrations.manage',
    'branding.view',
    'branding.edit',
    'calls.view',
    'calls.follow_up',
    'reports.view',
    'settings.advanced',
    'workspace.danger_zone',
    'activity.view',
  ],
  manager: [
    'team.view',
    'team.invite',
    'services.view',
    'services.edit',
    'integrations.view',
    'integrations.manage',
    'branding.view',
    'branding.edit',
    'calls.view',
    'calls.follow_up',
    'reports.view',
    'activity.view',
  ],
  staff: [
    'team.view',
    'calls.view',
    'calls.follow_up',
    'reports.view',
    'services.view',
    'branding.view',
  ],
  analyst: [
    'team.view',
    'reports.view',
    'calls.view',
    'services.view',
    'branding.view',
  ],
} as const

// ── Permission checks ────────────────────────────────────────────────────────

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(role: WorkspaceRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}

/**
 * Check if a role has ALL of the specified permissions.
 */
export function hasAllPermissions(role: WorkspaceRole, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p))
}

/**
 * Check if a role has ANY of the specified permissions.
 */
export function hasAnyPermission(role: WorkspaceRole, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p))
}

// ── Role hierarchy ───────────────────────────────────────────────────────────

const ROLE_RANK: Record<WorkspaceRole, number> = {
  owner: 4,
  manager: 3,
  staff: 2,
  analyst: 1,
}

/**
 * Compare two roles. Returns true if `actor` outranks `target`.
 * Used to prevent users from assigning roles above their own.
 */
export function outranks(actor: WorkspaceRole, target: WorkspaceRole): boolean {
  return ROLE_RANK[actor] > ROLE_RANK[target]
}

/**
 * Roles that `actorRole` is allowed to assign to others.
 * Users can only assign roles below their own rank.
 */
export function assignableRoles(actorRole: WorkspaceRole): WorkspaceRole[] {
  const actorRank = ROLE_RANK[actorRole]
  return (['owner', 'manager', 'staff', 'analyst'] as WorkspaceRole[]).filter(
    (r) => ROLE_RANK[r] < actorRank,
  )
}

// ── Display helpers ──────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  staff: 'Staff',
  analyst: 'Analyst',
}

export const ROLE_DESCRIPTIONS: Record<WorkspaceRole, string> = {
  owner: 'Full access including billing, team management, and danger zone',
  manager: 'Operational access — services, integrations, branding, no billing',
  staff: 'Day-to-day access — calls, follow-ups, reports',
  analyst: 'Read-only access — view reports and metrics',
}

export const PERMISSION_LABELS: Record<Permission, string> = {
  'team.view': 'View team members',
  'team.invite': 'Invite teammates',
  'team.remove': 'Remove members',
  'team.change_role': 'Change member roles',
  'billing.view': 'View billing',
  'billing.manage': 'Manage billing',
  'services.view': 'View services',
  'services.edit': 'Edit services & pricing',
  'integrations.view': 'View integrations',
  'integrations.manage': 'Manage integrations',
  'branding.view': 'View branding',
  'branding.edit': 'Edit branding & logo',
  'calls.view': 'View call logs',
  'calls.follow_up': 'Manage follow-ups',
  'reports.view': 'View reports & analytics',
  'settings.advanced': 'Advanced settings',
  'workspace.danger_zone': 'Danger zone actions',
  'activity.view': 'View workspace activity',
}
