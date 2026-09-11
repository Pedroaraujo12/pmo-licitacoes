import type { SupabaseClient } from '@supabase/supabase-js'
import type { PlanoDeReposicionamento, EtapaDoCronograma } from './reposicionar-cronograma'

/**
 * Escrita do reposicionamento calculado em `reposicionar-cronograma`.
 *
 * Separado do cálculo de propósito: o plano é puro e testável, e só isto toca
 * o banco. Reescrever as datas de um processo inteiro é operação cara de
 * desfazer, então grava trilha de auditoria com o antes, o depois e o motivo —
 * a mesma trilha que o reposicionamento manual da tela de Cronograma usa.
 */

export interface ResultadoReposicionamento {
  etapasConcluidas: number
  etapasReprojetadas: number
  novaDataEntrega: string | null
  erro?: string
}

export async function aplicarReposicionamento(
  supabase: SupabaseClient,
  processoId: string,
  plano: PlanoDeReposicionamento,
  contexto: { atividadeDeclarada: string; dataBase: string; usuarioId: string | null },
): Promise<ResultadoReposicionamento> {
  // 1. Etapas anteriores ao alvo passam a cumpridas. Só o status muda: inventar
  //    datas reais que ninguém registrou seria pior que deixá-las em branco.
  for (const c of plano.concluir) {
    const { error } = await supabase
      .from('cronograma_atividades')
      .update({ status: 'concluido' })
      .eq('id', c.id)
    if (error) return { etapasConcluidas: 0, etapasReprojetadas: 0, novaDataEntrega: null, erro: error.message }
  }

  // 2. Datas novas do alvo em diante
  for (const r of plano.reprojetar) {
    const { error } = await supabase
      .from('cronograma_atividades')
      .update({ data_inicio: r.data_inicio, data_fim: r.data_fim })
      .eq('id', r.id)
    if (error) {
      return {
        etapasConcluidas: plano.concluir.length,
        etapasReprojetadas: 0,
        novaDataEntrega: null,
        erro: error.message,
      }
    }
  }

  // 3. A entrega do processo acompanha o fim da última etapa
  if (plano.novaDataEntrega) {
    await supabase.from('processos')
      .update({ data_entrega: plano.novaDataEntrega })
      .eq('id', processoId)
  }

  // 4. Trilha: o que mudou, a partir de quê, e por quem
  await supabase.from('atividades').insert({
    processo_id: processoId,
    atividade: '__REPOSICIONAMENTO__',
    observacao: JSON.stringify({
      origem: 'edicao_do_processo',
      atividade_declarada: contexto.atividadeDeclarada,
      etapa_ordem: plano.ordemAlvo,
      etapa_descricao: plano.descricaoAlvo,
      data_base: contexto.dataBase,
      anteriores_concluidas: plano.concluir.length,
      etapas_reagendadas: plano.reprojetar.length,
      entrega_anterior: plano.dataEntregaAnterior,
      entrega_nova: plano.novaDataEntrega,
      por: contexto.usuarioId,
    }),
    data: new Date().toISOString().split('T')[0],
    created_by: contexto.usuarioId,
  })

  return {
    etapasConcluidas: plano.concluir.length,
    etapasReprojetadas: plano.reprojetar.length,
    novaDataEntrega: plano.novaDataEntrega,
  }
}

/** Etapas do processo, na forma que o planejador espera. */
export async function carregarEtapasDoProcesso(
  supabase: SupabaseClient,
  processoId: string,
): Promise<EtapaDoCronograma[]> {
  const { data } = await supabase
    .from('cronograma_atividades')
    .select('id, ordem, descricao, status, dias_uteis, data_inicio, data_fim')
    .eq('processo_id', processoId)
    .order('ordem', { ascending: true })
  return (data as EtapaDoCronograma[] | null) || []
}
