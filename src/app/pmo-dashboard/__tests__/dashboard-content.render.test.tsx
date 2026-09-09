// @vitest-environment jsdom
/**
 * Garante que a tela do dashboard monta de ponta a ponta com dados de verdade
 * vindos das mesmas chamadas que ela faz em produção — e que a narrativa que a
 * revisão introduziu chega inteira à tela: o alerta aponta para o gráfico que
 * existe, o cabeçalho diz de quando são os números, e filtrar por uma faixa de
 * prazo mexe na tabela.
 *
 * Os componentes têm testes próprios; aqui o que se verifica é a montagem, a
 * ligação entre eles e o caminho dos dados.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent, within } from '@testing-library/react'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/pmo-dashboard',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/utils', async (original) => {
  const real = await original<typeof import('@/lib/utils')>()
  return { ...real, fetchAllSeiLinks: vi.fn(async () => ({})) }
})

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock('@/components/ui/colaboradores/aniversariantes-widget', () => ({
  default: () => <div data-testid="aniversariantes" />,
}))

/* Datas relativas a hoje para que as faixas de prazo não mudem com o calendário. */
const hoje = new Date()
const emDias = (n: number) => {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const PROCESSOS = [
  {
    id: 'p1', id_processo: 'AGSUS.001198/2026-96', objeto_resumido: 'Telessaúde',
    data_entrada: emDias(-200), data_entrega: emDias(-40), valor_estimado: 12992461.91,
    valor_homologado: 0, prioridade: 'Urgente', atividade_atual: 'Adjudicação',
    observacoes: null, status_nome: 'Em andamento', modalidade_nome: 'Pregão Eletrônico',
    responsavel_nome: 'Bruno', coordenacao_nome: 'CCS', demandante_nome: 'DAIS', total_count: 3,
  },
  {
    id: 'p2', id_processo: 'AGSUS.013265/2026-15', objeto_resumido: 'Insumos médicos',
    data_entrada: emDias(-90), data_entrega: emDias(3), valor_estimado: 169598.12,
    valor_homologado: 0, prioridade: 'Média', atividade_atual: 'Análise do TR',
    observacoes: null, status_nome: 'Em andamento', modalidade_nome: 'Cotação de Preços',
    responsavel_nome: 'Ilma', coordenacao_nome: 'CCS', demandante_nome: 'DAIS', total_count: 3,
  },
  {
    id: 'p3', id_processo: 'AGSUS.005924/2026-40', objeto_resumido: 'Reforma do sistema de água',
    data_entrada: emDias(-300), data_entrega: null, valor_estimado: 0,
    valor_homologado: 0, prioridade: 'Baixa', atividade_atual: null,
    observacoes: null, status_nome: 'Não recebido', modalidade_nome: 'Concorrência',
    responsavel_nome: null, coordenacao_nome: 'CCS', demandante_nome: 'DAIS', total_count: 3,
  },
]

const SUMMARY = {
  total_processos: 3,
  processos_atrasados: 1,
  processos_vencendo_7_dias: 1,
  valor_estimado_total: 13162060.03,
  valor_homologado_total: 9500000,
  economia_total: 717051.96,
  por_status: [
    { status: 'Em andamento', total: 2, valor_estimado: 13162060.03, valor_homologado: 9500000 },
    { status: 'Não recebido', total: 1, valor_estimado: 0, valor_homologado: 0 },
  ],
  por_modalidade: [
    { modalidade: 'Pregão Eletrônico', total: 1 },
    { modalidade: 'Cotação de Preços', total: 1 },
    { modalidade: 'Concorrência', total: 1 },
  ],
  etapa_distribuicao: [],
  aniversariantes_15_dias: [],
}

const CRONOGRAMA = [
  { fase: 'Instrução', descricao: null, status: 'concluido', data_inicio: emDias(-60), data_fim: emDias(-38) },
  { fase: 'Julgamento', descricao: null, status: 'concluido', data_inicio: emDias(-30), data_fim: emDias(-20) },
]

function tabela(nome: string) {
  if (nome === 'processos') {
    return { select: vi.fn(async () => ({ data: PROCESSOS.map(p => ({ id: p.id, data_atividade: emDias(-10) })), error: null })) }
  }
  if (nome === 'cronograma_atividades') {
    const chain = { eq: vi.fn(async () => ({ data: CRONOGRAMA, error: null })) }
    return { select: vi.fn(() => chain) }
  }
  return { select: vi.fn(async () => ({ data: [], error: null })) }
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    rpc: vi.fn(async (fn: string) => {
      if (fn === 'get_dashboard_summary') return { data: SUMMARY, error: null }
      if (fn === 'search_processos') return { data: PROCESSOS, error: null }
      return { data: null, error: null }
    }),
    from: vi.fn((nome: string) => tabela(nome)),
  }),
}))

import DashboardContent from '../dashboard-content'

beforeEach(() => { push.mockClear() })
afterEach(cleanup)

async function montar(role = 'admin') {
  render(<DashboardContent userRole={role} />)
  await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeTruthy())
  await waitFor(() => expect(screen.getByText(/AGSUS\.001198/)).toBeTruthy())
}

describe('DashboardContent', () => {
  it('abre com título de página e carimbo de quando são os números', async () => {
    await montar()
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeTruthy()
    await waitFor(() => expect(screen.getByText(/^Atualizado em \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}$/)).toBeTruthy())
  })

  it('o alerta manda ver a faixa de prazo — e a faixa existe na tela', async () => {
    await montar()
    const alerta = screen.getByRole('alert')
    expect(alerta.textContent).toContain('1 processo em atraso')
    expect(alerta.textContent).toContain('faixa de prazo')
    expect(screen.getByLabelText(/Processos por faixa de prazo:/)).toBeTruthy()
  })

  it('o botão do alerta filtra todos os atrasados, não só uma faixa', async () => {
    await montar()
    fireEvent.click(screen.getByRole('button', { name: /Ver o 1 atrasado|Ver os 1 atrasados/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Remover filtro Em atraso/ })).toBeTruthy())
    expect(screen.getByText(/AGSUS\.001198/)).toBeTruthy()
    expect(screen.queryByText(/AGSUS\.013265/)).toBeNull()
  })

  it('a tabela traz prazo por processo, com o atraso em dias', async () => {
    await montar()
    expect(screen.getByText(/40 dias de atraso/)).toBeTruthy()
    expect(screen.getByText(/vence em 3 dias/)).toBeTruthy()
  })

  it('valor sem estimativa aparece como não informado, não como R$ 0,00', async () => {
    await montar()
    const linha = screen.getByText('Reforma do sistema de água').closest('tr')!
    expect(within(linha).getByText('não informado')).toBeTruthy()
    expect(within(linha).getByText('não atribuído')).toBeTruthy()
  })

  it('remover o chip devolve a carteira inteira', async () => {
    await montar()
    fireEvent.click(screen.getByRole('button', { name: /Ver os? \d+ atrasados?/ }))
    await waitFor(() => expect(screen.queryByText(/AGSUS\.013265/)).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: /Remover filtro Em atraso/ }))
    await waitFor(() => expect(screen.getByText(/AGSUS\.013265/)).toBeTruthy())
    expect(screen.getByText(/Nenhum filtro ativo/)).toBeTruthy()
  })

  it('o tempo por etapa sai do cronograma real, não de estimativa', async () => {
    await montar()
    const grafico = screen.getByLabelText(/Tempo médio por etapa/)
    expect(grafico.getAttribute('aria-label')).toContain('Instrução, 22')
    expect(grafico.getAttribute('aria-label')).toContain('Julgamento, 10')
  })

  it('o atalho de busca respeita a plataforma', async () => {
    await montar()
    expect(screen.getByText('Ctrl K')).toBeTruthy()
  })

  it('quem não pode editar não vê a coluna de ações', async () => {
    await montar('visualizador')
    expect(screen.queryByRole('columnheader', { name: 'Ações' })).toBeNull()
    expect(screen.getByRole('columnheader', { name: 'Prazo' })).toBeTruthy()
  })

  it('não mostra mais a coluna Observações, que duplicava a atividade atual', async () => {
    await montar()
    expect(screen.queryByRole('columnheader', { name: 'Observações' })).toBeNull()
  })
})
