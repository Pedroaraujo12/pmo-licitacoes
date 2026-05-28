import EditContratoClient from './edit-client'
import { Suspense } from 'react'

export async function generateStaticParams() {
  return [{ id: 'placeholder' }]
}

export default function EditContratoPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="loading-spinner" /></div>}>
      <EditContratoClient params={params} />
    </Suspense>
  )
}
