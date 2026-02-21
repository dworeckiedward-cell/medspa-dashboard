'use client'

/**
 * RoleBadge — displays a workspace role with icon and color coding.
 */

import { Shield, ShieldCheck, User, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkspaceRole } from '@/lib/auth/rbac'

const ROLE_CONFIG: Record<WorkspaceRole, {
  icon: React.ElementType
  label: string
  bgClass: string
  textClass: string
}> = {
  owner: {
    icon: ShieldCheck,
    label: 'Owner',
    bgClass: 'bg-amber-50 dark:bg-amber-950/30',
    textClass: 'text-amber-700 dark:text-amber-400',
  },
  manager: {
    icon: Shield,
    label: 'Manager',
    bgClass: 'bg-blue-50 dark:bg-blue-950/30',
    textClass: 'text-blue-700 dark:text-blue-400',
  },
  staff: {
    icon: User,
    label: 'Staff',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/30',
    textClass: 'text-emerald-700 dark:text-emerald-400',
  },
  analyst: {
    icon: Eye,
    label: 'Analyst',
    bgClass: 'bg-slate-50 dark:bg-slate-950/30',
    textClass: 'text-slate-600 dark:text-slate-400',
  },
}

interface RoleBadgeProps {
  role: WorkspaceRole
  size?: 'sm' | 'md'
}

export function RoleBadge({ role, size = 'sm' }: RoleBadgeProps) {
  const cfg = ROLE_CONFIG[role]
  const Icon = cfg.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        cfg.bgClass,
        cfg.textClass,
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
      )}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {cfg.label}
    </span>
  )
}
