'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import EditProcessoClient from '../[id]/edit/edit-client'

function EditarContent() {
  const sp = useSearchParams()
  const id = sp.get('id') || ''
  return <EditProcessoClient params={Promise.resolve({ id })} />
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
