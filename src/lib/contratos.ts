import type { Contrato, ContratoFilters, ContratoMetricas, ContratoAlerta, ValoresBreakdown, ContratoAditivo } from '@/types/contratos'
import type { SupabaseClient } from '@supabase/supabase-js'
import { logHistorico } from './contrato-historico'

const CONTRATO_SELECT = `
  *,
  processos(id_processo, objeto_resumido, modalidades(nome)),
  gestor:gestor_id(nome),
  fiscal_tecnico:fiscal_tecnico_id(nome),
  fiscal_administrativo:fiscal_administrativo_id(nome),
  coordenacoes(nome)
`

export async function listContratos(
  supabase: SupabaseClient,
  filters?: ContratoFilters,
): Promise<Contrato[]> {
  let query = supabase
    .from('contratos')
    .select(CONTRATO_SELECT)
    .order('created_at', { ascending: false })

  if (filters?.search) {
    const q = filters.search
    query = query.or(
      `numero_contrato.ilike.%${q}%,contratada_nome.ilike.%${q}%,objeto.ilike.%${q}%,contratada_cnpj.ilike.%${q}%`,
    )
  }
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.fiscal_id) {
    query = query.or(`fiscal_tecnico_id.eq.${filters.fiscal_id},fiscal_administrativo_id.eq.${filters.fiscal_id}`)
  }
  if (filters?.unidade_id) {
    query = query.eq('unidade_id', filters.unidade_id)
  }
  if (filters?.sem_fiscal) {
    query = query.is('fiscal_tecnico_id', null)
  }
  if (filters?.vigencia === 'vence_30d') {
    const hoje = new Date()
    const trintaDias = new Date(hoje)
    trintaDias.setDate(trintaDias.getDate() + 30)
    query = query
      .gte('data_fim_vigencia', hoje.toISOString().slice(0, 10))
      .lte('data_fim_vigencia', trintaDias.toISOString().slice(0, 10))
      .in('status', ['vigente', 'proximo_vencimento'])
  }
  if (filters?.vigencia === 'vencidos') {
    const hoje = new Date().toISOString().slice(0, 10)
    query = query
      .lt('data_fim_vigencia', hoje)
      .not('status', 'in', `("encerrado","rescindido")`)
  }

  if (filters?.limit) query = query.limit(filters.limit)
  else query = query.limit(100)
  if (filters?.offset) query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1)

  const { data } = await query
  return (data as Contrato[]) || []
}

export async function getContrato(supabase: SupabaseClient, id: string): Promise<Contrato | null> {
  const { data } = await supabase
    .from('contratos')
    .select(CONTRATO_SELECT)
    .eq('id', id)
    .single()

  return data as Contrato | null
}

export async function createContrato(
  supabase: SupabaseClient,
  contrato: Omit<Contrato, 'id' | 'created_at' | 'updated_at'>,
): Promise<Contrato | null> {
  const { data, error } = await supabase
    .from('contratos')
    .insert(contrato)
    .select()
    .single()

  if (error) throw error
  const created = data as Contrato | null
  if (created) {
    await logHistorico(supabase, {
      contrato_id: created.id,
      entidade: 'contrato',
      entidade_id: created.id,
      acao: 'criacao',
      descricao: `Contrato ${created.numero_contrato} criado`,
      created_by: contrato.created_by,
    })
  }
  return created
}

export async function updateContrato(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Contrato>,
): Promise<Contrato | null> {
  const { data: oldData } = await supabase.from('contratos').select('numero_contrato, status, valor_atual').eq('id', id).single()
  const { data, error } = await supabase
    .from('contratos')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  const updated = data as Contrato | null
  if (updated && oldData) {
    const changes: string[] = []
    if (updates.status && updates.status !== (oldData as Record<string, unknown>).status) {
      changes.push(`status: ${(oldData as Record<string, unknown>).status} → ${updates.status}`)
    }
    if (updates.valor_atual && updates.valor_atual !== (oldData as Record<string, unknown>).valor_atual) {
      changes.push(`valor: ${(oldData as Record<string, unknown>).valor_atual} → ${updates.valor_atual}`)
    }
    await logHistorico(supabase, {
      contrato_id: id,
      entidade: 'contrato',
      entidade_id: id,
      acao: 'atualizacao',
      descricao: changes.length > 0 ? changes.join('; ') : 'Dados atualizados',
      valor_anterior: JSON.stringify((oldData as Record<string, unknown>).status),
      valor_novo: JSON.stringify(updates.status),
      created_by: (updates as Record<string, unknown>).updated_at as string | null,
    })
  }
  return updated
}

export async function deleteContrato(supabase: SupabaseClient, id: string): Promise<void> {
  const { data: oldData } = await supabase.from('contratos').select('id, numero_contrato').eq('id', id).single()
  const { error } = await supabase.from('contratos').delete().eq('id', id)
  if (error) throw error
  if (oldData) {
    await logHistorico(supabase, {
      contrato_id: id,
      entidade: 'contrato',
      entidade_id: id,
      acao: 'exclusao',
      descricao: `Contrato ${(oldData as Record<string, unknown>).numero_contrato} excluído`,
    })
  }
}

export async function getContratoMetricas(supabase: SupabaseClient): Promise<ContratoMetricas> {
  const { data, error } = await supabase.rpc('get_contrato_metricas')
  if (error) throw error

  if (!data || data.length === 0) {
    return {
      total: 0, vigentes: 0, vencendo_30d: 0, vencidos: 0,
      valor_contratado: 0, valor_executado: 0, saldo: 0,
      pagamentos_pendentes: 0, os_em_execucao: 0, aditivos_andamento: 0,
      sem_fiscal: 0, sem_movimentacao: 0,
    }
  }

  return data[0] as ContratoMetricas
}

export function computeValoresBreakdown(contrato: Contrato, aditivos?: ContratoAditivo[]): ValoresBreakdown {
  const original = contrato.valor_original || contrato.valor_inicial || 0
  let totalAcrescimos = 0
  let totalSupressoes = 0

  if (aditivos) {
    for (const ad of aditivos) {
      if (ad.tipo === 'supressao') {
        totalSupressoes += Math.abs(ad.valor_alteracao)
      } else         if (['acrescimo', 'aditivo_valor', 'aditivo_prazo_valor', 'reequilibrio', 'apostilamento'].includes(ad.tipo)) {
        totalAcrescimos += Math.abs(ad.valor_alteracao)
      }
    }
  } else {
    const totalAditivosValor = contrato.total_aditivos || 0
    if (totalAditivosValor >= 0) {
      totalAcrescimos = totalAditivosValor
    } else {
      totalSupressoes = Math.abs(totalAditivosValor)
    }
  }

  const totalAditivos = totalAcrescimos - totalSupressoes
  const valorAtualCalculado = original + totalAditivos
  const diferenca = valorAtualCalculado - (contrato.valor_atual || 0)

  return {
    valorOriginal: original,
    totalAcrescimos,
    totalSupressoes,
    totalAditivos,
    valorAtualCalculado,
    diferenca,
  }
}

export function computeContratoAlertas(contrato: Contrato): ContratoAlerta[] {
  const alertas: ContratoAlerta[] = []
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  if (contrato.status === 'vencido' || contrato.status === 'rescindido') {
    alertas.push({
      tipo: 'vencido',
      mensagem: `Contrato ${contrato.status === 'vencido' ? 'vencido' : 'rescindido'}`,
      gravidade: 'alto',
      acao: 'Encerrar contrato',
    })
  }

  if (contrato.data_fim_vigencia) {
    const fim = new Date(contrato.data_fim_vigencia + 'T00:00:00')
    const diff = Math.ceil((fim.getTime() - hoje.getTime()) / 86400000)
    if (diff >= 0 && diff <= 180) {
      const label = diff >= 90
        ? `${Math.floor(diff / 30)} mes${Math.floor(diff / 30) > 1 ? 'es' : ''}`
        : `${diff} dia${diff !== 1 ? 's' : ''}`
      alertas.push({
        tipo: 'proximo_vencimento',
        mensagem: `Vence em ${label} (${contrato.data_fim_vigencia})`,
        gravidade: diff <= 30 ? 'alto' : diff <= 90 ? 'medio' : 'baixo',
        acao: diff <= 180 ? 'Avaliar renovação ou aditivo de prazo' : 'Avaliar renovação/aditivo',
      })
    }
  }

  if (!contrato.fiscal_tecnico_id && !contrato.fiscal_administrativo_id && contrato.status === 'vigente') {
    alertas.push({
      tipo: 'sem_fiscal',
      mensagem: 'Sem fiscal designado',
      gravidade: 'alto',
      acao: 'Designar fiscal',
    })
  }

  if (contrato.tem_garantia && !contrato.link_sei) {
    alertas.push({
      tipo: 'sem_garantia',
      mensagem: 'Garantia contratual não anexada',
      gravidade: 'medio',
      acao: 'Anexar garantia',
    })
  }

  const saldo = (contrato.valor_atual || 0) - (contrato.valor_executado || 0)
  if (contrato.valor_atual > 0 && saldo / contrato.valor_atual < 0.1) {
    alertas.push({
      tipo: 'saldo_baixo',
      mensagem: `Saldo abaixo de 10% (R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`,
      gravidade: 'medio',
      acao: 'Avaliar aditivo de valor',
    })
  }

  const execPercent = contrato.valor_atual > 0 ? (contrato.valor_executado / contrato.valor_atual) * 100 : 0
  if (execPercent > 80 && execPercent < 100) {
    alertas.push({
      tipo: 'execucao_avancada',
      mensagem: `Execução em ${execPercent.toFixed(0)}%`,
      gravidade: 'baixo',
      acao: 'Programar encerramento',
    })
  }

  return alertas
}

export function computeSaldoContrato(contrato: Contrato): number {
  return (contrato.valor_atual || 0) - (contrato.valor_executado || 0)
}

export function computeDiasRestantes(dataFim: string | null): number {
  if (!dataFim) return 0
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const fim = new Date(dataFim + 'T00:00:00')
  return Math.ceil((fim.getTime() - hoje.getTime()) / 86400000)
}
