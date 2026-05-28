import EditProcessoClient from './edit-client'
import { Suspense } from 'react'

export async function generateStaticParams() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (supabaseUrl && supabaseKey) {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(supabaseUrl, supabaseKey)
      const { data } = await supabase.from('processos').select('id').limit(1000)
      if (data && data.length > 0) {
        return data.map(p => ({ id: p.id }))
      }
    }
  } catch {
    // Fallback to placeholder
  }
  return [{ id: 'placeholder' }]
}

export default function EditProcessoPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="loading-spinner" /></div>}>
      <EditProcessoClient params={params} />
    </Suspense>
  )
}
