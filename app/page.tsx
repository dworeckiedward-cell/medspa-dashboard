import { redirect } from 'next/navigation'

/**
 * Root page — redirects to the dashboard.
 * In production, show a landing/login page for unknown tenants.
 */
export default function HomePage() {
  redirect('/dashboard')
}
