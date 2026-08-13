/**
 * Persistência dos filtros da tela Cronograma de Processos.
 *
 * A tela é usada para trabalhar uma fatia do conjunto: "os processos de
 * Pregão da minha coordenação parados na etapa X". Ao abrir um processo
 * dessa fatia e voltar, a tela remonta e todo o recorte se perde — a pessoa
 * refaz quatro filtros para abrir o processo seguinte da mesma lista.
 *
 * Guardamos o recorte em `sessionStorage`: vale enquanto a aba estiver
 * aberta e não vaza para outra sessão ou outro usuário da mesma máquina.
 */

export interface FiltrosCronograma {
  search: string
  apenasAndamento: boolean
  modalidadeFiltro: string | null
  coordenacaoFiltro: string | null
  responsavelFiltro: string | null
  prioridadeFiltro: string | null
  etapaFiltro: string | null
  page: number
  scrollY: number
}

export const FILTROS_PADRAO: FiltrosCronograma = {
  search: '',
  apenasAndamento: true,
  modalidadeFiltro: null,
  coordenacaoFiltro: null,
  responsavelFiltro: null,
  prioridadeFiltro: null,
  etapaFiltro: null,
  page: 1,
  scrollY: 0,
}

const CHAVE = 'pmo_cronograma_filtros'

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

/**
 * Converte o que veio do storage em filtros válidos. Um valor estranho —
 * bundle antigo, edição manual, storage de outra versão — vira o padrão em
 * vez de derrubar a tela.
 */
export function normalizarFiltros(bruto: unknown): FiltrosCronograma {
  if (!bruto || typeof bruto !== 'object') return { ...FILTROS_PADRAO }
  const f = bruto as Record<string, unknown>
  const page = typeof f.page === 'number' && Number.isFinite(f.page) ? Math.max(1, Math.floor(f.page)) : 1
  const scrollY = typeof f.scrollY === 'number' && Number.isFinite(f.scrollY) ? Math.max(0, f.scrollY) : 0
  return {
    search: typeof f.search === 'string' ? f.search : '',
    apenasAndamento: typeof f.apenasAndamento === 'boolean' ? f.apenasAndamento : true,
    modalidadeFiltro: texto(f.modalidadeFiltro),
    coordenacaoFiltro: texto(f.coordenacaoFiltro),
    responsavelFiltro: texto(f.responsavelFiltro),
    prioridadeFiltro: texto(f.prioridadeFiltro),
    etapaFiltro: texto(f.etapaFiltro),
    page,
    scrollY,
  }
}

/** Filtros da última visita nesta aba, ou os padrões. Nunca lança. */
export function lerFiltros(): FiltrosCronograma {
  if (typeof window === 'undefined' || !window.sessionStorage) return { ...FILTROS_PADRAO }
  try {
    const bruto = window.sessionStorage.getItem(CHAVE)
    return bruto ? normalizarFiltros(JSON.parse(bruto)) : { ...FILTROS_PADRAO }
  } catch {
    return { ...FILTROS_PADRAO }
  }
}

/** Grava o recorte atual. Nunca lança: storage cheio não pode travar a tela. */
export function gravarFiltros(filtros: FiltrosCronograma): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return
  try {
    window.sessionStorage.setItem(CHAVE, JSON.stringify(filtros))
  } catch {
    // storage cheio ou bloqueado: a tela segue, só não lembra o recorte
  }
}

export function esquecerFiltros(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return
  try {
    window.sessionStorage.removeItem(CHAVE)
  } catch {
    // idem
  }
}

/** Há algum recorte além do padrão? Usado para rotular a tela ao restaurar. */
export function temRecorte(f: FiltrosCronograma): boolean {
  return !!(
    f.search ||
    f.modalidadeFiltro ||
    f.coordenacaoFiltro ||
    f.responsavelFiltro ||
    f.prioridadeFiltro ||
    f.etapaFiltro ||
    !f.apenasAndamento
  )
}

/** Descrição curta do recorte restaurado, para o aviso na tela. */
export function descreverRecorte(f: FiltrosCronograma): string {
  const partes: string[] = []
  if (f.search) partes.push(`busca "${f.search}"`)
  if (f.modalidadeFiltro) partes.push(f.modalidadeFiltro)
  if (f.coordenacaoFiltro) partes.push(f.coordenacaoFiltro)
  if (f.responsavelFiltro) partes.push(f.responsavelFiltro)
  if (f.prioridadeFiltro) partes.push(`prioridade ${f.prioridadeFiltro}`)
  if (f.etapaFiltro) partes.push('etapa selecionada')
  if (!f.apenasAndamento) partes.push('todos os status')
  return partes.join(' · ')
}
