import AditivosClient from './page-client'
import { Suspense } from 'react'

export async function generateStaticParams() {
  return [{ id: 'placeholder' }]
}

export default function AditivosWrapper({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="loading-spinner" /></div>}>
      <AditivosClient params={params} />
    </Suspense>
  )
}
