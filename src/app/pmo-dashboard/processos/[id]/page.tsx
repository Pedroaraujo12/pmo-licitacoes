import ProcessoViewClient from './view-client'

export async function generateStaticParams() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (supabaseUrl && supabaseKey) {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(supabaseUrl, supabaseKey)
      const { data } = await supabase.from('processos').select('id')
      if (data && data.length > 0) {
        return data.map(p => ({ id: p.id }))
      }
    }
  } catch {
    // Fallback to placeholder
  }
  return [{ id: 'placeholder' }]
}

export default function ProcessoViewPage({ params }: { params: Promise<{ id: string }> }) {
  return <ProcessoViewClient params={params} />
}
