'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import EditProcessoClient from '../[id]/edit/edit-client'

function EditarContent() {
  const sp = useSearchParams()
  const pathname = usePathname()
  const pathId = pathname.match(/\/processos\/([a-f0-9-]+)\/edit/)?.[1]
  const id = sp.get('id') || pathId || ''
  return <EditProcessoClient idOverride={id} />
}

export default function EditarPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="loading-spinner" />
      </div>
    }>
      <EditarContent />
    </Suspense>
  )
}
