/**
 * Histórico de navegação interna, para o botão "Voltar" levar de volta ao
 * lugar de onde a pessoa veio.
 *
 * As telas de detalhe têm várias origens — o detalhe de um processo é
 * alcançado pelo Cronograma, pela lista de Processos, pelo Dashboard, pela
 * ficha de um colaborador e pelo detalhe de um contrato. Um destino fixo
 * acerta uma origem e erra todas as outras.
 *
 * `document.referrer` não serve: em navegação client-side ele não muda. Por
 * isso registramos as rotas visitadas nesta aba.
 */

const CHAVE = 'pmo_nav_stack'
const LIMITE = 10

function disponivel(): boolean {
  return typeof window !== 'undefined' && !!window.sessionStorage
}

function lerPilha(): string[] {
  if (!disponivel()) return []
  try {
    const bruto = window.sessionStorage.getItem(CHAVE)
    const pilha = bruto ? JSON.parse(bruto) : []
    return Array.isArray(pilha) ? pilha : []
  } catch {
    return []
  }
}

/** Chamado a cada mudança de rota dentro do dashboard. */
export function registrarNavegacao(pathname: string): void {
  if (!disponivel() || !pathname) return
  const pilha = lerPilha()
  if (pilha[pilha.length - 1] === pathname) return // recarregou a mesma tela
  try {
    window.sessionStorage.setItem(CHAVE, JSON.stringify([...pilha, pathname].slice(-LIMITE)))
  } catch {
    // sessionStorage cheio ou bloqueado: navegação segue pelo destino padrão
  }
}

/** Houve navegação interna nesta aba antes da tela atual? */
export function temHistoricoInterno(): boolean {
  return lerPilha().length > 1
}

/** Rota anterior, quando existir (útil para rótulos como "Voltar ao Cronograma"). */
export function rotaAnterior(): string | null {
  const pilha = lerPilha()
  return pilha.length > 1 ? pilha[pilha.length - 2] : null
}

/** Nome legível de uma rota do dashboard, para rotular o botão de voltar. */
export function nomeDaRota(pathname: string | null): string | null {
  if (!pathname) return null

  const mapa: Record<string, string> = {
    '/pmo-dashboard': 'Dashboard',
    '/pmo-dashboard/processos': 'Processos',
    '/pmo-dashboard/contratos': 'Contratos',
    '/pmo-dashboard/contratos/lista': 'Contratos',
    '/pmo-dashboard/contratos/vencimentos': 'Vencimentos',
    '/pmo-dashboard/fornecedores': 'Fornecedores',
    '/pmo-dashboard/cronograma': 'Cronograma',
    '/pmo-dashboard/simulador': 'Simulador',
    '/pmo-dashboard/documentos': 'Documentos',
    '/pmo-dashboard/colaboradores': 'Colaboradores',
    '/pmo-dashboard/colaboradores/aniversariantes': 'Aniversariantes',
    '/pmo-dashboard/notas': 'Notas',
    '/pmo-dashboard/notas/hoje': 'Painel do Dia',
    '/pmo-dashboard/ordens-servico': 'Ordens de Serviço',
    '/pmo-dashboard/usuarios': 'Usuários',
  }

  if (mapa[pathname]) return mapa[pathname]
  if (pathname.startsWith('/pmo-dashboard/processos')) return 'Processos'
  if (pathname.startsWith('/pmo-dashboard/contratos')) return 'Contratos'
  if (pathname.startsWith('/pmo-dashboard/colaboradores')) return 'Colaboradores'
  if (pathname.startsWith('/pmo-dashboard/ordens-servico')) return 'Ordens de Serviço'
  if (pathname.startsWith('/pmo-dashboard/documentos')) return 'Documentos'
  return null
}
