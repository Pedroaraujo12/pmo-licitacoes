// @vitest-environment jsdom
/**
 * Garante que a tela de Cronograma monta e permanece utilizável nas larguras
 * reais de uso — celular, tablet e desktop. O sistema é acessado de vários
 * dispositivos, e uma quebra só em tela pequena passava despercebida.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/pmo-dashboard/cronograma',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/utils', async (original) => {
  const real = await original<typeof import('@/lib/utils')>()
  return { ...real, fetchAllSeiLinks: vi.fn(async () => ({})) }
})

// Rito longo: 24 etapas, como a Concorrência — o caso que mais ocupa espaço
const ETAPAS = Array.from({ length: 24 }, (_, i) => ({
  modelo_cronograma_id: 'mod-1',
  ordem: i + 1,
  fase: 'Execução',
  descricao: `Etapa ${i + 1} do rito com nome razoavelmente longo`,
  setor: 'UAC',
  duracao_dias_uteis: 3,
}))

const PROCESSOS = Array.from({ length: 12 }, (_, i) => ({
  id: `p${i}`,
  id_processo: `AGSUS.00000${i}/2026-11`,
  objeto_resumido: `Processo ${i}`,
  data_entrada: '2026-06-01',
  data_entrega: '2026-12-01',
  modalidades: { nome: 'Concorrência' },
  status_processo: { nome: 'Em andamento' },
}))

const ATIVIDADES = PROCESSOS.map((p, i) => ({
  processo_id: p.id,
  status: 'nao_iniciado',
  data_fim: '2026-09-01',
  fase: 'Execução',
  descricao: `Etapa ${(i % 24) + 1} do rito com nome razoavelmente longo`,
  ordem: (i % 24) + 1,
}))

function construtor(tabela: string) {
  const alvo: Record<string, unknown[]> = {
    status_processo: [{ id: 'st-1', nome: 'Em andamento' }],
    processos: PROCESSOS,
    cronograma_atividades: ATIVIDADES,
    modelo_cronograma: [{ id: 'mod-1', nome: 'DIOP', total_dias_uteis: 107, modalidade_id: 'm-1', modalidades: { nome: 'Concorrência' } }],
    modelo_etapa: ETAPAS,
  }
  const dados = alvo[tabela] ?? []
  const e: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'in', 'or', 'order', 'limit', 'range', 'neq']) e[m] = vi.fn(() => e)
  ;(e as { then: unknown }).then = (r: (v: unknown) => unknown) =>
    Promise.resolve({ data: dados, count: dados.length, error: null }).then(r)
  return e
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (t: string) => construtor(t),
    rpc: vi.fn(async () => ({ data: null, error: { message: 'sem p_status' } })),
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })) },
  }),
}))

import CronogramaPage from '../page'

const TELAS = [
  { nome: 'celular pequeno', largura: 360 },
  { nome: 'celular comum', largura: 414 },
  { nome: 'tablet retrato', largura: 768 },
  { nome: 'tablet paisagem', largura: 1024 },
  { nome: 'desktop', largura: 1440 },
]

describe('Cronograma nas larguras de uso', () => {
  afterEach(cleanup)
  beforeEach(() => window.sessionStorage.clear())

  for (const tela of TELAS) {
    it(`monta e lista processos em ${tela.nome} (${tela.largura}px)`, async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true, configurable: true, value: tela.largura,
      })
      window.dispatchEvent(new Event('resize'))

      render(<CronogramaPage />)

      await waitFor(() => expect(screen.getByText('Cronograma de Processos')).toBeDefined())
      // A lista precisa aparecer, não só o cabeçalho
      expect(screen.getByText('Processo 0')).toBeDefined()
    })
  }

  it('rito longo não impede a lista de aparecer', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 360 })
    window.dispatchEvent(new Event('resize'))

    const { container } = render(<CronogramaPage />)
    await waitFor(() => expect(screen.getByText('Processo 0')).toBeDefined())

    // Muitos chips de etapa não podem derrubar a montagem
    expect(container.querySelectorAll('button').length).toBeGreaterThan(5)
  })
})
