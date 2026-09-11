import { normalizar, pontuarSemelhanca } from './aplicar-rito'
import { somarDiasUteis } from './simulador-cronograma'

/**
 * Reposicionamento do cronograma a partir da atividade atual declarada.
 *
 * Quando alguém muda "Atividade Atual" na edição do processo, o cronograma
 * fica desatualizado: continua apontando uma etapa anterior e projetando datas
 * a partir dela. Estas funções calculam o reencadeamento — as etapas até a
 * escolhida passam a cumpridas e as seguintes são reprojetadas em dias úteis
 * a partir de uma data base.
 *
 * Tudo aqui é puro: nada escreve no banco. O plano é calculado, mostrado a
 * quem está editando, e só então aplicado — reescrever as datas de um processo
 * inteiro em silêncio seria pior que deixar desatualizado.
 */

export interface EtapaDoCronograma {
  id: string
  ordem: number
  descricao: string
  status: string
  dias_uteis: number | null
  data_inicio: string | null
  data_fim: string | null
}

export interface EtapaReprojetada {
  id: string
  ordem: number
  descricao: string
  data_inicio: string
  data_fim: string
  /** Datas que a etapa tinha antes, para a tela mostrar o antes e depois. */
  data_inicio_anterior: string | null
  data_fim_anterior: string | null
}

export interface PlanoDeReposicionamento {
  /** Ordem da etapa que passa a ser a atual. */
  ordemAlvo: number
  descricaoAlvo: string
  /** Etapas antes do alvo que serão marcadas como concluídas. */
  concluir: { id: string; ordem: number; descricao: string }[]
  /** Etapas do alvo em diante, com as datas novas. */
  reprojetar: EtapaReprojetada[]
  /** Nova data de entrega do processo — fim da última etapa. */
  novaDataEntrega: string | null
  dataEntregaAnterior: string | null
}

function paraISO(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

function deISO(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d)
}

/**
 * Encontra a etapa do cronograma que corresponde ao texto da atividade atual.
 *
 * Casamento exato primeiro. Sem ele, cai na semelhança por palavras
 * significativas — a mesma medida que `aplicar-rito` usa para reconhecer a
 * mesma etapa escrita de formas diferentes em ritos distintos. Abaixo de dois
 * termos em comum devolve null: chutar a etapa erraria as datas do processo
 * inteiro, e errar em silêncio é pior que não fazer nada.
 */
export function encontrarEtapaPorAtividade(
  etapas: EtapaDoCronograma[],
  atividade: string | null,
): EtapaDoCronograma | null {
  const alvo = (atividade || '').trim()
  if (!alvo) return null

  const exata = etapas.find(e => (e.descricao || '').trim() === alvo)
  if (exata) return exata

  const normalizado = normalizar(alvo)
  const porNormalizacao = etapas.find(e => normalizar(e.descricao || '') === normalizado)
  if (porNormalizacao) return porNormalizacao

  let melhor: EtapaDoCronograma | null = null
  let melhorScore = 0
  for (const e of etapas) {
    const score = pontuarSemelhanca(alvo, e.descricao || '')
    if (score > melhorScore) {
      melhorScore = score
      melhor = e
    }
  }
  return melhorScore >= 2 ? melhor : null
}

/**
 * Calcula o reencadeamento a partir da etapa alvo.
 *
 * Etapas já concluídas depois do alvo mantêm as datas e apenas empurram a
 * âncora: quem registrou a conclusão sabe mais sobre ela que qualquer
 * projeção. Etapa sem duração cadastrada ocupa um único dia útil.
 */
export function planejarReposicionamento(
  etapas: EtapaDoCronograma[],
  ordemAlvo: number,
  dataBase: string,
  feriados: Set<string>,
  dataEntregaAtual: string | null = null,
): PlanoDeReposicionamento | null {
  const ordenadas = [...etapas].sort((a, b) => a.ordem - b.ordem)
  const alvo = ordenadas.find(e => e.ordem === ordemAlvo)
  if (!alvo) return null

  const concluir = ordenadas
    .filter(e => e.ordem < ordemAlvo && e.status !== 'concluido')
    .map(e => ({ id: e.id, ordem: e.ordem, descricao: e.descricao }))

  const reprojetar: EtapaReprojetada[] = []
  let cursor = deISO(dataBase)

  for (const e of ordenadas.filter(x => x.ordem >= ordemAlvo)) {
    if (e.status === 'concluido' && e.data_fim) {
      // respeita o que já foi registrado e segue a partir do dia seguinte
      cursor = deISO(e.data_fim)
      cursor.setDate(cursor.getDate() + 1)
      continue
    }

    const dias = Math.max(1, e.dias_uteis || 1)
    const inicio = somarDiasUteis(cursor, 1, feriados)
    const fim = somarDiasUteis(inicio, dias, feriados)

    reprojetar.push({
      id: e.id,
      ordem: e.ordem,
      descricao: e.descricao,
      data_inicio: paraISO(inicio),
      data_fim: paraISO(fim),
      data_inicio_anterior: e.data_inicio,
      data_fim_anterior: e.data_fim,
    })

    cursor = new Date(fim)
    cursor.setDate(cursor.getDate() + 1)
  }

  return {
    ordemAlvo,
    descricaoAlvo: alvo.descricao,
    concluir,
    reprojetar,
    novaDataEntrega: reprojetar.length > 0 ? reprojetar[reprojetar.length - 1].data_fim : null,
    dataEntregaAnterior: dataEntregaAtual,
  }
}

/** Quantos dias a entrega do processo se move com o plano. Negativo antecipa. */
export function deslocamentoDaEntrega(plano: PlanoDeReposicionamento): number | null {
  if (!plano.novaDataEntrega || !plano.dataEntregaAnterior) return null
  const nova = deISO(plano.novaDataEntrega).getTime()
  const antiga = deISO(plano.dataEntregaAnterior).getTime()
  return Math.round((nova - antiga) / 86_400_000)
}
