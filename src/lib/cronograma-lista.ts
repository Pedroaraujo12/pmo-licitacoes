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
  responsavel_nome: string | null
  valor_estimado: number | null
  total_atividades: number
  concluidas: number
  atrasadas: number
  ultima_fase: string | null
  /** Etapa em que o processo está: a pendente de menor ordem. */
  etapa_atual: string | null
  etapa_atual_ordem: number | null
  progresso: number
  processo_atrasado: boolean
}

export interface EtapaContagem {
  etapa: string
  ordem: number
  total: number
  /** Falso quando a etapa não pertence ao rito atual da modalidade. */
  noModelo?: boolean
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
  descricao: string | null
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

    // Etapa atual = a pendente de MENOR ordem. É onde o processo está de
    // fato, não a última que falta — a diferença importa para o filtro.
    const etapaAtual = pendentes.length > 0 ? pendentes[pendentes.length - 1] : null

    const dataEntrega = (p.data_entrega as string | null) ?? null

    return {
      id,
      id_processo: (p.id_processo as string | null) ?? null,
      objeto_resumido: (p.objeto_resumido as string | null) ?? null,
      data_entrada: (p.data_entrada as string | null) ?? null,
      data_entrega: dataEntrega,
      modalidade_nome: nomeDaRelacao(p.modalidades),
      status_nome: nomeDaRelacao(p.status_processo),
      responsavel_nome: nomeDaRelacao(p.responsaveis),
      valor_estimado: p.valor_estimado === null || p.valor_estimado === undefined
        ? null
        : Number(p.valor_estimado),
      total_atividades: total,
      concluidas,
      atrasadas,
      ultima_fase: pendentes[0]?.fase ?? null,
      etapa_atual: etapaAtual?.descricao ?? null,
      etapa_atual_ordem: etapaAtual?.ordem ?? null,
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

/**
 * Quantos processos há em cada etapa, ordenado pela sequência do rito.
 * Processos sem cronograma ficam agrupados à parte.
 */
export function calcularDistribuicaoEtapas(linhas: LinhaCronograma[]): EtapaContagem[] {
  const mapa = new Map<string, EtapaContagem>()

  for (const l of linhas) {
    const etapa = l.etapa_atual ?? SEM_CRONOGRAMA
    const ordem = l.etapa_atual_ordem ?? Number.MAX_SAFE_INTEGER
    const atual = mapa.get(etapa)
    if (atual) {
      atual.total += 1
      atual.ordem = Math.min(atual.ordem, ordem)
    } else {
      mapa.set(etapa, { etapa, ordem, total: 1 })
    }
  }

  return [...mapa.values()].sort((a, b) => a.ordem - b.ordem || a.etapa.localeCompare(b.etapa, 'pt-BR'))
}

/** Rótulo para processos que ainda não têm cronograma gerado. */
export const SEM_CRONOGRAMA = 'Sem cronograma'

/**
 * Identidade de uma etapa: posição + nome.
 * Só o nome não basta — ritos repetem descrições em fases diferentes.
 */
export function chaveEtapa(ordem: number | null, descricao: string): string {
  return `${ordem ?? 'x'}|${descricao}`
}

/** Chave da etapa em que o processo está. */
export function chaveEtapaDaLinha(linha: LinhaCronograma): string {
  return linha.etapa_atual
    ? chaveEtapa(linha.etapa_atual_ordem, linha.etapa_atual)
    : chaveEtapa(null, SEM_CRONOGRAMA)
}

/**
 * Distribuição sobre o rito completo da modalidade: todas as etapas do
 * modelo aparecem, inclusive as que hoje não têm nenhum processo — é o que
 * mostra onde a fila está vazia e onde acumula.
 *
 * Etapas presentes nos processos mas ausentes do modelo (cronogramas antigos,
 * anteriores aos modelos por modalidade) entram ao final, marcadas, em vez de
 * desaparecerem da contagem.
 */
export function distribuicaoComModelo(
  linhas: LinhaCronograma[],
  etapasModelo: { ordem: number; descricao: string }[],
): EtapaContagem[] {
  // Ritos repetem descrições: a Concorrência tem "Prazo Recursal" duas vezes,
  // na fase de habilitação e na de julgamento. Identificar etapa por nome
  // somaria as duas na mesma linha e duplicaria a contagem. A identidade é
  // posição + nome.
  const contagem = new Map<string, number>()
  for (const l of linhas) {
    const k = chaveEtapaDaLinha(l)
    contagem.set(k, (contagem.get(k) ?? 0) + 1)
  }

  const doModelo: EtapaContagem[] = [...etapasModelo]
    .sort((a, b) => a.ordem - b.ordem)
    .map(e => ({
      etapa: e.descricao,
      ordem: e.ordem,
      total: contagem.get(chaveEtapa(e.ordem, e.descricao)) ?? 0,
      noModelo: true,
    }))

  const chavesDoModelo = new Set(etapasModelo.map(e => chaveEtapa(e.ordem, e.descricao)))

  const foraDoModelo: EtapaContagem[] = [...contagem.entries()]
    .filter(([k]) => !chavesDoModelo.has(k))
    .map(([k, total]) => {
      const separador = k.indexOf('|')
      const ordemBruta = k.slice(0, separador)
      const etapa = k.slice(separador + 1)
      return {
        etapa,
        ordem: ordemBruta === 'x' ? Number.MAX_SAFE_INTEGER : Number(ordemBruta),
        total,
        noModelo: false,
      }
    })
    .sort((a, b) => {
      if (a.etapa === SEM_CRONOGRAMA) return 1
      if (b.etapa === SEM_CRONOGRAMA) return -1
      return a.ordem - b.ordem || a.etapa.localeCompare(b.etapa, 'pt-BR')
    })

  return [...doModelo, ...foraDoModelo]
}

/** Modalidades presentes na lista, para o seletor. */
export function modalidadesPresentes(linhas: LinhaCronograma[]): string[] {
  const nomes = new Set<string>()
  for (const l of linhas) if (l.modalidade_nome) nomes.add(l.modalidade_nome)
  return [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/**
 * Todos os processos do filtro, já agregados. A paginação acontece na tela.
 *
 * Nesta escala (dezenas de processos) trazer tudo de uma vez é barato e
 * permite contar quantos estão em cada etapa sobre o conjunto inteiro — uma
 * contagem feita só sobre a página exibida seria enganosa.
 */
export async function listarCronogramaCompleto(
  supabase: SupabaseClient,
  opcoes: { statusNomes: string[] | null; busca: string | null; teto?: number },
): Promise<{ linhas: LinhaCronograma[]; truncado: boolean }> {
  const teto = opcoes.teto ?? 500
  const { linhas, total } = await listarCronograma(supabase, {
    statusNomes: opcoes.statusNomes,
    busca: opcoes.busca,
    limite: teto,
    offset: 0,
  })
  return { linhas, truncado: total > linhas.length }
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
      'id, id_processo, objeto_resumido, data_entrada, data_entrega, valor_estimado, modalidades(nome), status_processo(nome), responsaveis(nome)',
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
    .select('processo_id, status, data_fim, fase, descricao, ordem')
    .in('processo_id', lista.map(p => p.id as string))

  return {
    linhas: agregarLinhas(lista, (atividades ?? []) as unknown as AtividadeResumo[], hojeISO()),
    total: count ?? lista.length,
  }
}
