import { Loader2 } from 'lucide-react'

export default function PartnersLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--brand-bg)]">
      <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-muted)]" />
    </div>
  )
}
