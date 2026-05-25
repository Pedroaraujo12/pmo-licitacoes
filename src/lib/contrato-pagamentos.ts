import type { ContratoPagamento } from '@/types/contratos'
import type { SupabaseClient } from '@supabase/supabase-js'

const PAGAMENTO_SELECT = `
  *,
  ordens_servico(numero_os),
  medicoes:medicao_id(numero_medicao)
`

export async function listPagamentos(
  supabase: SupabaseClient,
  filters?: { contrato_id?: string; ordem_servico_id?: string; status?: string; limit?: number },
): Promise<ContratoPagamento[]> {
  let query = supabase
    .from('contrato_pagamentos')
    .select(PAGAMENTO_SELECT)
    .order('created_at', { ascending: false })
    .limit(filters?.limit ?? 50)

  if (filters?.contrato_id) query = query.eq('contrato_id', filters.contrato_id)
  if (filters?.ordem_servico_id) query = query.eq('ordem_servico_id', filters.ordem_servico_id)
  if (filters?.status) query = query.eq('status', filters.status)

  const { data } = await query
  return (data as ContratoPagamento[]) || []
}

export async function createPagamento(
  supabase: SupabaseClient,
  pagamento: Omit<ContratoPagamento, 'id' | 'created_at'>,
): Promise<ContratoPagamento | null> {
  const { data, error } = await supabase
    .from('contrato_pagamentos')
    .insert(pagamento)
    .select()
    .single()

  if (error) throw error
  return data as ContratoPagamento | null
}

export async function updatePagamento(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<ContratoPagamento>,
): Promise<ContratoPagamento | null> {
  const { data, error } = await supabase
    .from('contrato_pagamentos')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as ContratoPagamento | null
}

export async function deletePagamento(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('contrato_pagamentos').delete().eq('id', id)
  if (error) throw error
}
