'use client'

import { Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import ColaboradorDetailClient from '../[id]/detail-client'

function ColaboradorDetalheContent() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const pathId = pathname.match(/\/colaboradores\/([a-f0-9-]+)/)?.[1]
  const id = searchParams.get('id') || pathId || ''
  return <ColaboradorDetailClient idOverride={id} />
}

export default function ColaboradorDetalhePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="loading-spinner" /></div>}>
      <ColaboradorDetalheContent />
    </Suspense>
  )
}
