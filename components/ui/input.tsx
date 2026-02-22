import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3.5 py-2 text-sm text-[var(--brand-text)] transition-colors',
        'placeholder:text-[var(--brand-muted)]/70',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/20 focus-visible:border-[var(--brand-primary)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = 'Input'

export { Input }
