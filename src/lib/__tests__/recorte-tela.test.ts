// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  normalizarRecorte, lerRecorte, gravarRecorte, esquecerRecorte,
  temRecorte, descreverRecorte,
} from '../recorte-tela'

const PADRAO = {
  search: '',
  apenasAndamento: true,
  modalidade: null as string | null,
  coordenacao: null as string | null,
  prioridade: null as string | null,
  page: 1,
}

const CHAVE = 'pmo_teste_recorte'

beforeEach(() => {
  window.sessionStorage.clear()
})

describe('normalizarRecorte', () => {
  it('devolve os padrões para entrada que não é objeto', () => {
    expect(normalizarRecorte(null, PADRAO)).toEqual(PADRAO)
    expect(normalizarRecorte('lixo', PADRAO)).toEqual(PADRAO)
    expect(normalizarRecorte(undefined, PADRAO)).toEqual(PADRAO)
  })

  it('preserva os campos válidos', () => {
    const r = normalizarRecorte({
      search: 'ambulância', apenasAndamento: false,
      modalidade: 'Pregão Eletrônico', coordenacao: 'CCS-RD',
      prioridade: 'Alta', page: 2,
    }, PADRAO)
    expect(r).toEqual({
      search: 'ambulância', apenasAndamento: false,
      modalidade: 'Pregão Eletrônico', coordenacao: 'CCS-RD',
      prioridade: 'Alta', page: 2,
    })
  })

  it('ignora chaves que a tela não conhece', () => {
    const r = normalizarRecorte({ search: 'x', filtroDeOutraTela: 'y' }, PADRAO)
    expect(r).not.toHaveProperty('filtroDeOutraTela')
    expect(r.search).toBe('x')
  })

  it('trata string vazia de filtro como ausência de filtro', () => {
    expect(normalizarRecorte({ modalidade: '' }, PADRAO).modalidade).toBeNull()
  })

  it('descarta tipos errados sem lançar', () => {
    const r = normalizarRecorte({
      search: 42, apenasAndamento: 'sim', modalidade: { a: 1 },
      page: 'duas',
    }, PADRAO)
    expect(r.search).toBe('')
    expect(r.apenasAndamento).toBe(true)
    expect(r.modalidade).toBeNull()
    expect(r.page).toBe(1)
  })

  it('corrige números fora de faixa', () => {
    expect(normalizarRecorte({ page: -3 }, PADRAO).page).toBe(1)
    expect(normalizarRecorte({ page: 2.7 }, PADRAO).page).toBe(2)
    expect(normalizarRecorte({ page: NaN }, PADRAO).page).toBe(1)
  })
})

describe('lerRecorte / gravarRecorte', () => {
  it('devolve os padrões quando nada foi gravado', () => {
    expect(lerRecorte(CHAVE, PADRAO)).toEqual({ valores: PADRAO, scrollY: 0 })
  })

  it('faz o ciclo completo de ida e volta', () => {
    const v = { ...PADRAO, modalidade: 'Cotação de Preços', page: 3 }
    gravarRecorte(CHAVE, v, 840)
    expect(lerRecorte(CHAVE, PADRAO)).toEqual({ valores: v, scrollY: 840 })
  })

  it('devolve os padrões quando o conteúdo gravado não é JSON', () => {
    window.sessionStorage.setItem(CHAVE, '{quebrado')
    expect(lerRecorte(CHAVE, PADRAO)).toEqual({ valores: PADRAO, scrollY: 0 })
  })

  it('não mistura o recorte de uma tela com o de outra', () => {
    gravarRecorte('pmo_tela_a', { ...PADRAO, modalidade: 'Pregão Eletrônico' })
    expect(lerRecorte('pmo_tela_b', PADRAO).valores).toEqual(PADRAO)
  })

  it('esquecerRecorte apaga o que foi guardado', () => {
    gravarRecorte(CHAVE, { ...PADRAO, coordenacao: 'CCS-RD' })
    esquecerRecorte(CHAVE)
    expect(lerRecorte(CHAVE, PADRAO).valores).toEqual(PADRAO)
  })
})

describe('temRecorte', () => {
  it('é falso no estado padrão', () => {
    expect(temRecorte(PADRAO, PADRAO)).toBe(false)
  })

  it('é verdadeiro para qualquer filtro ativo', () => {
    expect(temRecorte({ ...PADRAO, search: 'ambul' }, PADRAO)).toBe(true)
    expect(temRecorte({ ...PADRAO, prioridade: 'Alta' }, PADRAO)).toBe(true)
    expect(temRecorte({ ...PADRAO, apenasAndamento: false }, PADRAO)).toBe(true)
  })

  it('campos ignorados não contam como recorte', () => {
    expect(temRecorte({ ...PADRAO, page: 4 }, PADRAO, ['page'])).toBe(false)
    expect(temRecorte({ ...PADRAO, page: 4 }, PADRAO)).toBe(true)
  })
})

describe('descreverRecorte', () => {
  const ROTULOS = { search: 'busca', prioridade: 'prioridade', apenasAndamento: 'todos os status' }

  it('lista os filtros ativos separados por ponto', () => {
    const texto = descreverRecorte(
      { ...PADRAO, modalidade: 'Pregão Eletrônico', coordenacao: 'CCS-RD', prioridade: 'Alta' },
      PADRAO, ROTULOS, ['page'],
    )
    expect(texto).toBe('Pregão Eletrônico · CCS-RD · prioridade Alta')
  })

  it('prefixa com o rótulo quando o valor sozinho não se explica', () => {
    expect(descreverRecorte({ ...PADRAO, search: 'ambulância' }, PADRAO, ROTULOS, ['page']))
      .toBe('busca ambulância')
  })

  it('booleano fora do padrão aparece pelo rótulo', () => {
    expect(descreverRecorte({ ...PADRAO, apenasAndamento: false }, PADRAO, ROTULOS, ['page']))
      .toBe('todos os status')
  })

  it('é vazio quando não há recorte', () => {
    expect(descreverRecorte(PADRAO, PADRAO, ROTULOS, ['page'])).toBe('')
  })

  it('cai no próprio valor quando não há rótulo', () => {
    expect(descreverRecorte({ ...PADRAO, coordenacao: 'CCS-RD' }, PADRAO, {}, ['page']))
      .toBe('CCS-RD')
  })
})
