import { redirect } from 'next/navigation'

// Follow-up is now rendered as a tab inside /dashboard via DashboardTabsShell
export default function FollowUpPage() {
  redirect('/dashboard')
}
