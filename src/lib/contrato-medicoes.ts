import type { ContratoMedicao } from '@/types/contratos'
import type { SupabaseClient } from '@supabase/supabase-js'

const MEDICAO_SELECT = `
  *,
  ordens_servico(numero_os),
  fiscais:fiscal_id(nome)
`

export async function listMedicoes(
  supabase: SupabaseClient,
  filters?: { contrato_id?: string; ordem_servico_id?: string; status?: string; limit?: number },
): Promise<ContratoMedicao[]> {
  let query = supabase
    .from('contrato_medicoes')
    .select(MEDICAO_SELECT)
    .order('created_at', { ascending: false })
    .limit(filters?.limit ?? 50)

  if (filters?.contrato_id) query = query.eq('contrato_id', filters.contrato_id)
  if (filters?.ordem_servico_id) query = query.eq('ordem_servico_id', filters.ordem_servico_id)
  if (filters?.status) query = query.eq('status', filters.status)

  const { data } = await query
  return (data as ContratoMedicao[]) || []
}

export async function createMedicao(
  supabase: SupabaseClient,
  medicao: Omit<ContratoMedicao, 'id' | 'created_at'>,
): Promise<ContratoMedicao | null> {
  const { data, error } = await supabase
    .from('contrato_medicoes')
    .insert(medicao)
    .select()
    .single()

  if (error) throw error
  return data as ContratoMedicao | null
}

export async function updateMedicao(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<ContratoMedicao>,
): Promise<ContratoMedicao | null> {
  const { data, error } = await supabase
    .from('contrato_medicoes')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as ContratoMedicao | null
}

export async function deleteMedicao(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('contrato_medicoes').delete().eq('id', id)
  if (error) throw error
}
