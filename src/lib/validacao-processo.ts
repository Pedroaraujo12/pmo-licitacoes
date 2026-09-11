import { STATUS_CONCLUIDOS, STATUS_TERMINAIS } from './dashboard-metrics'

/**
 * Validação de processo no momento de salvar.
 *
 * Existe porque a base acumulou lacunas que só aparecem depois, nos números:
 * processos concluídos sem valor homologado derrubam a taxa de homologação;
 * concluídos sem data de conclusão somem da tendência mensal (16 de 26 tinham
 * essa data); processo pendente sem data de entrega não entra em faixa de
 * prazo nenhuma e fica invisível para o alerta de atraso.
 *
 * A regra é barrar na entrada em vez de exibir "não informado" para sempre.
 */

export interface ProcessoParaValidar {
  responsavel_id?: string | null
  status_nome?: string | null
  valor_estimado?: number | null
  valor_homologado?: number | null
  /** Data da atividade atual — usada como data de conclusão. */
  data_atividade?: string | null
  data_entrega?: string | null
}

export interface Problema {
  /** Nome do campo no formulário — usado para levar o foco até ele. */
  campo: string
  /** Rótulo como aparece na tela. A mensagem precisa citar o que a pessoa vê. */
  rotulo: string
  mensagem: string
}

function vazio(v: string | null | undefined): boolean {
  return v === null || v === undefined || v.trim() === ''
}

/**
 * Devolve os problemas que impedem o salvamento, na ordem em que os campos
 * aparecem no formulário. Lista vazia significa que pode salvar.
 */
export function validarProcesso(p: ProcessoParaValidar): Problema[] {
  const problemas: Problema[] = []
  const status = (p.status_nome || '').trim()
  const concluido = STATUS_CONCLUIDOS.includes(status as (typeof STATUS_CONCLUIDOS)[number])
  const terminal = STATUS_TERMINAIS.includes(status as (typeof STATUS_TERMINAIS)[number])

  if (vazio(p.responsavel_id)) {
    problemas.push({
      campo: 'responsavel_id', rotulo: 'Responsável',
      mensagem: 'Preencha "Responsável".',
    })
  }

  if (!terminal && vazio(p.data_entrega)) {
    problemas.push({
      campo: 'data_entrega', rotulo: 'Data Entrega',
      mensagem: 'Preencha "Data Entrega" — sem ela o processo não entra em nenhuma faixa de prazo e não aparece nos alertas de atraso.',
    })
  }

  if (concluido) {
    if (!p.valor_homologado || p.valor_homologado <= 0) {
      problemas.push({
        campo: 'valor_homologado', rotulo: 'Valor Homologado (R$)',
        mensagem: 'Preencha "Valor Homologado (R$)" — é ele que alimenta a taxa de homologação e a economia.',
      })
    }
    if (vazio(p.data_atividade)) {
      problemas.push({
        /* Antes esta mensagem pedia "data da conclusão", nome que não existe
           na tela: o campo se chama "Data Atividade". Mensagem que nomeia
           campo inventado manda a pessoa procurar o que não está lá. */
        campo: 'data_atividade', rotulo: 'Data Atividade',
        mensagem: 'Preencha "Data Atividade" com a data da conclusão — sem ela o processo não aparece na tendência mensal.',
      })
    }
  }

  return problemas
}

/**
 * Avisos que não impedem salvar, mas merecem ser ditos. Homologado acima do
 * estimado acontece de verdade (aditivo, reequilíbrio) — então é aviso, não
 * bloqueio; o que não pode é passar despercebido, porque vira economia negativa.
 */
export function avisosProcesso(p: ProcessoParaValidar): string[] {
  const avisos: string[] = []
  const est = p.valor_estimado || 0
  const hom = p.valor_homologado || 0
  if (est > 0 && hom > est) {
    avisos.push('O valor homologado está acima do estimado — a economia deste processo ficará negativa.')
  }
  return avisos
}
