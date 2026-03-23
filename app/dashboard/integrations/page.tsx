import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Integrations page is managed by ops only — redirect clients to settings.
export default async function IntegrationsPage() {
  redirect('/dashboard/settings')
}
