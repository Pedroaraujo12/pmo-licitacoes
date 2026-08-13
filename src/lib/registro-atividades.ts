/**
 * A tabela `atividades` guarda duas coisas diferentes.
 *
 * A primeira é o registro que a pessoa escreve no formulário "Registrar
 * Atividade" — o diário do processo, com título e observação em texto.
 *
 * A segunda é a trilha de auditoria que o sistema grava sozinho quando o
 * cronograma muda: reposicionamento de etapa, reinício de prazos, alteração
 * de duração, aplicação do rito, link do SEI. Esses registros usam o título
 * como marcador, no formato `__NOME__`, e a observação como JSON.
 *
 * As duas convivem na mesma tabela, mas não no mesmo lugar da tela: o
 * histórico do processo é o diário, não o log.
 */

export interface RegistroAtividade {
  id?: string
  atividade: string
  observacao?: string | null
  data?: string | null
  responsavel?: string | null
  created_at?: string | null
}

export const MARCADOR_SEI_LINK = '__SEI_LINK__'

/** Só para documentação e testes: a detecção é pelo formato, não por lista. */
export const MARCADORES_CONHECIDOS = [
  '__REPOSICIONAMENTO__',
  '__REINICIO_PRAZOS__',
  '__OVERRIDE__',
  '__RITO_APLICADO__',
  MARCADOR_SEI_LINK,
] as const

/**
 * Formato dos marcadores: `__NOME_EM_CAIXA_ALTA__`, sem espaços. Estreito de
 * propósito — o erro caro aqui é sumir com um registro que alguém digitou,
 * não deixar um marcador estranho aparecer no diário.
 */
const MARCADOR = /^__[A-Z0-9]+(_[A-Z0-9]+)*__$/

/**
 * Registro gravado pelo sistema, não digitado por alguém.
 *
 * A checagem é pelo formato e não por uma lista fechada: assim um marcador
 * novo já nasce fora do diário, sem depender de alguém lembrar de atualizar
 * este arquivo.
 */
export function ehRegistroDeSistema(atividade: string | null | undefined): boolean {
  if (!atividade) return false
  return MARCADOR.test(atividade.trim())
}

/** Separa o diário da trilha, preservando a ordem original de cada um. */
export function separarRegistros<T extends { atividade: string }>(
  lista: T[],
): { manuais: T[]; sistema: T[] } {
  const manuais: T[] = []
  const sistema: T[] = []
  for (const a of lista ?? []) {
    if (ehRegistroDeSistema(a.atividade)) sistema.push(a)
    else manuais.push(a)
  }
  return { manuais, sistema }
}

function objeto(observacao: string | null | undefined): Record<string, unknown> | null {
  if (!observacao) return null
  try {
    const v = JSON.parse(observacao)
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function plural(n: unknown, um: string, muitos: string): string | null {
  if (typeof n !== 'number' || n <= 0) return null
  return `${n} ${n === 1 ? um : muitos}`
}

export interface RegistroLegivel {
  titulo: string
  detalhe: string
  justificativa: string | null
}

/**
 * Traduz um registro de auditoria para linguagem de tela. Sem isto a trilha
 * aparece como JSON cru, que ninguém lê.
 */
export function descreverRegistroDeSistema(a: RegistroAtividade): RegistroLegivel {
  const marcador = a.atividade?.trim()
  const d = objeto(a.observacao)
  const partes: string[] = []

  switch (marcador) {
    case '__REPOSICIONAMENTO__': {
      const etapa = texto(d?.etapa_descricao)
      const ordem = typeof d?.etapa_ordem === 'number' ? d.etapa_ordem : null
      if (etapa) partes.push(`Etapa ${ordem ? `${ordem} — ` : ''}${etapa}`)
      if (texto(d?.data_base)) partes.push(`recontagem a partir de ${d!.data_base}`)
      const reag = plural(d?.etapas_reagendadas, 'etapa reagendada', 'etapas reagendadas')
      if (reag) partes.push(reag)
      const reab = plural(d?.etapas_reabertas, 'etapa reaberta', 'etapas reabertas')
      if (reab) partes.push(reab)
      const conc = plural(d?.anteriores_concluidas, 'anterior concluída', 'anteriores concluídas')
      if (conc) partes.push(conc)
      return {
        titulo: 'Etapa atual redefinida',
        detalhe: partes.join(' · '),
        justificativa: texto(d?.justificativa),
      }
    }

    case '__REINICIO_PRAZOS__': {
      const n = plural(d?.atividades_reiniciadas, 'etapa reiniciada', 'etapas reiniciadas')
      if (n) partes.push(n)
      if (texto(d?.nova_data_base)) partes.push(`nova data base ${d!.nova_data_base}`)
      return {
        titulo: 'Prazos reiniciados',
        detalhe: partes.join(' · '),
        justificativa: texto(d?.justificativa),
      }
    }

    case '__OVERRIDE__': {
      const alvo = texto(d?.atividade)
      if (alvo) partes.push(alvo)
      if (typeof d?.anterior === 'number' && typeof d?.novo === 'number') {
        partes.push(`${d.anterior} → ${d.novo} dias úteis`)
      }
      return {
        titulo: 'Duração de etapa alterada',
        detalhe: partes.join(' · '),
        justificativa: texto(d?.justificativa),
      }
    }

    case '__RITO_APLICADO__': {
      const ap = plural(d?.etapas_aplicadas, 'etapa aplicada', 'etapas aplicadas')
      if (ap) partes.push(ap)
      const rem = plural(d?.etapas_removidas, 'removida', 'removidas')
      if (rem) partes.push(rem)
      const pre = plural(d?.etapas_preservadas, 'preservada', 'preservadas')
      if (pre) partes.push(pre)
      if (texto(d?.conclusao_prevista)) partes.push(`conclusão prevista ${d!.conclusao_prevista}`)
      return {
        titulo: 'Cronograma regerado pelo rito da modalidade',
        detalhe: partes.join(' · '),
        justificativa: null,
      }
    }

    case MARCADOR_SEI_LINK:
      return {
        titulo: 'Link do SEI atualizado',
        detalhe: texto(a.observacao) || '',
        justificativa: null,
      }

    default:
      return {
        titulo: marcador?.replace(/^__|__$/g, '').replace(/_/g, ' ') || 'Alteração do sistema',
        detalhe: texto(a.observacao) || '',
        justificativa: null,
      }
  }
}
