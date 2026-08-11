'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { temHistoricoInterno } from '@/lib/navegacao'

/**
 * Botão "Voltar" que respeita a origem.
 *
 * Se a pessoa chegou navegando pelo sistema, volta para a tela anterior de
 * fato. Se abriu a URL direto (link colado, favorito, F5), vai para o destino
 * padrão — porque aí `router.back()` a tiraria do sistema.
 *
 * A decisão é tomada no clique, não na renderização. Uma versão anterior
 * expunha o nome da tela de origem para rotular o botão, lendo sessionStorage
 * durante o render; como o layout grava nesse mesmo storage a cada navegação,
 * o valor mudava entre renders e derrubava a página. O rótulo não valia o
 * risco: o que importa é o botão levar ao lugar certo.
 */
export function useVoltar(destinoPadrao: string) {
  const router = useRouter()

  const voltar = useCallback(() => {
    if (temHistoricoInterno()) {
      router.back()
    } else {
      router.push(destinoPadrao)
    }
  }, [router, destinoPadrao])

  return { voltar }
}
