import { describe, it, expect } from 'vitest'
import { agregarLinhas, calcularDistribuicaoEtapas, SEM_CRONOGRAMA } from '../cronograma-lista'

const HOJE = '2026-08-11'

function proc(id: string) {
  return {
    id,
    id_processo: `AGSUS.00000${id}/2026-11`,
    objeto_resumido: 'Objeto',
    data_entrada: '2026-06-01',
    data_entrega: '2026-12-01',
    modalidades: { nome: 'Pregão Eletrônico' },
    status_processo: { nome: 'Em andamento' },
  }
}

function etapa(processo_id: string, ordem: number, descricao: string, status = 'nao_iniciado') {
  return { processo_id, ordem, descricao, status, data_fim: null, fase: 'Execução' }
}

describe('etapa atual', () => {
  it('é a pendente de menor ordem, não a última', () => {
    const [linha] = agregarLinhas([proc('1')], [
      etapa('1', 1, 'Análise do TR', 'concluido'),
      etapa('1', 2, 'Pesquisa de Preços'),
      etapa('1', 3, 'Publicação do Edital'),
    ], HOJE)

    expect(linha.etapa_atual).toBe('Pesquisa de Preços')
    expect(linha.etapa_atual_ordem).toBe(2)
  })

  it('processo todo concluído não tem etapa atual', () => {
    const [linha] = agregarLinhas([proc('1')], [
      etapa('1', 1, 'Análise do TR', 'concluido'),
      etapa('1', 2, 'Pesquisa de Preços', 'concluido'),
    ], HOJE)

    expect(linha.etapa_atual).toBeNull()
    expect(linha.etapa_atual_ordem).toBeNull()
  })

  it('processo sem cronograma não tem etapa atual', () => {
    const [linha] = agregarLinhas([proc('1')], [], HOJE)
    expect(linha.etapa_atual).toBeNull()
  })
})

describe('calcularDistribuicaoEtapas', () => {
  it('conta quantos processos estão em cada etapa', () => {
    const linhas = agregarLinhas([proc('1'), proc('2'), proc('3')], [
      // p1 e p2 na mesma etapa
      etapa('1', 1, 'Análise do TR', 'concluido'),
      etapa('1', 2, 'Pesquisa de Preços'),
      etapa('2', 1, 'Análise do TR', 'concluido'),
      etapa('2', 2, 'Pesquisa de Preços'),
      // p3 mais adiante
      etapa('3', 1, 'Análise do TR', 'concluido'),
      etapa('3', 2, 'Pesquisa de Preços', 'concluido'),
      etapa('3', 3, 'Publicação do Edital'),
    ], HOJE)

    const dist = calcularDistribuicaoEtapas(linhas)

    expect(dist).toHaveLength(2)
    expect(dist[0]).toMatchObject({ etapa: 'Pesquisa de Preços', ordem: 2, total: 2 })
    expect(dist[1]).toMatchObject({ etapa: 'Publicação do Edital', ordem: 3, total: 1 })
  })

  it('ordena pela sequência do rito, não pelo nome', () => {
    const linhas = agregarLinhas([proc('1'), proc('2')], [
      etapa('1', 10, 'Zzz última etapa'),
      etapa('2', 2, 'Aaa etapa inicial'),
    ], HOJE)

    const dist = calcularDistribuicaoEtapas(linhas)
    expect(dist.map(d => d.etapa)).toEqual(['Aaa etapa inicial', 'Zzz última etapa'])
  })

  it('agrupa processos sem cronograma ao final', () => {
    const linhas = agregarLinhas([proc('1'), proc('2')], [
      etapa('1', 3, 'Publicação do Edital'),
    ], HOJE)

    const dist = calcularDistribuicaoEtapas(linhas)
    expect(dist[dist.length - 1]).toMatchObject({ etapa: SEM_CRONOGRAMA, total: 1 })
  })

  it('a soma das contagens é o total de processos', () => {
    const linhas = agregarLinhas([proc('1'), proc('2'), proc('3'), proc('4')], [
      etapa('1', 2, 'Pesquisa de Preços'),
      etapa('2', 2, 'Pesquisa de Preços'),
      etapa('3', 5, 'Julgamento'),
    ], HOJE)

    const dist = calcularDistribuicaoEtapas(linhas)
    expect(dist.reduce((acc, d) => acc + d.total, 0)).toBe(4)
  })

  it('lista vazia devolve distribuição vazia', () => {
    expect(calcularDistribuicaoEtapas([])).toEqual([])
  })
})
