import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--brand-bg)] p-4">
      <div className="text-center">
        <p className="text-7xl font-bold text-[var(--brand-primary)] mb-4">404</p>
        <h1 className="text-2xl font-semibold text-[var(--brand-text)] mb-2">Page not found</h1>
        <p className="text-[var(--brand-muted)] mb-6">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}
