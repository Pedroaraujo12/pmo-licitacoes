import ColaboradorDetailClient from './detail-client'

export async function generateStaticParams() {
  const ids: { id: string }[] = [{ id: 'placeholder' }]
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (supabaseUrl && supabaseKey) {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(supabaseUrl, supabaseKey)
      const { data } = await supabase.from('colaboradores').select('id').limit(1000)
      if (data) ids.push(...data.map(p => ({ id: p.id })))
    }
  } catch { /* fallback */ }
  return ids
}

export default function ColaboradorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <ColaboradorDetailClient params={params} />
}
