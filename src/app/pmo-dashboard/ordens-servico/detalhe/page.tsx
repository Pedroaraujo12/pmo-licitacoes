'use client'

import { Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import OrdemServicoDetailClient from '../[id]/detail-client'

function OrdemServicoDetalheContent() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const pathId = pathname.match(/\/ordens-servico\/([a-f0-9-]+)/)?.[1]
  const id = searchParams.get('id') || pathId || ''
  return <OrdemServicoDetailClient idOverride={id} />
}

export default function OrdemServicoDetalhePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="loading-spinner" /></div>}>
      <OrdemServicoDetalheContent />
    </Suspense>
  )
}
