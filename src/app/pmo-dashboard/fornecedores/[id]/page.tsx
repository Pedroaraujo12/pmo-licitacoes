import FornecedorDetailClient from './detail-client'
import { Suspense } from 'react'

export async function generateStaticParams() {
  return [{ id: 'placeholder' }]
}

export default function FornecedorDetailPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="loading-spinner" /></div>}>
      <FornecedorDetailClient />
    </Suspense>
  )
}
