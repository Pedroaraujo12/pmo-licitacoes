'use client'

import { Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import TemplateDetailClient from '../[id]/template-detail-client'

function DocumentoDetalheContent() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const pathId = pathname.match(/\/documentos\/([a-f0-9-]+)/)?.[1]
  const id = searchParams.get('id') || pathId || ''
  return <TemplateDetailClient idOverride={id} />
}

export default function DocumentoDetalhePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="loading-spinner" /></div>}>
      <DocumentoDetalheContent />
    </Suspense>
  )
}
