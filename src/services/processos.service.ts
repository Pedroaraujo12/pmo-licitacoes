import { createClient } from '@/lib/supabase/client'
import { getRange, DEFAULT_PAGE_SIZE } from '@/lib/pagination'

export interface ProcessoListParams {
  page?: number
  pageSize?: number
  search?: string
  statusId?: string
  modalidadeId?: string
  responsavelId?: string
  coordenacaoId?: string
  prioridade?: string
}

export interface ProcessoListResult {
  id: string
  id_processo: string
  objeto_resumido: string
  data_entrada: string
  data_entrega: string
  valor_estimado: number
  valor_homologado: number
  prioridade: string
  status_nome: string
  modalidade_nome: string
  responsavel_nome: string
  coordenacao_nome: string
}

export async function listProcessos(params: ProcessoListParams = {}) {
  const supabase = createClient()
  const { page = 1, pageSize = DEFAULT_PAGE_SIZE, search, statusId, modalidadeId, responsavelId, coordenacaoId, prioridade } = params
  const { from, to } = getRange(page, pageSize)

  let query = supabase
    .from('processos')
    .select(`
      id,
      id_processo,
      objeto_resumido,
      data_entrada,
      data_entrega,
      valor_estimado,
      valor_homologado,
      prioridade,
      status_processo!inner(nome),
      modalidades!left(nome),
      responsaveis!left(nome),
      coordenacoes!left(nome)
    `, { count: 'exact' })
    .order('data_entrada', { ascending: false })
    .range(from, to)

  if (search) {
    query = query.or(`id_processo.ilike.%${search}%,objeto_resumido.ilike.%${search}%`)
  }
  if (statusId) query = query.eq('status_id', statusId)
  if (modalidadeId) query = query.eq('modalidade_id', modalidadeId)
  if (responsavelId) query = query.eq('responsavel_id', responsavelId)
  if (coordenacaoId) query = query.eq('coordenacao_id', coordenacaoId)
  if (prioridade) query = query.eq('prioridade', prioridade)

  const { data, error, count } = await query

  if (error) throw error

  const result: ProcessoListResult[] = (data || []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    id_processo: r.id_processo as string,
    objeto_resumido: r.objeto_resumido as string,
    data_entrada: r.data_entrada as string,
    data_entrega: r.data_entrega as string,
    valor_estimado: r.valor_estimado as number,
    valor_homologado: r.valor_homologado as number,
    prioridade: r.prioridade as string,
    status_nome: (r.status_processo as Record<string, string>).nome,
    modalidade_nome: (r.modalidades as Record<string, string> | null)?.nome || '',
    responsavel_nome: (r.responsaveis as Record<string, string> | null)?.nome || '',
    coordenacao_nome: (r.coordenacoes as Record<string, string> | null)?.nome || '',
  }))

  return { data: result, count: count ?? 0 }
}
