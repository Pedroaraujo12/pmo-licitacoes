// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  normalizarFiltros, lerFiltros, gravarFiltros, esquecerFiltros,
  temRecorte, descreverRecorte, FILTROS_PADRAO,
} from '../filtros-cronograma'

beforeEach(() => {
  window.sessionStorage.clear()
})

describe('normalizarFiltros', () => {
  it('devolve os padrões para entrada que não é objeto', () => {
    expect(normalizarFiltros(null)).toEqual(FILTROS_PADRAO)
    expect(normalizarFiltros('lixo')).toEqual(FILTROS_PADRAO)
    expect(normalizarFiltros(undefined)).toEqual(FILTROS_PADRAO)
  })

  it('preserva os campos válidos', () => {
    const f = normalizarFiltros({
      search: 'ambulância', apenasAndamento: false,
      modalidadeFiltro: 'Pregão Eletrônico', coordenacaoFiltro: 'CCS-RD',
      responsavelFiltro: 'Pedro', prioridadeFiltro: 'Alta',
      etapaFiltro: '3|Elaboração do ETP', page: 2, scrollY: 840,
    })
    expect(f.search).toBe('ambulância')
    expect(f.apenasAndamento).toBe(false)
    expect(f.modalidadeFiltro).toBe('Pregão Eletrônico')
    expect(f.etapaFiltro).toBe('3|Elaboração do ETP')
    expect(f.page).toBe(2)
    expect(f.scrollY).toBe(840)
  })

  it('trata string vazia de filtro como ausência de filtro', () => {
    expect(normalizarFiltros({ modalidadeFiltro: '' }).modalidadeFiltro).toBeNull()
  })

  it('descarta tipos errados sem lançar', () => {
    const f = normalizarFiltros({
      search: 42, apenasAndamento: 'sim', modalidadeFiltro: { a: 1 },
      page: 'duas', scrollY: NaN,
    })
    expect(f.search).toBe('')
    expect(f.apenasAndamento).toBe(true)
    expect(f.modalidadeFiltro).toBeNull()
    expect(f.page).toBe(1)
    expect(f.scrollY).toBe(0)
  })

  it('corrige página e rolagem fora de faixa', () => {
    expect(normalizarFiltros({ page: 0 }).page).toBe(1)
    expect(normalizarFiltros({ page: -3 }).page).toBe(1)
    expect(normalizarFiltros({ page: 2.7 }).page).toBe(2)
    expect(normalizarFiltros({ scrollY: -50 }).scrollY).toBe(0)
  })
})

describe('lerFiltros / gravarFiltros', () => {
  it('devolve os padrões quando nada foi gravado', () => {
    expect(lerFiltros()).toEqual(FILTROS_PADRAO)
  })

  it('faz o ciclo completo de ida e volta', () => {
    const f = { ...FILTROS_PADRAO, modalidadeFiltro: 'Cotação de Preços', page: 3 }
    gravarFiltros(f)
    expect(lerFiltros()).toEqual(f)
  })

  it('devolve os padrões quando o conteúdo gravado não é JSON', () => {
    window.sessionStorage.setItem('pmo_cronograma_filtros', '{quebrado')
    expect(lerFiltros()).toEqual(FILTROS_PADRAO)
  })

  it('esquecerFiltros apaga o recorte', () => {
    gravarFiltros({ ...FILTROS_PADRAO, coordenacaoFiltro: 'CCS-RD' })
    esquecerFiltros()
    expect(lerFiltros()).toEqual(FILTROS_PADRAO)
  })
})

describe('temRecorte', () => {
  it('é falso no estado padrão', () => {
    expect(temRecorte(FILTROS_PADRAO)).toBe(false)
  })

  it('paginação sozinha não conta como recorte', () => {
    expect(temRecorte({ ...FILTROS_PADRAO, page: 4, scrollY: 900 })).toBe(false)
  })

  it('é verdadeiro para qualquer filtro ativo', () => {
    expect(temRecorte({ ...FILTROS_PADRAO, search: 'ambul' })).toBe(true)
    expect(temRecorte({ ...FILTROS_PADRAO, prioridadeFiltro: 'Alta' })).toBe(true)
    expect(temRecorte({ ...FILTROS_PADRAO, apenasAndamento: false })).toBe(true)
  })
})

describe('descreverRecorte', () => {
  it('lista os filtros ativos separados por ponto', () => {
    const texto = descreverRecorte({
      ...FILTROS_PADRAO,
      modalidadeFiltro: 'Pregão Eletrônico',
      coordenacaoFiltro: 'CCS-RD',
      prioridadeFiltro: 'Alta',
    })
    expect(texto).toBe('Pregão Eletrônico · CCS-RD · prioridade Alta')
  })

  it('mostra a busca entre aspas', () => {
    expect(descreverRecorte({ ...FILTROS_PADRAO, search: 'ambulância' }))
      .toBe('busca "ambulância"')
  })

  it('é vazio quando não há recorte', () => {
    expect(descreverRecorte(FILTROS_PADRAO)).toBe('')
  })
})
