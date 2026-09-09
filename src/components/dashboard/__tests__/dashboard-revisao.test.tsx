// @vitest-environment jsdom
/**
 * Trava os comportamentos que a revisão do dashboard introduziu — os que uma
 * conferência visual pegaria, e que uma refatoração futura pode desfazer sem
 * quebrar tipo nenhum: valor ausente não vira R$ 0,00, o total sai da grade
 * das partes, os cards de status são operáveis por teclado e os gráficos têm
 * descrição textual.
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import StatusCards, { type StatusValue } from '../status-cards'
import KpiCards from '../kpi-cards'
import PrazoECiclo from '../prazo-e-ciclo'
import CargaETendencia from '../carga-e-tendencia'
import FilterChips from '../filter-chips'
import { agruparPorFaixaDePrazo } from '@/lib/dashboard-metrics'

afterEach(cleanup)

const HOJE = new Date(2026, 8, 9)

const STATUS: StatusValue[] = [
  { status: 'Em andamento', total: 25, valor_estimado: 25408559.49, valor_homologado: 19877885.70 },
  { status: 'Concluído', total: 24, valor_estimado: 19969928.17, valor_homologado: 19252876.21 },
  { status: 'Não recebido', total: 18, valor_estimado: 0, valor_homologado: 0 },
  { status: 'Devolvido', total: 4, valor_estimado: 1730154.08, valor_homologado: 0 },
  { status: 'Cancelado', total: 3, valor_estimado: 7151618.83, valor_homologado: 221712.00 },
]

function renderStatus(onSelect = vi.fn()) {
  render(
    <StatusCards
      porStatus={STATUS}
      totalEstimado={54260260.57}
      totalHomologado={39352473.91}
      totalProcessos={74}
      economia={717051.96}
      taxaHomologacao={72.52}
      selected={null}
      onSelect={onSelect}
    />,
  )
  return onSelect
}

describe('StatusCards', () => {
  it('mostra um card por status, sem o total entre eles', () => {
    renderStatus()
    const cards = screen.getAllByRole('button', { pressed: false })
    expect(cards).toHaveLength(STATUS.length)
    expect(cards.some(c => /Total da carteira/.test(c.textContent || ''))).toBe(false)
  })

  it('não afirma R$ 0,00 onde não há estimativa', () => {
    renderStatus()
    const naoRecebido = screen.getAllByRole('button').find(b => /Não recebido/.test(b.textContent || ''))!
    expect(naoRecebido.textContent).toContain('não informado')
    expect(naoRecebido.textContent).not.toContain('R$ 0,00')
  })

  it('mostra R$ 0,00 quando o zero é um fato, não uma ausência', () => {
    renderStatus()
    const devolvido = screen.getAllByRole('button').find(b => /Devolvido/.test(b.textContent || ''))!
    // estimado de R$ 1,7 mi e homologado realmente zerado
    expect(devolvido.textContent).toContain('R$ 0,00')
  })

  it('rotula a barra como participação na carteira, não como "do valor estimado"', () => {
    renderStatus()
    const emAndamento = screen.getAllByRole('button').find(b => /Em andamento/.test(b.textContent || ''))!
    expect(emAndamento.textContent).toContain('47% da carteira')
    expect(emAndamento.textContent).not.toContain('do valor estimado')
  })

  it('os cards são botões com estado — operáveis por teclado e anunciáveis', () => {
    const onSelect = renderStatus()
    const card = screen.getAllByRole('button').find(b => /Concluído/.test(b.textContent || ''))!
    expect(card.tagName).toBe('BUTTON')
    expect(card.getAttribute('aria-pressed')).toBe('false')
    card.click()
    expect(onSelect).toHaveBeenCalledWith('Concluído')
  })

  it('a faixa de total traz carteira, homologado com taxa e economia', () => {
    renderStatus()
    const total = screen.getByText('Total da carteira').parentElement!
    expect(total.textContent).toContain('74')
    expect(total.textContent).toContain('72,5%')
    expect(within(total).getByRole('img').getAttribute('aria-label'))
      .toContain('Composição do valor estimado')
  })
})

describe('KpiCards', () => {
  const base = {
    atrasados: 11, total: 74, taxaHomologacao: 72.52,
    estimadoTotal: 54260260.57, homologadoTotal: 39352473.91,
    economia: 717051.96, economiaPercentual: 3.59, concluidos: 24,
  }

  it('promove o atraso a indicador, com participação na carteira', () => {
    render(<KpiCards {...base} />)
    expect(screen.getByText('11')).toBeTruthy()
    expect(screen.getByText(/14,9% da carteira/)).toBeTruthy()
    expect(screen.getByText(/63 no prazo/)).toBeTruthy()
  })

  it('mostra economia em percentual, não só o valor absoluto', () => {
    render(<KpiCards {...base} />)
    expect(screen.getByText('3,6')).toBeTruthy()
    expect(screen.getByText(/em 24 concluídos/)).toBeTruthy()
  })

  it('não usa seta de alta para economia — a seta é da variação, e só aparece com série', () => {
    const { container } = render(<KpiCards {...base} />)
    expect(container.textContent).not.toContain('↑ sobre valor estimado')
  })

  it('desenha a faixa de tendência quando há série, com rótulo textual', () => {
    render(<KpiCards {...base} serieAtrasados={[7, 9, 8, 12, 13, 11]} />)
    expect(screen.getByLabelText('Evolução mensal dos processos em atraso')).toBeTruthy()
  })

  it('oferece o caminho para o fluxo quando há atraso', () => {
    const ver = vi.fn()
    render(<KpiCards {...base} onVerAtrasados={ver} />)
    screen.getByRole('button', { name: 'Ver no fluxo' }).click()
    expect(ver).toHaveBeenCalled()
  })

  it('não oferece o caminho quando não há atraso nenhum', () => {
    render(<KpiCards {...base} atrasados={0} onVerAtrasados={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Ver no fluxo' })).toBeNull()
  })
})

describe('PrazoECiclo', () => {
  const faixas = agruparPorFaixaDePrazo(
    [
      { data_entrega: '2026-09-12', status_nome: 'Em andamento' },
      { data_entrega: '2026-09-01', status_nome: 'Em andamento' },
      { data_entrega: '2026-08-20', status_nome: 'Em andamento' },
      { data_entrega: '2026-06-01', status_nome: 'Em andamento' },
    ],
    HOJE,
  )

  it('descreve o gráfico de prazo em texto, para quem não enxerga a barra', () => {
    render(
      <PrazoECiclo faixas={faixas} leadTime={[]} faixaSelecionada={null} onSelecionarFaixa={vi.fn()} />,
    )
    const grafico = screen.getByLabelText(/Processos por faixa de prazo:/)
    expect(grafico.getAttribute('aria-label')).toContain('Atraso acima de 30 dias, 1')
  })

  it('diz claramente quando ainda não há cronograma concluído para medir ciclo', () => {
    render(
      <PrazoECiclo faixas={faixas} leadTime={[]} faixaSelecionada={null} onSelecionarFaixa={vi.fn()} />,
    )
    expect(screen.getByText('Sem atividades de cronograma concluídas')).toBeTruthy()
  })

  it('descreve o tempo por etapa com a meta declarada', () => {
    render(
      <PrazoECiclo
        faixas={faixas}
        leadTime={[{ fase: 'Instrução', dias: 22, amostra: 4 }]}
        faixaSelecionada={null}
        onSelecionarFaixa={vi.fn()}
      />,
    )
    const grafico = screen.getByLabelText(/Tempo médio por etapa/)
    expect(grafico.getAttribute('aria-label')).toContain('Instrução, 22')
    expect(grafico.getAttribute('aria-label')).toContain('Meta de 15 dias')
  })
})

describe('CargaETendencia', () => {
  it('anuncia a parcela em atraso de cada responsável', () => {
    render(
      <CargaETendencia
        porResponsavel={[{ nome: 'Bruno', total: 4, atrasados: 1 }, { nome: 'Ilma', total: 3, atrasados: 0 }]}
        concluidosPorMes={[{ chave: '2026-08', rotulo: 'Ago', total: 7 }]}
        responsavelSelecionado={null}
        onSelecionarResponsavel={vi.fn()}
      />,
    )
    const grafico = screen.getByLabelText(/Processos em andamento por responsável/)
    expect(grafico.getAttribute('aria-label')).toContain('Bruno, 4, sendo 1 em atraso')
    expect(grafico.getAttribute('aria-label')).toContain('Ilma, 3.')
  })

  it('declara de onde vem a data de conclusão em vez de deixar implícito', () => {
    render(
      <CargaETendencia
        porResponsavel={[]}
        concluidosPorMes={[{ chave: '2026-08', rotulo: 'Ago', total: 7 }]}
        responsavelSelecionado={null}
        onSelecionarResponsavel={vi.fn()}
      />,
    )
    expect(screen.getByText(/data da última atividade registrada/)).toBeTruthy()
  })
})

describe('FilterChips', () => {
  it('sem filtro, explica o que a tabela está mostrando', () => {
    render(<FilterChips chips={[]} onLimparTudo={vi.fn()} />)
    expect(screen.getByText(/Nenhum filtro ativo/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Limpar tudo' })).toBeNull()
  })

  it('cada filtro ativo vira um chip removível, com rótulo acessível', () => {
    const remover = vi.fn()
    render(
      <FilterChips
        chips={[{ chave: 'status', rotulo: 'Status: Em andamento', onRemove: remover }]}
        onLimparTudo={vi.fn()}
      />,
    )
    screen.getByRole('button', { name: 'Remover filtro Status: Em andamento' }).click()
    expect(remover).toHaveBeenCalled()
  })

  it('com filtro ativo, oferece limpar tudo de uma vez', () => {
    const limpar = vi.fn()
    render(
      <FilterChips chips={[{ chave: 'q', rotulo: 'Busca: "epi"', onRemove: vi.fn() }]} onLimparTudo={limpar} />,
    )
    screen.getByRole('button', { name: 'Limpar tudo' }).click()
    expect(limpar).toHaveBeenCalled()
  })
})
