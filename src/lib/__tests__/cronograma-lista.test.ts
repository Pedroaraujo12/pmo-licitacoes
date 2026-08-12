import { describe, it, expect } from 'vitest'
import { agregarLinhas } from '../cronograma-lista'

const HOJE = '2026-08-11'

const processo = {
  id: 'p1',
  id_processo: 'AGSUS.000001/2026-11',
  objeto_resumido: 'Aquisição de materiais',
  data_entrada: '2026-06-01',
  data_entrega: '2026-10-01',
  modalidades: { nome: 'Pregão Eletrônico' },
  status_processo: { nome: 'Em andamento' },
}

function etapa(over: Partial<{ processo_id: string; status: string; data_fim: string | null; fase: string | null; descricao: string | null; ordem: number }>) {
  return {
    processo_id: 'p1', status: 'nao_iniciado', data_fim: null, fase: 'Execução',
    descricao: 'Etapa', ordem: 1,
    ...over,
  }
}

describe('agregarLinhas', () => {
  it('calcula progresso a partir das concluídas', () => {
    const [linha] = agregarLinhas([processo], [
      etapa({ ordem: 1, status: 'concluido' }),
      etapa({ ordem: 2, status: 'concluido' }),
      etapa({ ordem: 3, status: 'nao_iniciado' }),
      etapa({ ordem: 4, status: 'nao_iniciado' }),
    ], HOJE)

    expect(linha.total_atividades).toBe(4)
    expect(linha.concluidas).toBe(2)
    expect(linha.progresso).toBe(50)
  })

  it('conta como atrasada a etapa vencida e não concluída', () => {
    const [linha] = agregarLinhas([processo], [
      etapa({ ordem: 1, status: 'nao_iniciado', data_fim: '2026-08-01' }), // venceu
      etapa({ ordem: 2, status: 'concluido', data_fim: '2026-08-01' }),    // concluída não conta
      etapa({ ordem: 3, status: 'nao_iniciado', data_fim: '2026-12-01' }), // futura
    ], HOJE)

    expect(linha.atrasadas).toBe(1)
    expect(linha.processo_atrasado).toBe(true)
  })

  it('processo sem etapas não quebra e fica com progresso zero', () => {
    const [linha] = agregarLinhas([processo], [], HOJE)
    expect(linha.total_atividades).toBe(0)
    expect(linha.progresso).toBe(0)
    expect(linha.atrasadas).toBe(0)
  })

  it('última fase vem da etapa pendente de maior ordem', () => {
    const [linha] = agregarLinhas([processo], [
      etapa({ ordem: 1, status: 'concluido', fase: 'Planejamento' }),
      etapa({ ordem: 2, status: 'nao_iniciado', fase: 'Análise' }),
      etapa({ ordem: 3, status: 'nao_iniciado', fase: 'Aprovação' }),
    ], HOJE)

    expect(linha.ultima_fase).toBe('Aprovação')
  })

  it('data de entrega vencida com etapas pendentes marca atraso', () => {
    const vencido = { ...processo, data_entrega: '2026-08-01' }
    const [linha] = agregarLinhas([vencido], [
      etapa({ ordem: 1, status: 'nao_iniciado', data_fim: '2026-12-01' }),
    ], HOJE)

    expect(linha.atrasadas).toBe(0)
    expect(linha.processo_atrasado).toBe(true)
  })

  it('processo concluído no prazo não é atrasado', () => {
    const [linha] = agregarLinhas([processo], [
      etapa({ ordem: 1, status: 'concluido', data_fim: '2026-07-01' }),
    ], HOJE)

    expect(linha.processo_atrasado).toBe(false)
    expect(linha.progresso).toBe(100)
  })

  it('lê nome de relação vinda como objeto ou como lista', () => {
    const comLista = { ...processo, modalidades: [{ nome: 'Cotação de Preços' }] }
    const [linha] = agregarLinhas([comLista], [], HOJE)
    expect(linha.modalidade_nome).toBe('Cotação de Preços')

    const [outra] = agregarLinhas([processo], [], HOJE)
    expect(outra.modalidade_nome).toBe('Pregão Eletrônico')
    expect(outra.status_nome).toBe('Em andamento')
  })

  it('não mistura etapas de processos diferentes', () => {
    const p2 = { ...processo, id: 'p2', id_processo: 'AGSUS.000002/2026-22' }
    const linhas = agregarLinhas([processo, p2], [
      etapa({ processo_id: 'p1', ordem: 1, status: 'concluido' }),
      etapa({ processo_id: 'p2', ordem: 1, status: 'nao_iniciado' }),
      etapa({ processo_id: 'p2', ordem: 2, status: 'nao_iniciado' }),
    ], HOJE)

    expect(linhas[0].total_atividades).toBe(1)
    expect(linhas[0].progresso).toBe(100)
    expect(linhas[1].total_atividades).toBe(2)
    expect(linhas[1].progresso).toBe(0)
  })
})

describe('responsável e valor estimado', () => {
  it('lê o responsável da relação e converte o valor', () => {
    const comDados = {
      ...processo,
      responsaveis: { nome: 'Maria Souza' },
      valor_estimado: '125000.50',
    }
    const [linha] = agregarLinhas([comDados], [], HOJE)

    expect(linha.responsavel_nome).toBe('Maria Souza')
    expect(linha.valor_estimado).toBe(125000.5)
  })

  it('processo sem responsável ou sem valor não quebra', () => {
    const semDados = { ...processo, responsaveis: null, valor_estimado: null }
    const [linha] = agregarLinhas([semDados], [], HOJE)

    expect(linha.responsavel_nome).toBeNull()
    expect(linha.valor_estimado).toBeNull()
  })

  it('valor zero é preservado, não confundido com ausente', () => {
    const zerado = { ...processo, valor_estimado: 0 }
    const [linha] = agregarLinhas([zerado], [], HOJE)
    expect(linha.valor_estimado).toBe(0)
  })
})
