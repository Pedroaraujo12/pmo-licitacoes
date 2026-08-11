import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Lista do Cronograma de Processos montada diretamente das tabelas.
 *
 * A versão anterior dependia de `get_cronograma_page` filtrar por status. Como
 * o parâmetro só existe depois de uma migration, havia um caminho alternativo
 * que cruzava ids no cliente — e qualquer falha silenciosa nesse cruzamento
 * fazia a tela exibir todos os processos como se fossem os em andamento.
 *
 * Aqui a consulta parte dos processos com o status pedido e agrega o
 * cronograma deles. O filtro é a própria consulta: não há como ele deixar de
 * ser aplicado sem que a lista venha vazia — e vazio é visível, ao contrário
 * de uma lista completa que se passa por filtrada.
 */

export interface LinhaCronograma {
  id: string
  id_processo: string | null
  objeto_resumido: string | null
  data_entrada: string | null
  data_entrega: string | null
  modalidade_nome: string | null
  status_nome: string | null
  total_atividades: number
  concluidas: number
  atrasadas: number
  ultima_fase: string | null
  progresso: number
  processo_atrasado: boolean
}

export interface ResultadoLista {
  linhas: LinhaCronograma[]
  total: number
}

interface AtividadeResumo {
  processo_id: string
  status: string
  data_fim: string | null
  fase: string | null
  ordem: number
}

/** Extrai `nome` de uma relação que o PostgREST pode devolver como objeto ou lista. */
function nomeDaRelacao(valor: unknown): string | null {
  if (!valor) return null
  const alvo = Array.isArray(valor) ? valor[0] : valor
  return (alvo as { nome?: string })?.nome ?? null
}

/**
 * Agrega as atividades por processo — mesma conta que a RPC faz no banco.
 * Exportada para teste: é aqui que mora a aritmética de progresso e atraso.
 */
export function agregarLinhas(
  processos: Record<string, unknown>[],
  atividades: AtividadeResumo[],
  hoje: string,
): LinhaCronograma[] {
  const porProcesso = new Map<string, AtividadeResumo[]>()
  for (const a of atividades) {
    const lista = porProcesso.get(a.processo_id) ?? []
    lista.push(a)
    porProcesso.set(a.processo_id, lista)
  }

  return processos.map(p => {
    const id = p.id as string
    const doProcesso = porProcesso.get(id) ?? []

    const total = doProcesso.length
    const concluidas = doProcesso.filter(a => a.status === 'concluido').length
    const atrasadas = doProcesso.filter(
      a => a.status !== 'concluido' && !!a.data_fim && a.data_fim < hoje,
    ).length

    // Última fase = a fase da etapa pendente de maior ordem, como na RPC
    const pendentes = doProcesso
      .filter(a => a.status !== 'concluido')
      .sort((x, y) => y.ordem - x.ordem)

    const dataEntrega = (p.data_entrega as string | null) ?? null

    return {
      id,
      id_processo: (p.id_processo as string | null) ?? null,
      objeto_resumido: (p.objeto_resumido as string | null) ?? null,
      data_entrada: (p.data_entrada as string | null) ?? null,
      data_entrega: dataEntrega,
      modalidade_nome: nomeDaRelacao(p.modalidades),
      status_nome: nomeDaRelacao(p.status_processo),
      total_atividades: total,
      concluidas,
      atrasadas,
      ultima_fase: pendentes[0]?.fase ?? null,
      progresso: total > 0 ? Math.floor((concluidas * 100) / total) : 0,
      processo_atrasado:
        atrasadas > 0 || (!!dataEntrega && dataEntrega < hoje && concluidas < total),
    }
  })
}

/** Data de hoje em YYYY-MM-DD, hora local. */
export function hojeISO(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

export async function listarCronograma(
  supabase: SupabaseClient,
  opcoes: {
    statusNomes: string[] | null
    busca: string | null
    limite: number
    offset: number
  },
): Promise<ResultadoLista> {
  const { statusNomes, busca, limite, offset } = opcoes

  let statusIds: string[] | null = null
  if (statusNomes && statusNomes.length > 0) {
    const { data } = await supabase
      .from('status_processo')
      .select('id')
      .in('nome', statusNomes)

    statusIds = (data ?? []).map(s => (s as { id: string }).id)

    // Status pedido não existe no cadastro: lista vazia é a resposta correta,
    // e a tela avisa. Devolver tudo seria mentir sobre o filtro.
    if (statusIds.length === 0) return { linhas: [], total: 0 }
  }

  let query = supabase
    .from('processos')
    .select(
      'id, id_processo, objeto_resumido, data_entrada, data_entrega, modalidades(nome), status_processo(nome)',
      { count: 'exact' },
    )

  if (statusIds) query = query.in('status_id', statusIds)
  if (busca) query = query.or(`id_processo.ilike.%${busca}%,objeto_resumido.ilike.%${busca}%`)

  const { data: processos, count } = await query
    .order('data_entrega', { ascending: true, nullsFirst: false })
    .range(offset, offset + limite - 1)

  const lista = (processos ?? []) as Record<string, unknown>[]
  if (lista.length === 0) return { linhas: [], total: count ?? 0 }

  const { data: atividades } = await supabase
    .from('cronograma_atividades')
    .select('processo_id, status, data_fim, fase, ordem')
    .in('processo_id', lista.map(p => p.id as string))

  return {
    linhas: agregarLinhas(lista, (atividades ?? []) as unknown as AtividadeResumo[], hojeISO()),
    total: count ?? lista.length,
  }
}
