import ProcessoViewClient from './view-client'

export async function generateStaticParams() {
  const ids: { id: string }[] = [{ id: 'placeholder' }]
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (supabaseUrl && supabaseKey) {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(supabaseUrl, supabaseKey)
      const { data } = await supabase.from('processos').select('id').limit(1000)
      if (data) ids.push(...data.map(p => ({ id: p.id })))
    }
  } catch {
    // Fallback silencioso — placeholder já está incluso
  }
  return ids
}

export default function ProcessoViewPage({ params }: { params: Promise<{ id: string }> }) {
  return <ProcessoViewClient params={params} />
}
