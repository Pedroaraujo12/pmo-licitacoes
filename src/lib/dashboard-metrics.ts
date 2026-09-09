/**
 * Métricas do dashboard — funções puras, sem dependência de rede ou de React.
 *
 * O dashboard já agregava "em andamento por responsável" no cliente; estas
 * funções estendem o mesmo padrão para prazo, ciclo e tendência, evitando
 * novas RPCs. Tudo aqui recebe `hoje` por parâmetro para ser testável.
 */

/** Status em que o processo não está mais pendente — não conta como atraso. */
export const STATUS_TERMINAIS = ['Concluído', 'Homologado', 'Cancelado', 'Devolvido', 'Suspenso'] as const

/** Status que representam processo efetivamente entregue. */
export const STATUS_CONCLUIDOS = ['Concluído', 'Homologado'] as const

export type FaixaPrazo =
  | 'atraso_acima_30'
  | 'atraso_16_30'
  | 'atraso_1_15'
  | 'vencendo'
  | 'no_prazo'
  | 'sem_prazo'
  | 'encerrado'

export interface ProcessoPrazo {
  data_entrega: string | null
  status_nome: string | null
}

export interface FaixaPrazoInfo {
  faixa: FaixaPrazo
  rotulo: string
  /** Cor do mark. Rampa ordinal de matiz única para atraso; âmbar para "a vencer". */
  cor: string
  /** Se a faixa representa processo pendente que já passou do prazo. */
  atrasada: boolean
}

/**
 * Faixas na ordem de leitura do gráfico: o que vence primeiro no topo,
 * o atraso mais grave embaixo. A rampa de atraso vai do mais escuro
 * (menos grave) ao mais claro (mais grave) porque o fundo é escuro —
 * no escuro, mais claro é mais visível, logo mais urgente.
 */
export const FAIXAS_PRAZO: FaixaPrazoInfo[] = [
  { faixa: 'vencendo', rotulo: 'Vence em até 7 dias', cor: '#c98500', atrasada: false },
  { faixa: 'atraso_1_15', rotulo: 'Atraso de 1 a 15 dias', cor: '#a92f3c', atrasada: true },
  { faixa: 'atraso_16_30', rotulo: 'Atraso de 16 a 30 dias', cor: '#c8474c', atrasada: true },
  { faixa: 'atraso_acima_30', rotulo: 'Atraso acima de 30 dias', cor: '#dd6963', atrasada: true },
]

/**
 * O alerta do topo fala dos atrasados como um grupo; o gráfico fala de faixas.
 * Os dois filtram a mesma tabela, então o filtro aceita as duas granularidades.
 */
export type FiltroPrazo = FaixaPrazo | 'atrasados'

export const ROTULO_FILTRO_PRAZO: Record<string, string> = {
  atrasados: 'Em atraso (todas as faixas)',
  no_prazo: 'No prazo',
  sem_prazo: 'Sem prazo definido',
  encerrado: 'Encerrado',
}
for (const f of FAIXAS_PRAZO) ROTULO_FILTRO_PRAZO[f.faixa] = f.rotulo

/** Se a faixa do processo satisfaz o filtro selecionado. */
export function combinaFiltroPrazo(faixa: FaixaPrazo, filtro: FiltroPrazo | null): boolean {
  if (!filtro) return true
  if (filtro === 'atrasados') return faixa.startsWith('atraso_')
  return faixa === filtro
}

/** Converte 'YYYY-MM-DD' para Date em horário local, sem escorregar de fuso. */
export function parseDateOnly(valor: string | null | undefined): Date | null {
  if (!valor) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

function meiaNoite(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * Dias entre hoje e a data de entrega. Negativo = atrasado, 0 = vence hoje.
 * Retorna null quando não há data de entrega.
 */
export function diasAteEntrega(dataEntrega: string | null, hoje: Date): number | null {
  const entrega = parseDateOnly(dataEntrega)
  if (!entrega) return null
  const ms = meiaNoite(entrega).getTime() - meiaNoite(hoje).getTime()
  return Math.round(ms / 86_400_000)
}

export function isStatusTerminal(status: string | null): boolean {
  return STATUS_TERMINAIS.includes((status || '').trim() as (typeof STATUS_TERMINAIS)[number])
}

export function isStatusConcluido(status: string | null): boolean {
  return STATUS_CONCLUIDOS.includes((status || '').trim() as (typeof STATUS_CONCLUIDOS)[number])
}

/**
 * Classifica o processo numa faixa de prazo, aplicando a mesma regra de status
 * terminal usada pelo `get_dashboard_summary` — processo encerrado não atrasa.
 */
export function classificarPrazo(processo: ProcessoPrazo, hoje: Date): FaixaPrazo {
  if (isStatusTerminal(processo.status_nome)) return 'encerrado'
  const dias = diasAteEntrega(processo.data_entrega, hoje)
  if (dias === null) return 'sem_prazo'
  if (dias < 0) {
    const atraso = Math.abs(dias)
    if (atraso > 30) return 'atraso_acima_30'
    if (atraso > 15) return 'atraso_16_30'
    return 'atraso_1_15'
  }
  if (dias <= 7) return 'vencendo'
  return 'no_prazo'
}

export interface ContagemFaixa extends FaixaPrazoInfo {
  total: number
}

/** Contagem por faixa, sempre nas 4 faixas do gráfico e sempre na mesma ordem. */
export function agruparPorFaixaDePrazo(processos: ProcessoPrazo[], hoje: Date): ContagemFaixa[] {
  const contagem = new Map<FaixaPrazo, number>()
  for (const p of processos) {
    const faixa = classificarPrazo(p, hoje)
    contagem.set(faixa, (contagem.get(faixa) || 0) + 1)
  }
  return FAIXAS_PRAZO.map(f => ({ ...f, total: contagem.get(f.faixa) || 0 }))
}

/** Percentual do estimado que já virou homologado. 0 quando não há estimado. */
export function calcularTaxaHomologacao(estimado: number, homologado: number): number {
  if (!estimado || estimado <= 0) return 0
  return (homologado / estimado) * 100
}

/**
 * Economia em percentual sobre o estimado dos processos já concluídos —
 * é esse o denominador correto, não a carteira inteira: processos que ainda
 * não foram homologados não tiveram chance de economizar.
 */
export function calcularEconomiaPercentual(economia: number, estimadoConcluidos: number): number {
  if (!estimadoConcluidos || estimadoConcluidos <= 0) return 0
  return (economia / estimadoConcluidos) * 100
}

export interface ProcessoConcluido {
  status_nome: string | null
  /** Data da última atividade registrada — a melhor aproximação de conclusão. */
  data_atividade: string | null
}

export interface PontoMensal {
  /** Chave ordenável 'YYYY-MM'. */
  chave: string
  /** Rótulo curto do eixo: 'Mar', 'Abr'… */
  rotulo: string
  total: number
}

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/**
 * Concluídos por mês nos últimos `meses` meses (incluindo o corrente).
 * Meses sem conclusão aparecem com zero — uma série temporal com buracos
 * mente sobre a cadência.
 */
export function agruparConcluidosPorMes(
  processos: ProcessoConcluido[],
  hoje: Date,
  meses = 6,
): PontoMensal[] {
  const janelas: PontoMensal[] = []
  const indice = new Map<string, number>()
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    indice.set(chave, janelas.length)
    janelas.push({ chave, rotulo: MESES_CURTOS[d.getMonth()], total: 0 })
  }

  for (const p of processos) {
    if (!isStatusConcluido(p.status_nome)) continue
    const d = parseDateOnly(p.data_atividade)
    if (!d) continue
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const pos = indice.get(chave)
    if (pos !== undefined) janelas[pos].total += 1
  }

  return janelas
}

export interface ProcessoHistorico {
  status_nome: string | null
  data_entrada: string | null
  data_entrega: string | null
  /** Última atividade registrada — usada como aproximação da data de conclusão. */
  data_atividade: string | null
  valor_estimado: number
  valor_homologado: number
}

export interface PontoSerie {
  chave: string
  rotulo: string
  atrasados: number
  taxaHomologacao: number
  economiaPercentual: number
}

/** Último instante do mês de `d`, para comparações "até o fim do mês". */
function fimDoMes(ano: number, mes: number): Date {
  return new Date(ano, mes + 1, 0)
}

/**
 * Reconstrói a série mensal dos indicadores a partir do estado atual.
 *
 * Não há histórico de status no banco, então a reconstrução assume que:
 *   - o processo entrou na carteira em `data_entrada`;
 *   - um processo hoje concluído foi concluído em `data_atividade`;
 *   - `valor_homologado` foi fixado na conclusão.
 *
 * Isso é fiel para homologação e economia (ambos só mudam na conclusão) e é
 * uma aproximação para atraso — um processo hoje cancelado aparece como
 * pendente nos meses anteriores ao cancelamento. Sem histórico de status não
 * há como fazer melhor, e a alternativa seria não mostrar tendência alguma.
 */
export function reconstruirSerieMensal(
  processos: ProcessoHistorico[],
  hoje: Date,
  meses = 6,
): PontoSerie[] {
  const pontos: PontoSerie[] = []

  for (let i = meses - 1; i >= 0; i--) {
    const refer = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    const corte = i === 0 ? meiaNoite(hoje) : fimDoMes(refer.getFullYear(), refer.getMonth())
    const chave = `${refer.getFullYear()}-${String(refer.getMonth() + 1).padStart(2, '0')}`

    let atrasados = 0
    let estimadoNaCarteira = 0
    let homologadoAcumulado = 0
    let estimadoConcluido = 0

    for (const p of processos) {
      const entrada = parseDateOnly(p.data_entrada)
      if (entrada && meiaNoite(entrada) > corte) continue

      estimadoNaCarteira += Number(p.valor_estimado) || 0

      const concluido = isStatusConcluido(p.status_nome)
      const fim = parseDateOnly(p.data_atividade)
      const jaConcluido = concluido && fim !== null && meiaNoite(fim) <= corte

      if (jaConcluido) {
        homologadoAcumulado += Number(p.valor_homologado) || 0
        estimadoConcluido += Number(p.valor_estimado) || 0
        continue
      }

      if (isStatusTerminal(p.status_nome) && !concluido) continue

      const entrega = parseDateOnly(p.data_entrega)
      if (entrega && meiaNoite(entrega) < corte) atrasados += 1
    }

    pontos.push({
      chave,
      rotulo: MESES_CURTOS[refer.getMonth()],
      atrasados,
      taxaHomologacao: calcularTaxaHomologacao(estimadoNaCarteira, homologadoAcumulado),
      economiaPercentual: calcularEconomiaPercentual(
        estimadoConcluido - homologadoAcumulado,
        estimadoConcluido,
      ),
    })
  }

  return pontos
}

export interface AtividadeCronograma {
  fase: string | null
  descricao: string | null
  status: string | null
  data_inicio: string | null
  data_fim: string | null
}

export interface LeadTimeFase {
  fase: string
  /** Média de dias corridos entre início e fim das atividades concluídas. */
  dias: number
  /** Quantas atividades entraram na média — abaixo de 3 a média é frágil. */
  amostra: number
}

/**
 * Tempo médio por fase, a partir das atividades de cronograma já concluídas.
 * Só entram atividades com início e fim e com fim não anterior ao início.
 * Ordena da fase mais lenta para a mais rápida — é a leitura que interessa.
 */
export function calcularLeadTimePorFase(
  atividades: AtividadeCronograma[],
  opcoes: { amostraMinima?: number; limite?: number } = {},
): LeadTimeFase[] {
  const { amostraMinima = 1, limite = 6 } = opcoes
  const acc = new Map<string, { soma: number; n: number }>()

  for (const a of atividades) {
    if ((a.status || '').trim() !== 'concluido') continue
    const inicio = parseDateOnly(a.data_inicio)
    const fim = parseDateOnly(a.data_fim)
    if (!inicio || !fim) continue
    const dias = Math.round((meiaNoite(fim).getTime() - meiaNoite(inicio).getTime()) / 86_400_000)
    if (dias < 0) continue
    const fase = (a.fase || '').trim() || (a.descricao || '').trim()
    if (!fase) continue
    const atual = acc.get(fase) || { soma: 0, n: 0 }
    atual.soma += dias
    atual.n += 1
    acc.set(fase, atual)
  }

  return Array.from(acc.entries())
    .filter(([, v]) => v.n >= amostraMinima)
    .map(([fase, v]) => ({ fase, dias: Math.round(v.soma / v.n), amostra: v.n }))
    .sort((a, b) => b.dias - a.dias)
    .slice(0, limite)
}

export interface CargaResponsavel {
  nome: string
  total: number
  atrasados: number
}

/**
 * Carga por responsável entre os processos em andamento, com a parcela em
 * atraso destacada. A cor do gráfico passa a codificar atraso em vez de
 * repetir a ordenação das barras.
 */
export function agruparCargaPorResponsavel(
  processos: (ProcessoPrazo & { responsavel_nome: string | null })[],
  hoje: Date,
  limite = 10,
): CargaResponsavel[] {
  const acc = new Map<string, CargaResponsavel>()
  for (const p of processos) {
    if ((p.status_nome || '').trim() !== 'Em andamento') continue
    const nome = (p.responsavel_nome || '').trim() || 'Sem responsável'
    const atual = acc.get(nome) || { nome, total: 0, atrasados: 0 }
    atual.total += 1
    const faixa = classificarPrazo(p, hoje)
    if (faixa.startsWith('atraso_')) atual.atrasados += 1
    acc.set(nome, atual)
  }
  return Array.from(acc.values())
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, limite)
}

/** Rótulo de prazo para a coluna da tabela. */
export function rotuloPrazo(processo: ProcessoPrazo, hoje: Date): { texto: string; tom: 'atraso' | 'alerta' | 'neutro' } {
  if (isStatusTerminal(processo.status_nome)) return { texto: '—', tom: 'neutro' }
  const dias = diasAteEntrega(processo.data_entrega, hoje)
  if (dias === null) return { texto: 'sem prazo', tom: 'neutro' }
  if (dias < 0) {
    const atraso = Math.abs(dias)
    return { texto: `${atraso} ${atraso === 1 ? 'dia' : 'dias'} de atraso`, tom: 'atraso' }
  }
  if (dias === 0) return { texto: 'vence hoje', tom: 'alerta' }
  if (dias <= 7) return { texto: `vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}`, tom: 'alerta' }
  return { texto: `${dias} dias restantes`, tom: 'neutro' }
}
