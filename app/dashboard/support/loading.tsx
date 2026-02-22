export default function SupportLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex items-center gap-3 text-sm text-[var(--brand-muted)]">
        <div className="h-5 w-5 rounded-full border-2 border-[var(--brand-primary)] border-t-transparent animate-spin" />
        Loading support...
      </div>
    </div>
  )
}
