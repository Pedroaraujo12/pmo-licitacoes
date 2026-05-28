'use client'

import { PageShell } from '@/components/page-shell'
import DashboardContent from './dashboard-content'

export default function DashboardPage() {
  return (
    <PageShell>
      {({ role }) => <DashboardContent userRole={role} />}
    </PageShell>
  )
}
