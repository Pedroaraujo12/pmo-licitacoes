import { createClient } from '@/lib/supabase/server'
import DashboardContent from './dashboard-content'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: processos } = await supabase
    .from('processos')
    .select('*, status:nome, responsavel:nome, modalidade:nome, coordenacao:nome')

  const { data: modalidades } = await supabase.from('modalidades').select('*')
  const { data: responsaveis } = await supabase.from('responsaveis').select('*')

  return (
    <DashboardContent
      processos={processos || []}
      modalidades={modalidades || []}
      responsaveis={responsaveis || []}
    />
  )
}
