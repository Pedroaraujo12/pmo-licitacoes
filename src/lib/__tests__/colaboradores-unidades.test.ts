import { describe, it, expect, vi } from 'vitest'
import { contarPorUnidade } from '../colaboradores'
import type { SupabaseClient } from '@supabase/supabase-js'

function fakeSupabase(linhas: { unidade: string | null }[]) {
  const builder: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'limit']) builder[m] = vi.fn(() => builder)
  ;(builder as { then: unknown }).then = (r: (v: unknown) => unknown) =>
    Promise.resolve({ data: linhas, error: null }).then(r)
  return { from: () => builder } as unknown as SupabaseClient
}

describe('contarPorUnidade', () => {
  it('conta por unidade, da maior para a menor', async () => {
    const r = await contarPorUnidade(fakeSupabase([
      { unidade: 'CCS-PES RIO DOCE' }, { unidade: 'CCS-PES RIO DOCE' },
      { unidade: 'CCOE.RD' }, { unidade: 'CCS-PES RIO DOCE' },
    ]))
    expect(r[0]).toEqual({ unidade: 'CCS-PES RIO DOCE', total: 3 })
    expect(r[1]).toEqual({ unidade: 'CCOE.RD', total: 1 })
  })

  it('agrupa quem está sem unidade em vez de descartar', async () => {
    const r = await contarPorUnidade(fakeSupabase([
      { unidade: 'CCOE.RD' }, { unidade: null }, { unidade: '   ' },
    ]))
    // A soma precisa bater com o total de colaboradores
    expect(r.reduce((a, u) => a + u.total, 0)).toBe(3)
    expect(r.some(u => u.unidade === 'Sem unidade' && u.total === 2)).toBe(true)
  })

  it('desempata por ordem alfabética', async () => {
    const r = await contarPorUnidade(fakeSupabase([
      { unidade: 'Zeta' }, { unidade: 'Alfa' },
    ]))
    expect(r.map(u => u.unidade)).toEqual(['Alfa', 'Zeta'])
  })

  it('base vazia devolve lista vazia', async () => {
    expect(await contarPorUnidade(fakeSupabase([]))).toEqual([])
  })
})
