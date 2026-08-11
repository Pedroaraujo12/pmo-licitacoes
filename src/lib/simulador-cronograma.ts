import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Simulador de cronograma — projeta as datas de um processo antes de cadastrá-lo.
 *
 * A projeção replica a função `somar_dias_uteis` do banco (migration 00002):
 * convenção INCLUSIVA (o próprio dia de início conta como o primeiro dia útil)
 * e feriados vindos da tabela `feriados`. Assim a simulação bate com o
 * cronograma que `criar_cronograma_para_processo` grava de fato.
 */

export interface ModalidadeComModelo {
  modalidade_id: string
  modalidade_nome: string
  modelo_id: string
  modelo_nome: string
  total_dias_uteis: number
}

export interface EtapaModelo {
  ordem: number
  fase: string
  descricao: string
  setor: string
  duracao_dias_uteis: number
}

export interface EtapaProjetada extends EtapaModelo {
  data_inicio: string | null
  data_fim: string | null
  cumprida: boolean
}

export interface ResumoProjecao {
  etapas: EtapaProjetada[]
  pendentes: number
  dias_uteis: number
  dias_corridos: number
  data_inicio: string | null
  data_conclusao: string | null
}

// --- datas (date-only, sem UTC) ---------------------------------------------

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toISO(date: Date): string {
  const mes = String(date.getMonth() + 1).padStart(2, '0')
  const dia = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mes}-${dia}`
}

function addDays(date: Date, dias: number): Date {
  const d = new Date(date.getTime())
  d.setDate(d.getDate() + dias)
  return d
}

/** Falso em fim de semana ou feriado cadastrado. */
export function isDiaUtil(date: Date, feriados: Set<string>): boolean {
  const dow = date.getDay()
  if (dow === 0 || dow === 6) return false
  return !feriados.has(toISO(date))
}

function proximoDiaUtil(date: Date, feriados: Set<string>): Date {
  let cur = date
  let guard = 0
  while (!isDiaUtil(cur, feriados) && guard < 400) {
    cur = addDays(cur, 1)
    guard++
  }
  return cur
}

/**
 * Equivalente client-side de `somar_dias_uteis(data_inicio, qtd_dias)`.
 * Uma etapa de 1 dia útil começa e termina no mesmo dia; duração 0 é marco.
 */
export function somarDiasUteis(inicio: Date, qtdDias: number, feriados: Set<string>): Date {
  const base = proximoDiaUtil(inicio, feriados)
  if (qtdDias <= 0) return base

  let cur = base
  let contados = 1
  let guard = 0
  while (contados < qtdDias && guard < 4000) {
    cur = proximoDiaUtil(addDays(cur, 1), feriados)
    contados++
    guard++
  }
  return cur
}

/**
 * Encadeia as etapas do modelo a partir de `dataInicio`.
 *
 * `aPartirDe` (ordem 1-based) permite projetar um processo já em andamento:
 * as etapas anteriores voltam marcadas como cumpridas e sem datas, e a
 * contagem recomeça na data informada.
 */
export function projetarCronograma(
  etapas: EtapaModelo[],
  dataInicio: string,
  feriados: Set<string>,
  aPartirDe = 1,
): ResumoProjecao {
  const corte = Math.max(aPartirDe, 1)
  const base = parseDate(dataInicio)
  let cursor = base
  const projetadas: EtapaProjetada[] = []

  for (const etapa of etapas) {
    if (etapa.ordem < corte) {
      projetadas.push({ ...etapa, data_inicio: null, data_fim: null, cumprida: true })
      continue
    }

    const inicio = proximoDiaUtil(cursor, feriados)
    const fim = somarDiasUteis(inicio, etapa.duracao_dias_uteis, feriados)

    projetadas.push({
      ...etapa,
      data_inicio: toISO(inicio),
      data_fim: toISO(fim),
      cumprida: false,
    })

    cursor = addDays(fim, 1)
  }

  const pendentes = projetadas.filter(e => !e.cumprida)
  const primeira = pendentes[0] ?? null
  const ultima = pendentes[pendentes.length - 1] ?? null

  return {
    etapas: projetadas,
    pendentes: pendentes.length,
    dias_uteis: pendentes.reduce((acc, e) => acc + e.duracao_dias_uteis, 0),
    dias_corridos: ultima?.data_fim
      ? Math.round((parseDate(ultima.data_fim).getTime() - base.getTime()) / 86400000)
      : 0,
    data_inicio: primeira?.data_inicio ?? null,
    data_conclusao: ultima?.data_fim ?? null,
  }
}

// --- acesso a dados ---------------------------------------------------------

/** Modalidades que possuem modelo de cronograma ativo. */
export async function listModalidadesComModelo(
  supabase: SupabaseClient,
): Promise<ModalidadeComModelo[]> {
  const { data, error } = await supabase
    .from('modelo_cronograma')
    .select('id, nome, total_dias_uteis, modalidade_id, modalidades(nome)')
    .eq('ativo', true)

  if (error || !data) return []

  return data
    .map(row => {
      const rel = (row as Record<string, unknown>).modalidades
      const nome = Array.isArray(rel)
        ? (rel[0] as { nome?: string } | undefined)?.nome
        : (rel as { nome?: string } | null)?.nome

      return {
        modalidade_id: row.modalidade_id as string,
        modalidade_nome: nome ?? 'Sem modalidade',
        modelo_id: row.id as string,
        modelo_nome: row.nome as string,
        total_dias_uteis: row.total_dias_uteis as number,
      }
    })
    .sort((a, b) => a.modalidade_nome.localeCompare(b.modalidade_nome, 'pt-BR'))
}

/** Etapas de um modelo, em ordem. */
export async function listEtapasModelo(
  supabase: SupabaseClient,
  modeloId: string,
): Promise<EtapaModelo[]> {
  const { data, error } = await supabase
    .from('modelo_etapa')
    .select('ordem, fase, descricao, setor, duracao_dias_uteis')
    .eq('modelo_cronograma_id', modeloId)
    .order('ordem', { ascending: true })

  if (error || !data) return []
  return data as EtapaModelo[]
}

/**
 * Etapas do modelo ativo de uma modalidade, em ordem.
 * Usado pelos formulários de processo para que "Atividade Atual" ofereça as
 * etapas do rito real, e não uma lista fixa.
 */
export async function listEtapasPorModalidade(
  supabase: SupabaseClient,
  modalidadeId: string,
): Promise<EtapaModelo[]> {
  const { data, error } = await supabase
    .from('modelo_cronograma')
    .select('id')
    .eq('modalidade_id', modalidadeId)
    .eq('ativo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.id) return []
  return listEtapasModelo(supabase, data.id as string)
}

/**
 * Etapas de vários modelos de uma vez, agrupadas por modelo.
 * Evita uma consulta por modalidade ao montar o comparativo entre ritos.
 */
export async function listEtapasDeModelos(
  supabase: SupabaseClient,
  modeloIds: string[],
): Promise<Record<string, EtapaModelo[]>> {
  if (modeloIds.length === 0) return {}

  const { data, error } = await supabase
    .from('modelo_etapa')
    .select('modelo_cronograma_id, ordem, fase, descricao, setor, duracao_dias_uteis')
    .in('modelo_cronograma_id', modeloIds)
    .order('ordem', { ascending: true })

  if (error || !data) return {}

  const porModelo: Record<string, EtapaModelo[]> = {}
  for (const row of data) {
    const id = (row as { modelo_cronograma_id: string }).modelo_cronograma_id
    if (!porModelo[id]) porModelo[id] = []
    porModelo[id].push({
      ordem: row.ordem as number,
      fase: row.fase as string,
      descricao: row.descricao as string,
      setor: row.setor as string,
      duracao_dias_uteis: row.duracao_dias_uteis as number,
    })
  }
  return porModelo
}

/**
 * Feriados cadastrados, como Set de 'YYYY-MM-DD'.
 * Se a tabela não cobrir o período projetado, a contagem só pula fins de
 * semana — a página avisa o usuário nesse caso.
 */
export async function listFeriados(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase.from('feriados').select('data')
  if (error || !data) return new Set()
  return new Set(data.map(f => String((f as { data: string }).data)))
}

/**
 * Soma das durações das etapas — o número que de fato gera as datas.
 *
 * Pode divergir de `modelo_cronograma.total_dias_uteis`, que é o total oficial
 * declarado pela área. O DIOP de Concorrência, por exemplo, declara 107 dias
 * mas suas etapas somam 99. A projeção usa sempre esta soma; a divergência é
 * exibida ao usuário em vez de silenciada.
 */
export function somaDiasUteis(etapas: EtapaModelo[]): number {
  return etapas.reduce((acc, e) => acc + e.duracao_dias_uteis, 0)
}

/** Último ano coberto pelo calendário de feriados (null se vazio). */
export function ultimoAnoComFeriados(feriados: Set<string>): number | null {
  let maior: number | null = null
  for (const d of feriados) {
    const ano = Number(d.slice(0, 4))
    if (!Number.isNaN(ano) && (maior === null || ano > maior)) maior = ano
  }
  return maior
}
