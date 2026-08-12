import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Sincroniza a redação das etapas de um rito com o texto oficial da planilha.
 *
 * As etapas, a ordem e as durações do Pregão já estavam corretas no banco; o
 * que divergia era a forma de escrever oito delas — prazo por extenso contra
 * abreviado, "Análise do TR" contra "Análise TR", diferenças de caixa. Basta
 * para a conferência etapa a etapa acusar erro onde não há.
 *
 * Só a descrição é tocada. Ordem, fase, setor e duração ficam como estão.
 */

export interface TextoEtapa {
  ordem: number
  descricao: string
}

/** Redação oficial do Pregão Eletrônico — 20 etapas, 69 dias úteis. */
export const TEXTOS_PREGAO: TextoEtapa[] = [
  { ordem: 1, descricao: 'Análise TR/UAC' },
  { ordem: 2, descricao: 'Pesquisa de Preços' },
  { ordem: 3, descricao: 'Relatório/Pesquisa de Preços' },
  { ordem: 4, descricao: 'Designação de Comissão' },
  { ordem: 5, descricao: 'Elaboração de Minuta/Edital/Anexos' },
  { ordem: 6, descricao: 'Análise Jurídica' },
  { ordem: 7, descricao: 'Adequação ao Parecer Jurídico' },
  { ordem: 8, descricao: 'Publicação do Edital (8D - Aquisição/10D - Serviço)' },
  { ordem: 9, descricao: 'Abertura Fase de Lances' },
  { ordem: 10, descricao: 'Fase de Julgamento das Propostas' },
  { ordem: 11, descricao: 'Envio da Proposta e doc. de qualificação Técnica para análise' },
  { ordem: 12, descricao: 'Retorno Área Técnica' },
  { ordem: 13, descricao: 'Fase de Julgamento da Habilitação' },
  { ordem: 14, descricao: 'Prazo Recursal (3D)' },
  { ordem: 15, descricao: 'Prazo Contrarrazões (3D)' },
  { ordem: 16, descricao: 'Decisão quanto ao recurso (5D)' },
  { ordem: 17, descricao: 'Envio do Recurso (2d)' },
  { ordem: 18, descricao: 'Adjudicação (1D - s/recurso)' },
  { ordem: 19, descricao: 'Homologação' },
  { ordem: 20, descricao: 'Assinatura do Contrato' },
]

export interface ResultadoSincronizacao {
  ajustadas: number
  jaCorretas: number
}

export async function sincronizarTextosDoRito(
  supabase: SupabaseClient,
  modalidadeParcial: string,
  textos: TextoEtapa[],
): Promise<ResultadoSincronizacao> {
  const { data: modalidades, error: erroModalidade } = await supabase
    .from('modalidades')
    .select('id, nome')
    .ilike('nome', `%${modalidadeParcial}%`)
    .limit(1)

  if (erroModalidade) throw new Error(`Buscar modalidade: ${erroModalidade.message}`)
  const modalidade = modalidades?.[0] as { id: string } | undefined
  if (!modalidade) throw new Error(`Modalidade "${modalidadeParcial}" não encontrada.`)

  const { data: modelos, error: erroModelo } = await supabase
    .from('modelo_cronograma')
    .select('id')
    .eq('modalidade_id', modalidade.id)
    .eq('ativo', true)
    .order('created_at', { ascending: false })
    .limit(1)

  if (erroModelo) throw new Error(`Buscar modelo: ${erroModelo.message}`)
  const modelo = modelos?.[0] as { id: string } | undefined
  if (!modelo) throw new Error('Modelo ativo não encontrado para esta modalidade.')

  const { data: atuais, error: erroEtapas } = await supabase
    .from('modelo_etapa')
    .select('id, ordem, descricao')
    .eq('modelo_cronograma_id', modelo.id)
    .order('ordem', { ascending: true })
    .limit(500)

  if (erroEtapas) throw new Error(`Ler etapas: ${erroEtapas.message}`)

  const porOrdem = new Map(
    (atuais ?? []).map(e => [
      (e as { ordem: number }).ordem,
      e as { id: string; ordem: number; descricao: string },
    ]),
  )

  let ajustadas = 0
  let jaCorretas = 0

  for (const texto of textos) {
    const etapa = porOrdem.get(texto.ordem)
    if (!etapa) continue
    if (etapa.descricao === texto.descricao) { jaCorretas++; continue }

    // .select() é obrigatório: sem permissão, o banco aceita e não grava,
    // devolvendo sucesso com zero linhas.
    const { data: gravado, error } = await supabase
      .from('modelo_etapa')
      .update({ descricao: texto.descricao })
      .eq('id', etapa.id)
      .select('id')

    if (error) throw new Error(`Etapa ${texto.ordem}: ${error.message}`)
    if (!gravado || gravado.length === 0) {
      throw new Error(
        `Etapa ${texto.ordem}: o banco aceitou e não gravou. ` +
        `Editar modelos exige papel admin ou gestor.`,
      )
    }
    ajustadas++
  }

  return { ajustadas, jaCorretas }
}
