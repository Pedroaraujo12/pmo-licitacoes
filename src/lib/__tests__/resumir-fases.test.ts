import { describe, it, expect } from 'vitest'
import { resumirFases } from '../cronograma-engine'

/** As 20 etapas do rito de Pregão Eletrônico, como estão cadastradas. */
const PREGAO = [
  { fase: 'Planejamento', dias: 5 },
  { fase: 'Produção', dias: 5 },
  { fase: 'Produção', dias: 1 },
  { fase: 'Revisão', dias: 0 },
  { fase: 'Produção', dias: 5 },
  { fase: 'Análise', dias: 5 },
  { fase: 'Produção', dias: 1 },
  { fase: 'Produção', dias: 8 },
  { fase: 'Execução', dias: 1 },
  { fase: 'Execução', dias: 8 },
  { fase: 'Execução', dias: 1 },
  { fase: 'Análise', dias: 5 },
  { fase: 'Execução', dias: 1 },
  { fase: 'Análise', dias: 3 },
  { fase: 'Análise', dias: 3 },
  { fase: 'Análise', dias: 5 },
  { fase: 'Aprovação', dias: 2 },
  { fase: 'Aprovação', dias: 1 },
  { fase: 'Aprovação', dias: 1 },
  { fase: 'Aprovação', dias: 8 },
]

describe('resumirFases', () => {
  it('soma a fase inteira, mesmo quando ela não é contígua', () => {
    const r = resumirFases(PREGAO)
    const producao = r.find(f => f.fase === 'Produção')
    // As cinco etapas de Produção do Pregão estão nas ordens 2, 3, 5, 7 e 8.
    expect(producao?.etapas).toBe(5)
    expect(producao?.dias).toBe(20)
  })

  it('devolve as fases na ordem da primeira aparição', () => {
    expect(resumirFases(PREGAO).map(f => f.fase)).toEqual([
      'Planejamento', 'Produção', 'Revisão', 'Análise', 'Execução', 'Aprovação',
    ])
  })

  it('o total das fases fecha com o total do rito', () => {
    const r = resumirFases(PREGAO)
    expect(r.reduce((s, f) => s + f.dias, 0)).toBe(69)
    expect(r.reduce((s, f) => s + f.etapas, 0)).toBe(20)
  })

  it('conta o marco como etapa, com zero dia', () => {
    const revisao = resumirFases(PREGAO).find(f => f.fase === 'Revisão')
    expect(revisao?.etapas).toBe(1)
    expect(revisao?.dias).toBe(0)
  })

  it('traz rótulo e cor prontos para a tela', () => {
    const p = resumirFases([{ fase: 'Produção', dias: 3 }])[0]
    expect(p.rotulo).toContain('Produção')
    expect(p.cor).toMatch(/^#/)
  })

  it('ignora etapa sem fase em vez de criar um grupo vazio', () => {
    const r = resumirFases([
      { fase: 'Análise', dias: 2 },
      { fase: '', dias: 3 },
      { fase: null, dias: 4 },
    ])
    expect(r).toHaveLength(1)
    expect(r[0].fase).toBe('Análise')
  })

  it('trata duração ausente como zero, sem virar NaN', () => {
    const r = resumirFases([{ fase: 'Execução', dias: null }, { fase: 'Execução', dias: 2 }])
    expect(r[0].dias).toBe(2)
    expect(r[0].etapas).toBe(2)
  })

  it('aceita lista vazia', () => {
    expect(resumirFases([])).toEqual([])
  })
})
