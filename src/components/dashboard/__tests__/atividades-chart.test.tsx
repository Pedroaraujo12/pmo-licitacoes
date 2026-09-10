// @vitest-environment jsdom
/**
 * Gráfico de processos por atividade atual, que também é filtro.
 *
 * Os dados aqui são o retrato da carteira real: 26 atividades, cauda longa
 * com 14 delas em um processo só, rótulos de até 173 caracteres, e o maior
 * grupo sendo justamente os que não declaram atividade.
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import AtividadesChart from '../atividades-chart'
import {
  agruparPorAtividadeAtual,
  combinaAtividade,
  ATIVIDADE_NAO_DECLARADA,
} from '@/lib/dashboard-metrics'

afterEach(cleanup)

const ROTULO_LONGO =
  'Publicação do Edital (prazos legais: 3 dias úteis - Cotação de Preços,  8 dias úteis - Pregão bens e materiais, 10 dias úteis - Pregão serviços e 15 dias úteis concorrência)'

const CARTEIRA = [
  ...Array.from({ length: 17 }, () => ({ atividade_atual: null })),
  ...Array.from({ length: 11 }, () => ({ atividade_atual: 'Análise do Termo de Referência e anexos' })),
  ...Array.from({ length: 6 }, () => ({ atividade_atual: 'Análise jurídica e Emissão de Parecer' })),
  ...Array.from({ length: 5 }, () => ({ atividade_atual: 'Concluído' })),
  { atividade_atual: ROTULO_LONGO },
  { atividade_atual: '   ' }, // só espaço conta como não declarada
]

describe('agruparPorAtividadeAtual', () => {
  it('conta por atividade, da mais frequente para a menos', () => {
    const r = agruparPorAtividadeAtual(CARTEIRA)
    expect(r[0]).toEqual({ atividade: ATIVIDADE_NAO_DECLARADA, total: 18, declarada: false })
    expect(r[1].atividade).toBe('Análise do Termo de Referência e anexos')
    expect(r[1].total).toBe(11)
  })

  it('a soma das barras é a carteira inteira — nada fica de fora', () => {
    const r = agruparPorAtividadeAtual(CARTEIRA)
    expect(r.reduce((s, a) => s + a.total, 0)).toBe(CARTEIRA.length)
  })

  it('campo em branco entra no grupo de não declarada, não numa barra vazia', () => {
    const r = agruparPorAtividadeAtual([{ atividade_atual: '  ' }, { atividade_atual: null }])
    expect(r).toEqual([{ atividade: ATIVIDADE_NAO_DECLARADA, total: 2, declarada: false }])
  })

  it('desempata por nome, na ordem do português', () => {
    const r = agruparPorAtividadeAtual([
      { atividade_atual: 'Zelar' }, { atividade_atual: 'Ánalise' }, { atividade_atual: 'Aceitar' },
    ])
    expect(r.map(a => a.atividade)).toEqual(['Aceitar', 'Ánalise', 'Zelar'])
  })

  it('carteira vazia não quebra', () => {
    expect(agruparPorAtividadeAtual([])).toEqual([])
  })
})

describe('combinaAtividade', () => {
  it('sem filtro, tudo passa', () => {
    expect(combinaAtividade('Qualquer', null)).toBe(true)
    expect(combinaAtividade(null, null)).toBe(true)
  })

  it('o filtro de não declarada pega justamente os vazios', () => {
    expect(combinaAtividade(null, ATIVIDADE_NAO_DECLARADA)).toBe(true)
    expect(combinaAtividade('  ', ATIVIDADE_NAO_DECLARADA)).toBe(true)
    expect(combinaAtividade('Análise', ATIVIDADE_NAO_DECLARADA)).toBe(false)
  })

  it('atividade específica casa só com ela, ignorando espaço em volta', () => {
    expect(combinaAtividade('  Análise Jurídica ', 'Análise Jurídica')).toBe(true)
    expect(combinaAtividade('Outra', 'Análise Jurídica')).toBe(false)
  })
})

describe('AtividadesChart', () => {
  const dados = agruparPorAtividadeAtual(CARTEIRA)
  const montar = (onSelecionar = vi.fn(), selecionada: string | null = null) => {
    render(<AtividadesChart atividades={dados} selecionada={selecionada} onSelecionar={onSelecionar} />)
    return onSelecionar
  }

  it('mostra todas as atividades — a cauda longa não é cortada', () => {
    montar()
    const aria = screen.getByRole('img').getAttribute('aria-label')!
    for (const a of dados) expect(aria).toContain(a.atividade)
  })

  it('declara quantos processos em quantas atividades', () => {
    montar()
    expect(screen.getByText(/41 processos em 5 atividades/)).toBeTruthy()
  })

  it('clicar numa barra pede o filtro daquela atividade', () => {
    const onSelecionar = montar()
    const barras = document.querySelectorAll('svg rect')
    fireEvent.click(barras[0])
    expect(onSelecionar).toHaveBeenCalledWith(ATIVIDADE_NAO_DECLARADA)
  })

  it('clicar na barra já selecionada limpa o filtro', () => {
    const onSelecionar = montar(vi.fn(), ATIVIDADE_NAO_DECLARADA)
    fireEvent.click(document.querySelectorAll('svg rect')[0])
    expect(onSelecionar).toHaveBeenCalledWith(null)
  })

  it('o rótulo de 173 caracteres é truncado na calha e inteiro no rótulo acessível', () => {
    montar()
    const textos = [...document.querySelectorAll('svg text')].map(t => t.textContent || '')
    const truncado = textos.find(t => t.startsWith('Publicação do Edital'))
    expect(truncado!.endsWith('…')).toBe(true)
    expect(truncado!.length).toBeLessThan(ROTULO_LONGO.length)
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain(ROTULO_LONGO)
  })

  it('explica que a barra cinza é a ausência de dado, não uma etapa', () => {
    montar()
    expect(screen.getByText(/sem atividade declarada/)).toBeTruthy()
  })

  it('sem processos, diz isso em vez de desenhar um gráfico vazio', () => {
    render(<AtividadesChart atividades={[]} selecionada={null} onSelecionar={vi.fn()} />)
    expect(screen.getByText('Nenhum processo na carteira')).toBeTruthy()
  })
})
