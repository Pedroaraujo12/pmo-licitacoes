'use client'

import { Suspense } from 'react'
import FornecedorDetailClient from '../[id]/detail-client'

export default function FornecedorDetalhePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="loading-spinner" /></div>}>
      <FornecedorDetailClient />
    </Suspense>
  )
}
