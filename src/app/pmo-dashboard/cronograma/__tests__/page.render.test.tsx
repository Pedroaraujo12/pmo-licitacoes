// @vitest-environment jsdom
/**
 * Renderiza a tela de Cronograma com o Supabase simulado, para que uma quebra
 * apareça aqui em vez de no navegador do usuário.
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

const STATUS = [{ id: 'st-1', nome: 'Em andamento' }]

// Concorrência tem etapas de mesmo nome em posições diferentes — é o caso que
// duplica chaves de lista e some da contagem se tratado por descrição.
const ETAPAS_MODELO = [
  { modelo_cronograma_id: 'mod-1', ordem: 1, fase: 'Planejamento', descricao: 'Análise do TR', setor: 'UAC', duracao_dias_uteis: 5 },
  { modelo_cronograma_id: 'mod-1', ordem: 2, fase: 'Análise', descricao: 'Prazo Recursal (3 dias úteis)', setor: 'UAC', duracao_dias_uteis: 3 },
  { modelo_cronograma_id: 'mod-1', ordem: 3, fase: 'Análise', descricao: 'Prazo Recursal (3 dias úteis)', setor: 'UAC', duracao_dias_uteis: 3 },
]

const PROCESSOS = [
  {
    id: 'p1', id_processo: 'AGSUS.000001/2026-11', objeto_resumido: 'Obra',
    data_entrada: '2026-06-01', data_entrega: '2026-12-01',
    modalidades: { nome: 'Concorrência' }, status_processo: { nome: 'Em andamento' },
  },
]

const ATIVIDADES = [
  { processo_id: 'p1', status: 'concluido', data_fim: '2026-07-01', fase: 'Planejamento', descricao: 'Análise do TR', ordem: 1 },
  { processo_id: 'p1', status: 'nao_iniciado', data_fim: '2026-09-01', fase: 'Análise', descricao: 'Prazo Recursal (3 dias úteis)', ordem: 2 },
]

function construtor(tabela: string) {
  const resultado = (dados: unknown[]) => Promise.resolve({ data: dados, count: dados.length, error: null })

  const alvo: Record<string, unknown[]> = {
    status_processo: STATUS,
    processos: PROCESSOS,
    cronograma_atividades: ATIVIDADES,
    modelo_cronograma: [{ id: 'mod-1', nome: 'DIOP Concorrência', total_dias_uteis: 107, modalidade_id: 'm-1', modalidades: { nome: 'Concorrência' } }],
    modelo_etapa: ETAPAS_MODELO,
  }

  const dados = alvo[tabela] ?? []

  const encadeia: Record<string, unknown> = {}
  const metodos = ['select', 'eq', 'in', 'or', 'order', 'limit', 'range', 'neq']
  for (const m of metodos) {
    encadeia[m] = vi.fn(() => encadeia)
  }
  // O await final resolve para os dados da tabela
  ;(encadeia as { then: unknown }).then = (res: (v: unknown) => unknown) => resultado(dados).then(res)
  ;(encadeia as { maybeSingle: unknown }).maybeSingle = () => Promise.resolve({ data: dados[0] ?? null, error: null })
  return encadeia
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (tabela: string) => construtor(tabela),
    rpc: vi.fn(async () => ({ data: null, error: { message: 'not found' } })),
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })) },
  }),
}))

import CronogramaPage from '../page'

describe('tela de Cronograma', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  // Sem isto as renderizações se acumulam no mesmo DOM entre os casos.
  afterEach(cleanup)

  it('renderiza sem quebrar e mostra o título', async () => {
    render(<CronogramaPage />)
    await waitFor(() => {
      expect(screen.getByText('Cronograma de Processos')).toBeDefined()
    })
  })

  it('lista os processos carregados', async () => {
    render(<CronogramaPage />)
    await waitFor(() => {
      expect(screen.getByText('Obra')).toBeDefined()
    })
  })

  it('monta os filtros sem quebrar, mesmo com etapas de mesmo nome', async () => {
    const { container } = render(<CronogramaPage />)
    await waitFor(() => expect(screen.getByText('Obra')).toBeDefined())

    // Se a montagem dos chips falhasse, o React derrubaria a árvore inteira
    // e não haveria botão algum.
    expect(container.querySelectorAll('button').length).toBeGreaterThan(0)
  })
})
