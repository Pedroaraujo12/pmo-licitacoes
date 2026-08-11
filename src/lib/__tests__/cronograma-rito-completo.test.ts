import { describe, it, expect } from 'vitest'
import {
  agregarLinhas, distribuicaoComModelo, modalidadesPresentes, SEM_CRONOGRAMA,
} from '../cronograma-lista'

const HOJE = '2026-08-11'

function proc(id: string, modalidade = 'Cotação de Preços') {
  return {
    id,
    id_processo: `AGSUS.00000${id}/2026-11`,
    objeto_resumido: 'Objeto',
    data_entrada: '2026-06-01',
    data_entrega: '2026-12-01',
    modalidades: { nome: modalidade },
    status_processo: { nome: 'Em andamento' },
  }
}

function etapa(processo_id: string, ordem: number, descricao: string, status = 'nao_iniciado') {
  return { processo_id, ordem, descricao, status, data_fim: null, fase: 'Execução' }
}

// Recorte do rito de Cotação
const RITO = [
  { ordem: 1, descricao: 'Analisar a Solicitação de Compras e anexos' },
  { ordem: 2, descricao: 'Elaboração da requisição de propostas' },
  { ordem: 3, descricao: 'Publicação no site (UCOM)' },
  { ordem: 4, descricao: 'Emissão de Parecer jurídico (UJUR)' },
]

describe('distribuicaoComModelo', () => {
  it('mostra todas as etapas do rito, inclusive as sem processo', () => {
    const linhas = agregarLinhas([proc('1')], [
      etapa('1', 1, 'Analisar a Solicitação de Compras e anexos', 'concluido'),
      etapa('1', 2, 'Elaboração da requisição de propostas'),
    ], HOJE)

    const dist = distribuicaoComModelo(linhas, RITO)

    expect(dist).toHaveLength(4)
    expect(dist.map(d => d.total)).toEqual([0, 1, 0, 0])
    expect(dist.every(d => d.noModelo)).toBe(true)
  })

  it('preserva a ordem do rito', () => {
    const dist = distribuicaoComModelo([], RITO)
    expect(dist.map(d => d.ordem)).toEqual([1, 2, 3, 4])
  })

  it('etapa fora do rito aparece marcada, ao final', () => {
    const linhas = agregarLinhas([proc('1')], [
      etapa('1', 1, 'Abertura e Fase de Lances'), // rito antigo
    ], HOJE)

    const dist = distribuicaoComModelo(linhas, RITO)
    const fora = dist.filter(d => d.noModelo === false)

    expect(fora).toHaveLength(1)
    expect(fora[0].etapa).toBe('Abertura e Fase de Lances')
    expect(dist[dist.length - 1].etapa).toBe('Abertura e Fase de Lances')
  })

  it('processos sem cronograma vão para o fim da lista', () => {
    const linhas = agregarLinhas([proc('1'), proc('2')], [
      etapa('1', 2, 'Elaboração da requisição de propostas'),
    ], HOJE)

    const dist = distribuicaoComModelo(linhas, RITO)
    expect(dist[dist.length - 1]).toMatchObject({ etapa: SEM_CRONOGRAMA, total: 1 })
  })

  it('nenhum processo é perdido na contagem', () => {
    const linhas = agregarLinhas([proc('1'), proc('2'), proc('3')], [
      etapa('1', 2, 'Elaboração da requisição de propostas'),
      etapa('2', 9, 'Etapa de rito antigo'),
    ], HOJE)

    const dist = distribuicaoComModelo(linhas, RITO)
    expect(dist.reduce((acc, d) => acc + d.total, 0)).toBe(3)
  })

  it('rito vazio não perde as etapas existentes', () => {
    const linhas = agregarLinhas([proc('1')], [
      etapa('1', 1, 'Alguma etapa'),
    ], HOJE)

    const dist = distribuicaoComModelo(linhas, [])
    expect(dist).toHaveLength(1)
    expect(dist[0]).toMatchObject({ etapa: 'Alguma etapa', total: 1, noModelo: false })
  })
})

describe('modalidadesPresentes', () => {
  it('lista as modalidades sem repetir, em ordem alfabética', () => {
    const linhas = agregarLinhas([
      proc('1', 'Pregão Eletrônico'),
      proc('2', 'Cotação de Preços'),
      proc('3', 'Pregão Eletrônico'),
    ], [], HOJE)

    expect(modalidadesPresentes(linhas)).toEqual(['Cotação de Preços', 'Pregão Eletrônico'])
  })

  it('ignora processos sem modalidade', () => {
    const semModalidade = { ...proc('1'), modalidades: null }
    const linhas = agregarLinhas([semModalidade], [], HOJE)
    expect(modalidadesPresentes(linhas)).toEqual([])
  })
})
