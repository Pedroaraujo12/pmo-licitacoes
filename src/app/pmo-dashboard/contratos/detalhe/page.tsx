'use client'

import { Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import ContratoDetailClient from '../[id]/detail-client'

function ContratoDetalheContent() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const pathId = pathname.match(/\/contratos\/([a-f0-9-]+)/)?.[1]
  const id = searchParams.get('id') || pathId || ''
  return <ContratoDetailClient idOverride={id} />
}

export default function ContratoDetalhePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="loading-spinner" /></div>}>
      <ContratoDetalheContent />
    </Suspense>
  )
}
