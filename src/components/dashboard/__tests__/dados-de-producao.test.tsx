// @vitest-environment jsdom
/**
 * Trava o comportamento da tela contra os dados que estão de fato na base de
 * producao, lidos em 09/09/2026.
 *
 * A conferencia visual so alcanca o que couber na tela em que se olha. Estes
 * numeros e strings sao os reais — 74 processos, os nomes de etapa do
 * cronograma com ate 51 caracteres, o responsavel de nome mais longo — e
 * pegam a classe de defeito que dado sintetico esconde: rotulo que estoura a
 * calha do eixo, faixa que nao fecha com o total, status sem cor mapeada.
 *
 * Se a carteira mudar a ponto de quebrar um destes, o numero aqui e que esta
 * velho; conferir no banco antes de ajustar.
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import StatusCards, { type StatusValue } from '../status-cards'
import PrazoECiclo from '../prazo-e-ciclo'
import CargaETendencia from '../carga-e-tendencia'
import { corDoStatus, COR_STATUS_PADRAO } from '@/lib/dashboard-tokens'
import {
  agruparPorFaixaDePrazo,
  calcularTaxaHomologacao,
  calcularEconomiaPercentual,
  type LeadTimeEtapa,
} from '@/lib/dashboard-metrics'

afterEach(cleanup)

/* --- Retrato da base em 09/09/2026 ------------------------------------- */

const STATUS_REAIS: StatusValue[] = [
  { status: 'Em andamento', total: 25, valor_estimado: 25408559.49, valor_homologado: 19877885.70 },
  { status: 'Concluído', total: 24, valor_estimado: 19969928.17, valor_homologado: 19252876.21 },
  { status: 'Não recebido', total: 18, valor_estimado: 0, valor_homologado: 0 },
  { status: 'Devolvido', total: 4, valor_estimado: 1730154.08, valor_homologado: 0 },
  { status: 'Cancelado', total: 3, valor_estimado: 7151618.83, valor_homologado: 221712.00 },
]

const TOTAL_PROCESSOS = 74
const ESTIMADO_TOTAL = 54260260.57
const HOMOLOGADO_TOTAL = 39352473.91
const ECONOMIA = 717051.96

/** Contagens por faixa apuradas em SQL sobre processos + status_processo. */
const FAIXAS_ESPERADAS = { vencendo: 4, atraso_1_15: 2, atraso_16_30: 2, atraso_acima_30: 7 }
const ATRASADOS_RPC = 11 // get_dashboard_summary.processos_atrasados

/** Etapas com pelo menos cinco conclusoes, da mais lenta para a mais rapida. */
const LEAD_TIME_REAL: LeadTimeEtapa[] = [
  { etapa: 'Fase de Julgamento das Propostas', dias: 11, amostra: 5 },
  { etapa: 'Publicação do Edital (8D - Aquisição/10D - Serviço)', dias: 11, amostra: 5 },
  { etapa: 'Emissão de Parecer jurídico (UJUR)', dias: 9, amostra: 14 },
  { etapa: 'Análise Jurídica', dias: 7, amostra: 5 },
  { etapa: 'Elaboração de Minuta/Edital/Anexos', dias: 6, amostra: 6 },
  { etapa: 'Pesquisa de Preços', dias: 6, amostra: 6 },
]

const CARGA_REAL = [
  { nome: 'Bruno', total: 4, atrasados: 1 },
  { nome: 'Karla Oliveira', total: 3, atrasados: 1 }, // o nome mais longo em uso
  { nome: 'Guilherme', total: 3, atrasados: 0 },
  { nome: 'Thiago', total: 3, atrasados: 1 },
  { nome: 'Ilma', total: 3, atrasados: 0 },
]

/* --- Invariantes dos dados --------------------------------------------- */

describe('a base real bate com o que a tela afirma', () => {
  it('as faixas de atraso somam exatamente o atrasados da RPC', () => {
    const soma = FAIXAS_ESPERADAS.atraso_1_15 + FAIXAS_ESPERADAS.atraso_16_30 + FAIXAS_ESPERADAS.atraso_acima_30
    expect(soma).toBe(ATRASADOS_RPC)
  })

  it('a classificacao local reproduz as faixas apuradas no banco', () => {
    const hoje = new Date(2026, 8, 9)
    const emDias = (n: number) => {
      const d = new Date(2026, 8, 9 + n)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    const processos = [
      ...Array.from({ length: 4 }, () => ({ data_entrega: emDias(3), status_nome: 'Em andamento' })),
      ...Array.from({ length: 2 }, () => ({ data_entrega: emDias(-8), status_nome: 'Em andamento' })),
      ...Array.from({ length: 2 }, () => ({ data_entrega: emDias(-20), status_nome: 'Em andamento' })),
      ...Array.from({ length: 7 }, () => ({ data_entrega: emDias(-60), status_nome: 'Em andamento' })),
    ]
    const porFaixa = Object.fromEntries(agruparPorFaixaDePrazo(processos, hoje).map(f => [f.faixa, f.total]))
    expect(porFaixa).toMatchObject(FAIXAS_ESPERADAS)
  })

  it('os status em uso tem cor propria — nenhum cai no cinza de "nao mapeado"', () => {
    // "Nao recebido" e cinza de proposito: nada aconteceu com ele ainda.
    const semCorPropria = STATUS_REAIS
      .filter(s => s.status !== 'Não recebido')
      .filter(s => corDoStatus(s.status) === COR_STATUS_PADRAO)
      .map(s => s.status)
    expect(semCorPropria).toEqual([])

    // e as cores nao se repetem entre status: cada um le como um estado
    const cores = STATUS_REAIS.map(s => corDoStatus(s.status))
    expect(new Set(cores).size).toBe(STATUS_REAIS.length)
  })

  it('a soma dos status fecha com o total da carteira', () => {
    expect(STATUS_REAIS.reduce((s, x) => s + x.total, 0)).toBe(TOTAL_PROCESSOS)
    const estimado = STATUS_REAIS.reduce((s, x) => s + x.valor_estimado, 0)
    expect(estimado).toBeCloseTo(ESTIMADO_TOTAL, 2)
  })

  it('taxa de homologacao e economia batem com os valores da carteira', () => {
    expect(calcularTaxaHomologacao(ESTIMADO_TOTAL, HOMOLOGADO_TOTAL)).toBeCloseTo(72.5, 1)
    const estimadoConcluidos = STATUS_REAIS.find(s => s.status === 'Concluído')!.valor_estimado
    expect(calcularEconomiaPercentual(ECONOMIA, estimadoConcluidos)).toBeCloseTo(3.6, 1)
  })
})

/* --- Renderizacao com as strings reais --------------------------------- */

describe('a tela aguenta as strings reais', () => {
  it('o nome de etapa mais longo da base nao estoura a calha do eixo', () => {
    render(
      <PrazoECiclo
        faixas={agruparPorFaixaDePrazo([], new Date(2026, 8, 9))}
        leadTime={LEAD_TIME_REAL}
        faixaSelecionada={null}
        onSelecionarFaixa={vi.fn()}
        atividades={[]}
        atividadeSelecionada={null}
        onSelecionarAtividade={vi.fn()}
      />,
    )
    const maisLongo = LEAD_TIME_REAL.reduce((a, b) => (a.etapa.length >= b.etapa.length ? a : b))
    expect(maisLongo.etapa.length).toBe(51)

    // na calha entra a versao curta, com reticencia
    const rotulos = [...document.querySelectorAll('svg[aria-label*="Tempo médio"] text')]
      .map(t => t.textContent || '')
    const rotuloDaEtapa = rotulos.find(r => r.startsWith('Publicação do Edital'))
    expect(rotuloDaEtapa).toBeTruthy()
    expect(rotuloDaEtapa!.endsWith('…')).toBe(true)
    // o corte acompanha a largura da calha, nao um numero fixo de caracteres
    expect(rotuloDaEtapa!.length).toBeLessThan(maisLongo.etapa.length)

    // e o nome inteiro segue disponivel para leitura por voz
    const aria = document.querySelector('svg[aria-label*="Tempo médio"]')!.getAttribute('aria-label')!
    expect(aria).toContain('Publicação do Edital (8D - Aquisição/10D - Serviço), 11')
  })

  it('nenhum rotulo de etapa curta e truncado a toa', () => {
    render(
      <PrazoECiclo
        faixas={agruparPorFaixaDePrazo([], new Date(2026, 8, 9))}
        leadTime={LEAD_TIME_REAL}
        faixaSelecionada={null}
        onSelecionarFaixa={vi.fn()}
        atividades={[]}
        atividadeSelecionada={null}
        onSelecionarAtividade={vi.fn()}
      />,
    )
    const rotulos = [...document.querySelectorAll('svg[aria-label*="Tempo médio"] text')]
      .map(t => t.textContent || '')
    expect(rotulos).toContain('Análise Jurídica')
    expect(rotulos).toContain('Pesquisa de Preços')
  })

  it('o eixo do tempo por etapa acompanha o maximo real, nao uma meta inventada', () => {
    render(
      <PrazoECiclo
        faixas={agruparPorFaixaDePrazo([], new Date(2026, 8, 9))}
        leadTime={LEAD_TIME_REAL}
        faixaSelecionada={null}
        onSelecionarFaixa={vi.fn()}
        atividades={[]}
        atividadeSelecionada={null}
        onSelecionarAtividade={vi.fn()}
      />,
    )
    const marcas = [...document.querySelectorAll('svg[aria-label*="Tempo médio"] text')]
      .map(t => t.textContent || '')
      .filter(t => /^\d+$/.test(t))
      .map(Number)
    expect(Math.max(...marcas)).toBeLessThanOrEqual(11) // maximo real, nao 15
    expect(document.body.textContent).not.toContain('Meta de')
  })

  it('o responsavel de nome mais longo aparece inteiro', () => {
    render(
      <CargaETendencia
        porResponsavel={CARGA_REAL}
        concluidosPorMes={[
          { chave: '2026-04', rotulo: 'Abr', total: 3 },
          { chave: '2026-05', rotulo: 'Mai', total: 4 },
          { chave: '2026-06', rotulo: 'Jun', total: 3 },
          { chave: '2026-07', rotulo: 'Jul', total: 0 },
          { chave: '2026-08', rotulo: 'Ago', total: 1 },
          { chave: '2026-09', rotulo: 'Set', total: 0 },
        ]}
        concluidosComData={15}
        concluidosTotal={24}
        responsavelSelecionado={null}
        onSelecionarResponsavel={vi.fn()}
      />,
    )
    const rotulos = [...document.querySelectorAll('svg[aria-label*="responsável"] text')]
      .map(t => t.textContent || '')
    expect(rotulos).toContain('Karla Oliveira')
  })

  it('a tendencia admite a cobertura parcial em vez de parecer mais rasa do que e', () => {
    render(
      <CargaETendencia
        porResponsavel={CARGA_REAL}
        concluidosPorMes={[{ chave: '2026-08', rotulo: 'Ago', total: 1 }]}
        concluidosComData={15}
        concluidosTotal={24}
        responsavelSelecionado={null}
        onSelecionarResponsavel={vi.fn()}
      />,
    )
    expect(screen.getByText(/15 de 24 concluídos têm cronograma registrado/)).toBeTruthy()
  })

  it('os 18 processos sem estimativa nao viram R$ 0,00 na carteira', () => {
    render(
      <StatusCards
        porStatus={STATUS_REAIS}
        totalEstimado={ESTIMADO_TOTAL}
        totalHomologado={HOMOLOGADO_TOTAL}
        totalProcessos={TOTAL_PROCESSOS}
        economia={ECONOMIA}
        taxaHomologacao={calcularTaxaHomologacao(ESTIMADO_TOTAL, HOMOLOGADO_TOTAL)}
        selected={null}
        onSelect={vi.fn()}
      />,
    )
    const naoRecebido = screen.getAllByRole('button').find(b => /Não recebido/.test(b.textContent || ''))!
    expect(naoRecebido.textContent).toContain('18')
    expect(naoRecebido.textContent).toContain('não informado')
    expect(naoRecebido.textContent).not.toContain('R$ 0,00')

    // Devolvido tem estimativa de R$ 1,7 mi e homologado realmente zerado
    const devolvido = screen.getAllByRole('button').find(b => /Devolvido/.test(b.textContent || ''))!
    expect(devolvido.textContent).toContain('R$ 0,00')
  })

  it('a equipe cresceu alem do limite antigo e ninguem pode sumir por isso', () => {
    // 17 responsaveis cadastrados, 11 com processo em andamento — o codigo
    // cortava em 10 e o 11o (Isaias) desaparecia do grafico sem aviso
    const equipe = ['Bruno', 'Guilherme', 'Thiago', 'Alice Camargo', 'Hugo',
                    'Karla Oliveira', 'Rebeca', 'Renan', 'Bárbara', 'Ilma', 'Isaias']
    render(
      <CargaETendencia
        porResponsavel={equipe.map((nome, i) => ({ nome, total: i < 3 ? 3 : i < 8 ? 2 : 1, atrasados: 0 }))}
        concluidosPorMes={[{ chave: '2026-08', rotulo: 'Ago', total: 1 }]}
        concluidosComData={16}
        concluidosTotal={26}
        responsavelSelecionado={null}
        onSelecionarResponsavel={vi.fn()}
      />,
    )
    const aria = document.querySelector('svg[aria-label*="responsável"]')!.getAttribute('aria-label')!
    for (const nome of equipe) expect(aria).toContain(nome)
    expect(screen.getByText(/11 responsáveis/)).toBeTruthy()
    expect(screen.queryByText(/fora do gráfico/)).toBeNull()
  })

  it('a participacao de cada status na carteira soma 100%', () => {
    const somaPct = STATUS_REAIS.reduce((s, x) => s + (x.valor_estimado / ESTIMADO_TOTAL) * 100, 0)
    expect(somaPct).toBeCloseTo(100, 6)
  })
})
