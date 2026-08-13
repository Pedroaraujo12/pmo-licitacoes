'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  lerRecorte, gravarRecorte, esquecerRecorte, temRecorte, descreverRecorte,
  type Recorte,
} from '@/lib/recorte-tela'

export interface OpcoesRecorte<T extends Recorte> {
  /** Chave no sessionStorage. Uma por tela, prefixada com `pmo_`. */
  chave: string
  /** Estado de quem abre a tela pela primeira vez. Define os tipos aceitos. */
  padrao: T
  /** Valores atuais dos filtros da tela. */
  valores: T
  /** Aplica o recorte lido aos estados da tela. Chamado uma vez, na montagem. */
  aplicar: (valores: T) => void
  /** Prefixos para o aviso: `{ search: 'busca' }` → "busca ambulância". */
  rotulos?: Record<string, string>
  /** Campos que não contam como recorte (página, ordenação, modo de exibição). */
  ignorar?: string[]
  /**
   * Não restaura. Use quando a tela foi aberta por um link com filtro na URL
   * — o link é uma intenção explícita e precisa vencer o recorte guardado.
   */
  ignorarRestauracao?: boolean
  /** Enquanto verdadeiro, a rolagem não é restaurada: a lista ainda não existe. */
  carregando?: boolean
}

export interface EstadoRecorte {
  /** Falso até a restauração terminar. Segure a primeira consulta com isto. */
  hidratado: boolean
  /** Descrição do recorte restaurado, ou vazio. Renderize como aviso. */
  restaurado: string
  /** Esconde o aviso, mantendo os filtros. */
  dispensar: () => void
  /** Apaga o recorte guardado e esconde o aviso. Chame ao limpar os filtros. */
  esquecer: () => void
  /** Chame ao sair para um item: fixa a posição da lista. */
  aoSair: () => void
}

/**
 * Guarda e devolve o recorte de filtros de uma tela de lista.
 *
 * A restauração acontece num efeito, não no primeiro render: ler
 * `sessionStorage` durante o render diverge do HTML pré-renderizado pelo
 * export estático. Por isso `hidratado` existe — a tela deve segurar a
 * consulta ao banco até ele virar verdadeiro, senão a primeira lista chega
 * sem filtro e pisca antes de encolher.
 */
export function useRecorteDeTela<T extends Recorte>(opcoes: OpcoesRecorte<T>): EstadoRecorte {
  const { chave, padrao, valores, rotulos, ignorar, ignorarRestauracao, carregando } = opcoes

  const [hidratado, setHidratado] = useState(false)
  const [restaurado, setRestaurado] = useState('')
  const scrollPendente = useRef(0)

  // Roda uma vez, na montagem: as closures capturadas aqui são as certas —
  // os setters do React são estáveis, e `padrao`/`rotulos`/`ignorar` são
  // literais fixos da tela. Por isso as dependências ficam de fora.
  const { aplicar } = opcoes
  /* eslint-disable react-hooks/set-state-in-effect -- restaurar o recorte é,
     por definição, aplicar estado guardado depois da montagem. */
  useEffect(() => {
    if (ignorarRestauracao) {
      setHidratado(true)
      return
    }
    const { valores: lidos, scrollY } = lerRecorte(chave, padrao)
    aplicar(lidos)
    scrollPendente.current = scrollY
    if (temRecorte(lidos, padrao, ignorar)) {
      setRestaurado(descreverRecorte(lidos, padrao, rotulos, ignorar))
    }
    setHidratado(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Grava a cada mudança de filtro. A posição de rolagem não entra aqui: ela
  // é fixada em `aoSair`, no clique que leva para fora da tela.
  const serializado = JSON.stringify(valores)
  useEffect(() => {
    if (!hidratado) return
    gravarRecorte(chave, JSON.parse(serializado) as T, scrollPendente.current)
  }, [chave, hidratado, serializado])

  // A posição só pode ser restaurada depois que a lista ocupa a altura dela.
  useEffect(() => {
    if (!hidratado || carregando || scrollPendente.current <= 0) return
    const alvo = scrollPendente.current
    scrollPendente.current = 0
    const id = requestAnimationFrame(() => window.scrollTo({ top: alvo, behavior: 'auto' }))
    return () => cancelAnimationFrame(id)
  }, [hidratado, carregando])

  const aoSair = useCallback(() => {
    if (typeof window === 'undefined') return
    gravarRecorte(chave, valores, window.scrollY)
  }, [chave, valores])

  const dispensar = useCallback(() => setRestaurado(''), [])

  const esquecer = useCallback(() => {
    esquecerRecorte(chave)
    setRestaurado('')
  }, [chave])

  return { hidratado, restaurado, dispensar, esquecer, aoSair }
}
