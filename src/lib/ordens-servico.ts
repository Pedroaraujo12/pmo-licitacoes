import type { OrdemServico } from '@/types/contratos'
import type { SupabaseClient } from '@supabase/supabase-js'
import { logHistorico } from './contrato-historico'

const OS_SELECT = `
  *,
  contratos(numero_contrato, contratada_nome, status),
  processos(id_processo),
  fiscais:fiscal_id(nome)
`

export async function listOrdensServico(
  supabase: SupabaseClient,
  filters?: { search?: string; status?: string; contrato_id?: string; fiscal_id?: string; limit?: number },
): Promise<OrdemServico[]> {
  let query = supabase
    .from('ordens_servico')
    .select(OS_SELECT)
    .order('created_at', { ascending: false })

  if (filters?.search) {
    const q = filters.search
    query = query.or(`numero_os.ilike.%${q}%,objeto.ilike.%${q}%`)
  }
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.contrato_id) {
    query = query.eq('contrato_id', filters.contrato_id)
  }
  if (filters?.fiscal_id) {
    query = query.eq('fiscal_id', filters.fiscal_id)
  }

  if (filters?.limit) query = query.limit(filters.limit)
  else query = query.limit(100)

  const { data } = await query
  return (data as OrdemServico[]) || []
}

export async function getOrdemServico(supabase: SupabaseClient, id: string): Promise<OrdemServico | null> {
  const { data } = await supabase
    .from('ordens_servico')
    .select(OS_SELECT)
    .eq('id', id)
    .single()

  return data as OrdemServico | null
}

export async function createOrdemServico(
  supabase: SupabaseClient,
  os: Omit<OrdemServico, 'id' | 'created_at' | 'updated_at'>,
): Promise<OrdemServico | null> {
  const { data, error } = await supabase
    .from('ordens_servico')
    .insert(os)
    .select()
    .single()

  if (error) throw error
  const created = data as OrdemServico | null
  if (created) {
    await logHistorico(supabase, {
      contrato_id: created.contrato_id,
      entidade: 'ordem_servico',
      entidade_id: created.id,
      acao: 'criacao',
      descricao: `OS ${created.numero_os} criada`,
    })
  }
  return created
}

export async function updateOrdemServico(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<OrdemServico>,
): Promise<OrdemServico | null> {
  const { data: oldData } = await supabase.from('ordens_servico').select('contrato_id, numero_os, status').eq('id', id).single()
  const { data, error } = await supabase
    .from('ordens_servico')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  const updated = data as OrdemServico | null
  if (updated && oldData) {
    const changes: string[] = []
    if (updates.status && updates.status !== (oldData as Record<string, unknown>).status) {
      changes.push(`status: ${(oldData as Record<string, unknown>).status} → ${updates.status}`)
    }
    await logHistorico(supabase, {
      contrato_id: (oldData as Record<string, unknown>).contrato_id as string,
      entidade: 'ordem_servico',
      entidade_id: id,
      acao: 'atualizacao',
      descricao: changes.length > 0 ? changes.join('; ') : 'OS atualizada',
      valor_anterior: JSON.stringify((oldData as Record<string, unknown>).status),
      valor_novo: JSON.stringify(updates.status),
    })
  }
  return updated
}

export async function deleteOrdemServico(supabase: SupabaseClient, id: string): Promise<void> {
  const { data: oldData } = await supabase.from('ordens_servico').select('contrato_id, numero_os').eq('id', id).single()
  const { error } = await supabase.from('ordens_servico').delete().eq('id', id)
  if (error) throw error
  if (oldData) {
    await logHistorico(supabase, {
      contrato_id: (oldData as Record<string, unknown>).contrato_id as string,
      entidade: 'ordem_servico',
      entidade_id: id,
      acao: 'exclusao',
      descricao: `OS ${(oldData as Record<string, unknown>).numero_os} excluída`,
    })
  }
}

export async function getMetricasOS(supabase: SupabaseClient) {
  const { data: osList } = await supabase.from('ordens_servico').select('id, status, valor, data_fim_prevista').limit(500)
  if (!osList) return { total: 0, em_execucao: 0, atrasadas: 0, concluidas: 0, valor_total: 0 }

  const hoje = new Date().toISOString().slice(0, 10)
  let atrasadas = 0
  for (const os of osList) {
    if (os.status !== 'concluida' && os.status !== 'cancelada' && os.data_fim_prevista && os.data_fim_prevista < hoje) {
      atrasadas++
    }
  }

  return {
    total: osList.length,
    em_execucao: osList.filter(o => o.status === 'em_execucao').length,
    atrasadas,
    concluidas: osList.filter(o => o.status === 'concluida').length,
    valor_total: osList.reduce((acc, o) => acc + (o.valor || 0), 0),
  }
}

export * from './contrato-aditivos'
export * from './contrato-medicoes'
export * from './contrato-pagamentos'
