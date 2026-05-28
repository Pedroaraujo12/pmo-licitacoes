'use client'

import { Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import ProcessoViewClient from '../[id]/view-client'

function ProcessoDetalheContent() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const pathId = pathname.match(/\/processos\/([a-f0-9-]+)/)?.[1]
  const id = searchParams.get('id') || pathId || ''
  return <ProcessoViewClient idOverride={id} />
}

export default function ProcessoDetalhePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="loading-spinner" /></div>}>
      <ProcessoDetalheContent />
    </Suspense>
  )
}
