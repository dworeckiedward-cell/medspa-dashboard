import { redirect } from 'next/navigation'

// Leads are now rendered as a tab inside /dashboard via DashboardTabsShell
export default function LeadsPage() {
  redirect('/dashboard')
}
