'use client'

import { Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import EditContratoClient from '../[id]/editar/edit-client'

function ContratoEditarContent() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const pathId = pathname.match(/\/contratos\/([a-f0-9-]+)\/editar/)?.[1]
  const id = searchParams.get('id') || pathId || ''
  return <EditContratoClient idOverride={id} />
}

export default function ContratoEditarPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="loading-spinner" /></div>}>
      <ContratoEditarContent />
    </Suspense>
  )
}
