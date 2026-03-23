import { redirect } from 'next/navigation'

// Appointments are now rendered as a tab inside /dashboard via DashboardTabsShell
export default function AppointmentsPage() {
  redirect('/dashboard')
}
