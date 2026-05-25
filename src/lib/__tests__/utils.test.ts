// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatDateBR, formatDate, cleanNum, formatBRL, getAging, exportCSV, clearSeiLinksCache, fetchAllSeiLinks, fetchSeiLink, upsertSeiLink } from '../utils'

describe('formatDateBR', () => {
  it('preserva dia em date-only YYYY-MM-DD', () => {
    expect(formatDateBR('2026-05-23')).toBe('23/05/2026')
  })

  it('preserva dia 1 em date-only', () => {
    expect(formatDateBR('2026-06-01')).toBe('01/06/2026')
  })

  it('preserva dia 31 em date-only', () => {
    expect(formatDateBR('2026-01-31')).toBe('31/01/2026')
  })

  it('lida com null', () => {
    expect(formatDateBR(null)).toBe('-')
  })

  it('lida com undefined', () => {
    expect(formatDateBR(undefined)).toBe('-')
  })

  it('lida com None string', () => {
    expect(formatDateBR('None')).toBe('-')
  })

  it('lida com string vazia', () => {
    expect(formatDateBR('')).toBe('-')
  })

  it('extrai data de ISO datetime string', () => {
    expect(formatDateBR('2026-05-23T10:30:00Z')).toBe('23/05/2026')
  })

  it('extrai data de ISO sem Z', () => {
    expect(formatDateBR('2026-05-23T00:00:00')).toBe('23/05/2026')
  })
})

describe('formatDate', () => {
  it('usa formatDateBR para date-only', () => {
    expect(formatDate('2026-05-23')).toBe('23/05/2026')
  })

  it('extrai data de ISO com timezone', () => {
    expect(formatDate('2026-05-23T12:00:00Z')).toBe('23/05/2026')
  })

  it('retorna - para null', () => {
    expect(formatDate(null)).toBe('-')
  })

  it('retorna - para None', () => {
    expect(formatDate('None')).toBe('-')
  })
})

describe('cleanNum', () => {
  it('limpa formato brasileiro', () => {
    expect(cleanNum('R$ 1.234,56')).toBe(1234.56)
  })

  it('retorna 0 para null', () => {
    expect(cleanNum(null)).toBe(0)
  })

  it('retorna número direto', () => {
    expect(cleanNum(42)).toBe(42)
  })
})

describe('formatBRL', () => {
  it('formata valor em reais', () => {
    expect(formatBRL(1234.56)).toBe('R$ 1.234,56')
  })
})

describe('getAging', () => {
  it('retorna Concluído quando processo_atrasado=false', () => {
    expect(getAging('2026-05-23', false)).toEqual({ label: 'Concluído', class: 'aging-green' })
  })

  it('retorna Atrasado Nd para datas passadas', () => {
    const past = new Date()
    past.setDate(past.getDate() - 5)
    const r = getAging(past.toISOString().split('T')[0])
    expect(r.label).toMatch(/^Atrasado \d+d$/)
    expect(r.class).toBe('aging-red')
  })

  it('retorna Vence em Nd para datas próximas', () => {
    const future = new Date()
    future.setDate(future.getDate() + 1)
    const r = getAging(future.toISOString().split('T')[0])
    expect(r.label).toMatch(/^Vence em \d+d$/)
    expect(r.class).toBe('aging-yellow')
  })

  it('retorna No Prazo para datas distantes', () => {
    const future = new Date()
    future.setDate(future.getDate() + 30)
    const r = getAging(future.toISOString().split('T')[0])
    expect(r.label).toMatch(/^No Prazo \(\d+d\)$/)
    expect(r.class).toBe('aging-green')
  })

  it('retorna Atrasado quando processo_atrasado=true e sem data', () => {
    expect(getAging(null, true)).toEqual({ label: 'Atrasado', class: 'aging-red' })
  })

  it('retorna Não aplicável para null sem flag', () => {
    expect(getAging(null)).toEqual({ label: 'Não aplicável', class: 'aging-gray' })
  })

  it('retorna Não aplicável para None', () => {
    expect(getAging('None')).toEqual({ label: 'Não aplicável', class: 'aging-gray' })
  })
})

function createMockChain(result: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'limit']
  for (const m of methods) {
    const fn = vi.fn()
    fn.mockReturnValue(chain)
    chain[m] = fn
  }
  chain.then = (onfulfilled: (v: unknown) => unknown) =>
    Promise.resolve(result).then(onfulfilled)
  chain.maybeSingle = vi.fn().mockResolvedValue(result)
  return chain
}

describe('upsertSeiLink / fetchSeiLink', () => {
  it('deleta link quando url é null', async () => {
    const chain = createMockChain({ data: null, error: null })
    const supabase = { from: vi.fn().mockReturnValue(chain), auth: { getUser: vi.fn() } } as never
    await upsertSeiLink(supabase, 'proc-1', null)
    expect(chain.delete).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('atividade', '__SEI_LINK__')
  })

  it('atualiza link existente', async () => {
    const chain = createMockChain({ data: { id: 'ativ-1' }, error: null })
    const supabase = { from: vi.fn().mockReturnValue(chain), auth: { getUser: vi.fn() } } as never
    await upsertSeiLink(supabase, 'proc-1', 'https://sei.teste.gov.br/123')
    expect(chain.update).toHaveBeenCalledWith({ observacao: 'https://sei.teste.gov.br/123' })
  })

  it('insere novo link quando não existe', async () => {
    const chain = createMockChain({ data: null, error: null })
    const supabase = {
      from: vi.fn().mockReturnValue(chain),
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
    } as never
    await upsertSeiLink(supabase, 'proc-1', 'https://sei.teste.gov.br/456')
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ observacao: 'https://sei.teste.gov.br/456' }))
  })

  it('fetchSeiLink retorna observacao', async () => {
    const chain = createMockChain({ data: { observacao: 'https://sei.teste.gov.br/789' }, error: null })
    const supabase = { from: vi.fn().mockReturnValue(chain) } as never
    const result = await fetchSeiLink(supabase, 'proc-1')
    expect(result).toBe('https://sei.teste.gov.br/789')
  })

  it('fetchSeiLink retorna null se não encontrado', async () => {
    const chain = createMockChain({ data: null, error: null })
    const supabase = { from: vi.fn().mockReturnValue(chain) } as never
    const result = await fetchSeiLink(supabase, 'proc-1')
    expect(result).toBeNull()
  })
})

describe('fetchAllSeiLinks / clearSeiLinksCache', () => {
  beforeEach(() => clearSeiLinksCache())
  afterEach(() => clearSeiLinksCache())

  it('fetchAllSeiLinks constrói mapa de links', async () => {
    const data = [
      { processo_id: 'p1', observacao: 'https://sei.gov.br/1' },
      { processo_id: 'p2', observacao: 'https://sei.gov.br/2' },
    ]
    const chain = createMockChain({ data, error: null })
    const supabase = { from: vi.fn().mockReturnValue(chain) } as never
    const result = await fetchAllSeiLinks(supabase)
    expect(result).toEqual({ p1: 'https://sei.gov.br/1', p2: 'https://sei.gov.br/2' })
  })

  it('usa cache na segunda chamada', async () => {
    const data = [{ processo_id: 'p1', observacao: 'https://sei.gov.br/1' }]
    const chain = createMockChain({ data, error: null })
    const from = vi.fn().mockReturnValue(chain)
    const supabase = { from } as unknown as Parameters<typeof fetchAllSeiLinks>[0]

    await fetchAllSeiLinks(supabase)
    expect(from).toHaveBeenCalledTimes(1)

    const result = await fetchAllSeiLinks(supabase)
    expect(from).toHaveBeenCalledTimes(1) // still 1 — usou cache
    expect(result).toEqual({ p1: 'https://sei.gov.br/1' })
  })

  it('clearSeiLinksCache força recarga', async () => {
    const data1 = [{ processo_id: 'p1', observacao: 'https://sei.gov.br/1' }]
    const data2 = [{ processo_id: 'p2', observacao: 'https://sei.gov.br/2' }]
    const chain1 = createMockChain({ data: data1, error: null })
    const chain2 = createMockChain({ data: data2, error: null })
    const supabase = { from: vi.fn().mockReturnValue(chain1) } as unknown as { from: ReturnType<typeof vi.fn> }
    const r1 = await fetchAllSeiLinks(supabase as never)
    expect(r1).toEqual({ p1: 'https://sei.gov.br/1' })

    clearSeiLinksCache()
    supabase.from = vi.fn().mockReturnValue(chain2)
    const r2 = await fetchAllSeiLinks(supabase as never)
    expect(r2).toEqual({ p2: 'https://sei.gov.br/2' })
  })
})

describe('exportCSV', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    URL.createObjectURL = vi.fn(() => 'blob:test')
    URL.revokeObjectURL = vi.fn()
  })

  it('não faz nada se data vazia', () => {
    const spy = vi.spyOn(document.body, 'appendChild')
    exportCSV([])
    expect(spy).not.toHaveBeenCalled()
  })

  it('cria link de download', () => {
    const data = [{ nome: 'João', idade: 30 }, { nome: 'Maria', idade: 25 }]
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    const removeSpy = vi.spyOn(document.body, 'removeChild')
    exportCSV(data, 'teste')
    expect(appendSpy).toHaveBeenCalledTimes(1)
    expect(removeSpy).toHaveBeenCalledTimes(1)
    const link = appendSpy.mock.calls[0][0] as HTMLAnchorElement
    expect(link.download).toMatch(/^teste_\d{4}-\d{2}-\d{2}\.csv$/)
  })

  it('remove o link após o clique', () => {
    const data = [{ nome: 'João', idade: 30 }]
    exportCSV(data)
    const links = document.querySelectorAll('a')
    expect(links.length).toBe(0)
  })
})
