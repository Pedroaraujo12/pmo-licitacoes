/**
 * Leitura paginada do PostgREST.
 *
 * O servidor devolve no máximo 1.000 linhas por resposta e **corta em
 * silêncio**: não há erro, não há indicação na resposta, e `.limit(20000)` não
 * vence esse teto — ele só reduz, nunca amplia. O resultado é o pior tipo de
 * defeito, o que não parece defeito: a tela mostra menos dado do que existe e
 * ninguém percebe.
 *
 * Já mordeu duas vezes nesta base — no diagnóstico de aderência do dashboard e
 * na lista de Cronograma, ambas lendo `cronograma_atividades`, que hoje tem
 * 1.380 linhas.
 *
 * Quem usa precisa ordenar a consulta. Sem `order`, o PostgREST não garante
 * ordem estável entre páginas e o `range` pode repetir ou pular linhas.
 */

export interface ResultadoPaginado<T> {
  linhas: T[]
  /** Verdadeiro quando o teto foi atingido e pode haver mais no banco. */
  truncado: boolean
}

export interface OpcoesPaginacao {
  /** Linhas por requisição. O PostgREST não entrega mais que 1.000. */
  tamanhoPagina?: number
  /** Limite de segurança para não varrer uma tabela sem fim. */
  teto?: number
}

type Pagina<T> = { data: T[] | null; error?: unknown }

/**
 * Chama `consulta(de, ate)` repetidamente até a página vir incompleta.
 *
 * Interrompe em erro devolvendo o que já tinha — meia tela com aviso é melhor
 * que tela vazia, e o chamador sabe pelo `truncado` que não está completo.
 */
export async function buscarTodasAsPaginas<T>(
  consulta: (de: number, ate: number) => PromiseLike<Pagina<T>>,
  opcoes: OpcoesPaginacao = {},
): Promise<ResultadoPaginado<T>> {
  const tamanhoPagina = Math.max(1, Math.min(opcoes.tamanhoPagina ?? 1000, 1000))
  const teto = opcoes.teto ?? 20000

  const linhas: T[] = []
  for (let inicio = 0; inicio < teto; inicio += tamanhoPagina) {
    const { data, error } = await consulta(inicio, inicio + tamanhoPagina - 1)
    if (error) return { linhas, truncado: true }

    const pagina = data ?? []
    linhas.push(...pagina)

    // página incompleta significa que acabou
    if (pagina.length < tamanhoPagina) return { linhas, truncado: false }
  }

  return { linhas, truncado: true }
}
