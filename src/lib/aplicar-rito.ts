import type { SupabaseClient } from '@supabase/supabase-js'
import type { CronogramaAtividade } from '@/types/database'
import {
  listEtapasPorModalidade,
  listFeriados,
  projetarCronograma,
  type EtapaModelo,
} from '@/lib/simulador-cronograma'

/**
 * Alinha o cronograma de um processo ao rito da sua modalidade.
 *
 * Processos criados antes dos modelos DIOP receberam um cronograma genérico
 * de 17 etapas, igual para qualquer modalidade. Esta função troca essas etapas
 * pelas do modelo ativo — as mesmas que o Simulador projeta — preservando o
 * que já foi trabalhado.
 *
 * Equivale, para um processo, ao que `recalc_cronograma_modelos()` faz para
 * todos de uma vez no banco. Existe para que a correção não dependa de
 * executar SQL manualmente.
 */

/** Normaliza para comparação: minúsculas, sem acento e sem pontuação. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const IRRELEVANTES = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'as', 'os', 'em', 'para',
  'por', 'com', 'ao', 'aos', 'na', 'no', 'nas', 'nos', 'dias', 'uteis',
])

/**
 * Quantas palavras significativas as duas descrições têm em comum.
 * Espelha a ideia da `crono_match_score` do banco: 2 ou mais indica que é
 * a mesma etapa em ritos diferentes.
 */
export function pontuarSemelhanca(a: string, b: string): number {
  const tokens = (s: string) => new Set(
    normalizar(s).split(' ').filter(t => t.length > 2 && !IRRELEVANTES.has(t)),
  )
  const ta = tokens(a)
  const tb = tokens(b)
  let comuns = 0
  for (const t of ta) if (tb.has(t)) comuns++
  return comuns
}

export interface ResultadoAplicacao {
  etapas: number
  preservadas: number
  removidas: number
}

/** Dados herdados de uma etapa antiga para a nova correspondente. */
interface Heranca {
  status: string
  responsavel_id: string | null
  data_inicio_real: string | null
  data_fim_real: string | null
}

/**
 * Casa cada etapa do modelo com a etapa antiga mais parecida ainda não usada.
 * Só transporta o que representa trabalho real: status, responsável e datas
 * efetivas. Descrição, fase, setor e prazo vêm do modelo.
 */
export function casarEtapas(
  novas: EtapaModelo[],
  antigas: CronogramaAtividade[],
): Map<number, Heranca> {
  const heranca = new Map<number, Heranca>()
  const usadas = new Set<string>()

  for (const nova of novas) {
    let melhor: CronogramaAtividade | null = null
    let melhorScore = 0

    for (const antiga of antigas) {
      if (usadas.has(antiga.id)) continue
      const score = pontuarSemelhanca(nova.descricao, antiga.descricao)
      if (score > melhorScore) {
        melhorScore = score
        melhor = antiga
      }
    }

    if (melhor && melhorScore >= 2) {
      usadas.add(melhor.id)
      heranca.set(nova.ordem, {
        status: melhor.status === 'concluido' || melhor.status === 'em_andamento'
          ? melhor.status
          : 'nao_iniciado',
        responsavel_id: melhor.responsavel_id ?? null,
        data_inicio_real: melhor.data_inicio_real ?? null,
        data_fim_real: melhor.data_fim_real ?? null,
      })
    }
  }

  return heranca
}

/** O cronograma atual corresponde ao rito da modalidade? */
export function ritoDivergente(
  atividades: CronogramaAtividade[],
  etapasModelo: EtapaModelo[],
): boolean {
  if (etapasModelo.length === 0) return false
  if (atividades.length !== etapasModelo.length) return true

  const ordenadas = [...atividades].sort((a, b) => a.ordem - b.ordem)
  const modelo = [...etapasModelo].sort((a, b) => a.ordem - b.ordem)

  return ordenadas.some(
    (a, i) => normalizar(a.descricao) !== normalizar(modelo[i].descricao),
  )
}

export async function aplicarRitoDaModalidade(
  supabase: SupabaseClient,
  params: {
    processoId: string
    modalidadeId: string
    dataEntrada: string
    atividades: CronogramaAtividade[]
    userId?: string | null
  },
): Promise<ResultadoAplicacao> {
  const { processoId, modalidadeId, dataEntrada, atividades, userId } = params

  const [etapas, feriados] = await Promise.all([
    listEtapasPorModalidade(supabase, modalidadeId),
    listFeriados(supabase),
  ])

  if (etapas.length === 0) {
    throw new Error('Esta modalidade não tem modelo de cronograma cadastrado.')
  }

  const projecao = projetarCronograma(etapas, dataEntrada, feriados)
  const heranca = casarEtapas(etapas, atividades)
  const porOrdem = new Map(atividades.map(a => [a.ordem, a]))

  let preservadas = 0

  // Reescreve por ordem: atualiza a linha existente quando há, insere quando
  // falta. Preserva os ids (e os registros de override que apontam para eles)
  // em vez de apagar tudo e recriar.
  for (const etapa of projecao.etapas) {
    const herdado = heranca.get(etapa.ordem)
    if (herdado && herdado.status !== 'nao_iniciado') preservadas++

    const dados = {
      ordem: etapa.ordem,
      descricao: etapa.descricao,
      fase: etapa.fase,
      setor: etapa.setor,
      dias_uteis: etapa.duracao_dias_uteis,
      data_inicio: etapa.data_inicio,
      data_fim: etapa.data_fim,
      status: herdado?.status ?? 'nao_iniciado',
      responsavel_id: herdado?.responsavel_id ?? null,
      data_inicio_real: herdado?.data_inicio_real ?? null,
      data_fim_real: herdado?.data_fim_real ?? null,
    }

    // Duas verificações são necessárias, e a segunda é a que pega o caso
    // difícil. O supabase-js não lança exceção quando o banco recusa uma
    // escrita — devolve { error }. E, com RLS, um UPDATE que não alcança
    // nenhuma linha volta como SUCESSO com zero linhas afetadas: nenhum erro,
    // nenhuma gravação. Pedir as linhas de volta com .select() é o que
    // distingue "gravou" de "fingiu que gravou".
    const existente = porOrdem.get(etapa.ordem)
    const { data: gravado, error } = existente
      ? await supabase.from('cronograma_atividades').update(dados).eq('id', existente.id).select('id')
      : await supabase.from('cronograma_atividades').insert({ ...dados, processo_id: processoId }).select('id')

    if (error) {
      throw new Error(
        `Etapa ${etapa.ordem} (${existente ? 'atualizar' : 'inserir'}): ${error.message}`,
      )
    }

    if (!gravado || gravado.length === 0) {
      throw new Error(
        `Etapa ${etapa.ordem}: o banco aceitou a operação mas não gravou nada. ` +
        `Normalmente é permissão: o seu perfil não tem autorização de escrita ` +
        `em cronograma_atividades.`,
      )
    }
  }

  // Sobras do rito anterior (rito novo mais curto que o antigo)
  const sobras = atividades.filter(a => a.ordem > projecao.etapas.length)
  for (const sobra of sobras) {
    const { data: removido, error } = await supabase
      .from('cronograma_atividades').delete().eq('id', sobra.id).select('id')
    if (error) throw new Error(`Remover etapa ${sobra.ordem}: ${error.message}`)
    if (!removido || removido.length === 0) {
      throw new Error(`Etapa ${sobra.ordem} não pôde ser removida — sem permissão de escrita.`)
    }
  }

  if (projecao.data_conclusao) {
    await supabase.from('processos')
      .update({ data_entrega: projecao.data_conclusao })
      .eq('id', processoId)
  }

  await supabase.from('atividades').insert({
    processo_id: processoId,
    atividade: '__RITO_APLICADO__',
    observacao: JSON.stringify({
      etapas_aplicadas: projecao.etapas.length,
      etapas_removidas: sobras.length,
      etapas_preservadas: preservadas,
      data_base: dataEntrada,
      conclusao_prevista: projecao.data_conclusao,
      por: userId ?? null,
    }),
    data: new Date().toISOString().split('T')[0],
    created_by: userId ?? null,
  })

  return {
    etapas: projecao.etapas.length,
    preservadas,
    removidas: sobras.length,
  }
}
