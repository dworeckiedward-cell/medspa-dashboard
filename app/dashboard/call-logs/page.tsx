import { redirect } from 'next/navigation'

// Call logs are now rendered as a tab inside /dashboard via DashboardTabsShell
export default function CallLogsPage() {
  redirect('/dashboard')
}
