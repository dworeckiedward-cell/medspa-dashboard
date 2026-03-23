import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[12px] font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive:
          'border-red-200 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-destructive/20 dark:text-red-400',
        outline: 'border-[var(--brand-border)] text-[var(--brand-muted)]',
        success:
          'border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a] dark:border-emerald-900/40 dark:bg-emerald-950/50 dark:text-emerald-400',
        warning:
          'border-[#fde68a] bg-[#fffbeb] text-[#d97706] dark:border-amber-900/40 dark:bg-amber-950/50 dark:text-amber-400',
        brand: 'border-transparent bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]',
        accent: 'border-transparent bg-[var(--brand-accent)]/10 text-[var(--brand-accent)]',
        muted: 'border-[var(--brand-border)] bg-[var(--brand-surface)] text-[var(--brand-muted)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
