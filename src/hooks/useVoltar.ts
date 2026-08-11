'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { temHistoricoInterno, rotaAnterior, nomeDaRota } from '@/lib/navegacao'

/** Sem subscrição: o histórico não muda enquanto a tela está aberta. */
const semAssinatura = () => () => {}

/**
 * Botão "Voltar" que respeita a origem.
 *
 * Se a pessoa chegou navegando pelo sistema, volta para a tela anterior de
 * fato. Se abriu a URL direto (link colado, favorito, F5), vai para o destino
 * padrão — porque aí `router.back()` a tiraria do sistema.
 *
 * `rotulo` traz o nome da tela anterior quando reconhecido, para o botão
 * poder dizer "Voltar ao Cronograma" em vez de só "Voltar".
 */
export function useVoltar(destinoPadrao: string) {
  const router = useRouter()

  // O rótulo vem do sessionStorage, que só existe no navegador. Ler por
  // useSyncExternalStore evita divergência entre o HTML pré-renderizado e a
  // hidratação — no servidor o valor é nulo, no cliente é o nome da tela.
  const rotulo = useSyncExternalStore(
    semAssinatura,
    () => nomeDaRota(rotaAnterior()) ?? nomeDaRota(destinoPadrao),
    () => null,
  )

  const voltar = useCallback(() => {
    if (temHistoricoInterno()) {
      router.back()
    } else {
      router.push(destinoPadrao)
    }
  }, [router, destinoPadrao])

  return { voltar, rotulo }
}
