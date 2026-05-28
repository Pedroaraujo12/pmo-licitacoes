import OrdensServicoClient from './page-client'
import { Suspense } from 'react'

export async function generateStaticParams() {
  return [{ id: 'placeholder' }]
}

export default function ContratoOrdensServicoWrapper({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="loading-spinner" /></div>}>
      <OrdensServicoClient params={params} />
    </Suspense>
  )
}
