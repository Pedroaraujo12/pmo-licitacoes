/**
 * Tokens visuais do dashboard.
 *
 * As cores de estado foram validadas para daltonismo sobre a superfície
 * `surface` (#141b2e): pior par adjacente ΔE 8,4 sob protanopia, piso de
 * visão normal ΔE 16,4, todas acima de 3:1 de contraste com o fundo.
 * Nenhuma delas carrega significado sozinha — sempre acompanham um rótulo.
 *
 * A tinta secundária subiu de #64748b (3,8:1 — abaixo do mínimo WCAG AA)
 * para #a8b4cc (8,2:1) e #7d8aa5 (5,0:1).
 */

export const CORES = {
  plane: '#090d18',
  surface: '#141b2e',
  surface2: '#1b2438',
  surface3: '#222c44',
  line: '#29334c',
  lineSoft: '#1f2840',

  ink: '#eef2f9',
  ink2: '#a8b4cc',
  ink3: '#7d8aa5',

  accent: '#4f9cf5',
  accentDim: '#3987e5',
  accentWash: '#1d2c47',

  good: '#2fbf71',
  warning: '#c98500',
  critical: '#e05561',
} as const

/**
 * Cor por status do processo. É codificação de estado, não de identidade:
 * verde = entregue, cinza = nada aconteceu, âmbar = voltou, vermelho = morreu.
 * "Total da carteira" saiu daqui — deixou de ser irmão dos status e por isso
 * não disputa mais o azul de "Em andamento".
 */
export const CORES_STATUS: Record<string, string> = {
  'Em andamento': '#3987e5',
  'Concluído': '#199e70',
  'Homologado': '#199e70',
  'Não recebido': '#7d8aa5',
  'Devolvido': '#c98500',
  'Cancelado': '#d64550',
  'Suspenso': '#8a6ad4',
  'Rascunho': '#5c6a85',
}

export const COR_STATUS_PADRAO = '#7d8aa5'

export function corDoStatus(status: string | null): string {
  return CORES_STATUS[(status || '').trim()] || COR_STATUS_PADRAO
}

/** Tipografia mínima: nada abaixo de 11px, corpo de tabela em 12,5px. */
export const TIPO = {
  rotulo: 11,
  corpo: 12.5,
  destaque: 15,
  numero: 31,
} as const
