import { describe, it, expect } from 'vitest'
import { TEXTOS_PREGAO } from '../rito-textos'

describe('redação oficial do Pregão', () => {
  it('tem as 20 etapas do rito', () => {
    expect(TEXTOS_PREGAO).toHaveLength(20)
  })

  it('numera de 1 a 20 sem buracos', () => {
    expect(TEXTOS_PREGAO.map(t => t.ordem)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    )
  })

  it('usa a redação da planilha nas etapas que divergiam', () => {
    const porOrdem = new Map(TEXTOS_PREGAO.map(t => [t.ordem, t.descricao]))
    expect(porOrdem.get(1)).toBe('Análise TR/UAC')
    expect(porOrdem.get(8)).toBe('Publicação do Edital (8D - Aquisição/10D - Serviço)')
    expect(porOrdem.get(14)).toBe('Prazo Recursal (3D)')
    expect(porOrdem.get(17)).toBe('Envio do Recurso (2d)')
    expect(porOrdem.get(18)).toBe('Adjudicação (1D - s/recurso)')
  })

  it('não tem descrição vazia', () => {
    expect(TEXTOS_PREGAO.every(t => t.descricao.trim().length > 0)).toBe(true)
  })
})
