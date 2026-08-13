/**
 * Recorte de tela: os filtros com que a pessoa está trabalhando uma lista.
 *
 * Toda tela de lista do sistema serve para isolar uma fatia — "os Pregões da
 * minha coordenação parados na etapa X", "os contratos sem fiscal". Abrir um
 * item dessa fatia desmonta a tela, e voltar traz a lista inteira de novo: o
 * recorte precisa ser refeito a cada item consultado.
 *
 * O recorte fica em `sessionStorage`, uma chave por tela. Vale enquanto a aba
 * estiver aberta e não vaza para outra sessão nem para outro usuário da mesma
 * máquina — o que importa aqui, já que responsável e coordenação dizem em que
 * time a pessoa está.
 *
 * Só valores primitivos são guardados. O tipo aceito de cada campo é inferido
 * do padrão da tela: `null` aceita texto ou nada (o caso dos filtros), `false`
 * aceita booleano, `0` aceita número não negativo, `''` aceita texto. Qualquer
 * outra coisa vira o padrão, para que um bundle antigo ou um storage editado
 * à mão não derrube a tela.
 */

export type ValorRecorte = string | number | boolean | null
export type Recorte = Record<string, ValorRecorte>

export interface RecorteGravado<T extends Recorte> {
  valores: T
  scrollY: number
}

function numero(v: unknown, padrao: number): number {
  // Negativo cai no padrão, não em zero: "página -3" e "página 0" são igualmente
  // inválidos, e o padrão é a única resposta que a tela sabe renderizar.
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return padrao
  return Math.floor(v)
}

export function normalizarRecorte<T extends Recorte>(bruto: unknown, padrao: T): T {
  if (!bruto || typeof bruto !== 'object') return { ...padrao }
  const f = bruto as Record<string, unknown>
  const saida = { ...padrao } as Recorte

  for (const chave of Object.keys(padrao)) {
    const ref = padrao[chave]
    const v = f[chave]
    if (ref === null) {
      // Campo de filtro: texto ou ausência. Texto vazio é ausência.
      saida[chave] = typeof v === 'string' && v.length > 0 ? v : null
    } else if (typeof ref === 'boolean') {
      saida[chave] = typeof v === 'boolean' ? v : ref
    } else if (typeof ref === 'number') {
      saida[chave] = numero(v, ref)
    } else {
      saida[chave] = typeof v === 'string' ? v : ref
    }
  }

  return saida as T
}

/** Recorte da última visita a esta tela, nesta aba. Nunca lança. */
export function lerRecorte<T extends Recorte>(chave: string, padrao: T): RecorteGravado<T> {
  const vazio = { valores: { ...padrao }, scrollY: 0 }
  if (typeof window === 'undefined' || !window.sessionStorage) return vazio
  try {
    const bruto = window.sessionStorage.getItem(chave)
    if (!bruto) return vazio
    const lido = JSON.parse(bruto) as Record<string, unknown>
    return {
      valores: normalizarRecorte(lido?.valores, padrao),
      scrollY: numero(lido?.scrollY, 0),
    }
  } catch {
    return vazio
  }
}

/** Grava o recorte. Nunca lança: storage cheio não pode travar a tela. */
export function gravarRecorte<T extends Recorte>(chave: string, valores: T, scrollY = 0): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return
  try {
    window.sessionStorage.setItem(chave, JSON.stringify({ valores, scrollY }))
  } catch {
    // storage cheio ou bloqueado: a tela segue, só não lembra o recorte
  }
}

export function esquecerRecorte(chave: string): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return
  try {
    window.sessionStorage.removeItem(chave)
  } catch {
    // idem
  }
}

/**
 * Campos que mudam o conjunto exibido, ignorando os que só mudam a
 * apresentação (página, ordenação, modo de exibição).
 */
function camposDeFiltro<T extends Recorte>(padrao: T, ignorar: string[]): string[] {
  return Object.keys(padrao).filter(k => !ignorar.includes(k))
}

/** Há algum filtro fora do padrão? Decide se a tela avisa sobre o recorte. */
export function temRecorte<T extends Recorte>(atual: T, padrao: T, ignorar: string[] = []): boolean {
  return camposDeFiltro(padrao, ignorar).some(k => atual[k] !== padrao[k])
}

/**
 * Descrição curta do recorte, para o aviso na tela. `rotulos` prefixa o valor
 * quando ele sozinho não se explica ("busca ambulância", "prioridade Alta");
 * campos booleanos aparecem pelo rótulo.
 */
export function descreverRecorte<T extends Recorte>(
  atual: T,
  padrao: T,
  rotulos: Record<string, string> = {},
  ignorar: string[] = [],
): string {
  const partes: string[] = []

  for (const k of camposDeFiltro(padrao, ignorar)) {
    const v = atual[k]
    if (v === padrao[k]) continue
    const rotulo = rotulos[k]
    if (typeof v === 'boolean') {
      partes.push(rotulo || k)
    } else if (v !== null && v !== '') {
      partes.push(rotulo ? `${rotulo} ${v}` : String(v))
    }
  }

  return partes.join(' · ')
}
