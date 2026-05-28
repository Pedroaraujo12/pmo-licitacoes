import ContratoDetailClient from './detail-client'
import { Suspense } from 'react'

export async function generateStaticParams() {
  const ids: { id: string }[] = [{ id: 'placeholder' }]
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (supabaseUrl && supabaseKey) {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(supabaseUrl, supabaseKey)
      const { data } = await supabase.from('contratos').select('id').limit(1000)
      if (data) ids.push(...data.map(c => ({ id: c.id })))
    }
  } catch {
    // fallback silencioso
  }
  return ids
}

export default function ContratoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="loading-spinner" /></div>}>
      <ContratoDetailClient params={params} />
    </Suspense>
  )
}
