import { Loader2 } from 'lucide-react'

export default function OpsSupportLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-muted)]" />
    </div>
  )
}
