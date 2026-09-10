import { describe, it, expect } from 'vitest'
import {
  parseDateOnly,
  diasAteEntrega,
  isStatusTerminal,
  isStatusConcluido,
  classificarPrazo,
  agruparPorFaixaDePrazo,
  calcularTaxaHomologacao,
  calcularEconomiaPercentual,
  agruparConcluidosPorMes,
  calcularLeadTimePorEtapa,
  mapearConclusaoPorCronograma,
  agruparCargaPorResponsavel,
  rotuloPrazo,
  FAIXAS_PRAZO,
  combinaFiltroPrazo,
  ROTULO_FILTRO_PRAZO,
} from '../dashboard-metrics'

const HOJE = new Date(2026, 8, 9) // 09/09/2026

describe('parseDateOnly', () => {
  it('lê YYYY-MM-DD no fuso local, sem escorregar um dia', () => {
    const d = parseDateOnly('2026-09-09')
    expect(d?.getFullYear()).toBe(2026)
    expect(d?.getMonth()).toBe(8)
    expect(d?.getDate()).toBe(9)
  })

  it('aceita timestamp ISO e usa só a parte da data', () => {
    const d = parseDateOnly('2026-01-31T23:45:00Z')
    expect(d?.getMonth()).toBe(0)
    expect(d?.getDate()).toBe(31)
  })

  it('devolve null para vazio, nulo e formato inesperado', () => {
    expect(parseDateOnly(null)).toBeNull()
    expect(parseDateOnly('')).toBeNull()
    expect(parseDateOnly('09/09/2026')).toBeNull()
  })
})

describe('diasAteEntrega', () => {
  it('conta zero quando a entrega é hoje', () => {
    expect(diasAteEntrega('2026-09-09', HOJE)).toBe(0)
  })

  it('conta positivo para o futuro e negativo para o passado', () => {
    expect(diasAteEntrega('2026-09-16', HOJE)).toBe(7)
    expect(diasAteEntrega('2026-09-02', HOJE)).toBe(-7)
  })

  it('atravessa a virada de mês sem erro', () => {
    expect(diasAteEntrega('2026-10-09', HOJE)).toBe(30)
    expect(diasAteEntrega('2026-08-09', HOJE)).toBe(-31)
  })

  it('devolve null sem data de entrega', () => {
    expect(diasAteEntrega(null, HOJE)).toBeNull()
  })
})

describe('status', () => {
  it('reconhece os cinco status terminais do get_dashboard_summary', () => {
    for (const s of ['Concluído', 'Homologado', 'Cancelado', 'Devolvido', 'Suspenso']) {
      expect(isStatusTerminal(s)).toBe(true)
    }
  })

  it('não trata "Em andamento" nem "Não recebido" como terminais', () => {
    expect(isStatusTerminal('Em andamento')).toBe(false)
    expect(isStatusTerminal('Não recebido')).toBe(false)
    expect(isStatusTerminal(null)).toBe(false)
  })

  it('ignora espaços em volta do nome', () => {
    expect(isStatusTerminal('  Concluído  ')).toBe(true)
  })

  it('separa concluído de apenas terminal', () => {
    expect(isStatusConcluido('Concluído')).toBe(true)
    expect(isStatusConcluido('Homologado')).toBe(true)
    expect(isStatusConcluido('Cancelado')).toBe(false)
  })
})

describe('classificarPrazo', () => {
  it('não atrasa processo com status terminal, mesmo com entrega vencida', () => {
    expect(classificarPrazo({ data_entrega: '2025-01-01', status_nome: 'Concluído' }, HOJE)).toBe('encerrado')
    expect(classificarPrazo({ data_entrega: '2025-01-01', status_nome: 'Cancelado' }, HOJE)).toBe('encerrado')
  })

  it('separa as três faixas de atraso nos limites exatos', () => {
    const st = 'Em andamento'
    expect(classificarPrazo({ data_entrega: '2026-09-08', status_nome: st }, HOJE)).toBe('atraso_1_15')
    expect(classificarPrazo({ data_entrega: '2026-08-25', status_nome: st }, HOJE)).toBe('atraso_1_15') // 15 dias
    expect(classificarPrazo({ data_entrega: '2026-08-24', status_nome: st }, HOJE)).toBe('atraso_16_30') // 16 dias
    expect(classificarPrazo({ data_entrega: '2026-08-10', status_nome: st }, HOJE)).toBe('atraso_16_30') // 30 dias
    expect(classificarPrazo({ data_entrega: '2026-08-09', status_nome: st }, HOJE)).toBe('atraso_acima_30') // 31 dias
  })

  it('marca como vencendo de hoje até o sétimo dia', () => {
    const st = 'Em andamento'
    expect(classificarPrazo({ data_entrega: '2026-09-09', status_nome: st }, HOJE)).toBe('vencendo')
    expect(classificarPrazo({ data_entrega: '2026-09-16', status_nome: st }, HOJE)).toBe('vencendo')
    expect(classificarPrazo({ data_entrega: '2026-09-17', status_nome: st }, HOJE)).toBe('no_prazo')
  })

  it('separa ausência de prazo de prazo em dia', () => {
    expect(classificarPrazo({ data_entrega: null, status_nome: 'Em andamento' }, HOJE)).toBe('sem_prazo')
  })
})

describe('agruparPorFaixaDePrazo', () => {
  it('devolve sempre as quatro faixas, na ordem do gráfico', () => {
    const r = agruparPorFaixaDePrazo([], HOJE)
    expect(r).toHaveLength(4)
    expect(r.map(f => f.faixa)).toEqual(FAIXAS_PRAZO.map(f => f.faixa))
    expect(r.every(f => f.total === 0)).toBe(true)
  })

  it('conta cada processo em uma única faixa', () => {
    const processos = [
      { data_entrega: '2026-09-12', status_nome: 'Em andamento' }, // vencendo
      { data_entrega: '2026-09-01', status_nome: 'Em andamento' }, // atraso 8d
      { data_entrega: '2026-08-20', status_nome: 'Em andamento' }, // atraso 20d
      { data_entrega: '2026-07-01', status_nome: 'Em andamento' }, // atraso 70d
      { data_entrega: '2026-07-01', status_nome: 'Concluído' },    // encerrado, fora
      { data_entrega: null, status_nome: 'Não recebido' },         // sem prazo, fora
      { data_entrega: '2026-12-01', status_nome: 'Em andamento' }, // no prazo, fora
    ]
    const r = agruparPorFaixaDePrazo(processos, HOJE)
    const porFaixa = Object.fromEntries(r.map(f => [f.faixa, f.total]))
    expect(porFaixa).toEqual({
      vencendo: 1,
      atraso_1_15: 1,
      atraso_16_30: 1,
      atraso_acima_30: 1,
    })
  })

  it('o total das faixas de atraso bate com a contagem de atrasados', () => {
    const processos = Array.from({ length: 11 }, (_, i) => ({
      data_entrega: `2026-08-${String(10 + i).padStart(2, '0')}`,
      status_nome: 'Em andamento',
    }))
    const atrasados = agruparPorFaixaDePrazo(processos, HOJE)
      .filter(f => f.atrasada)
      .reduce((s, f) => s + f.total, 0)
    expect(atrasados).toBe(11)
  })
})

describe('combinaFiltroPrazo', () => {
  it('sem filtro, tudo passa', () => {
    expect(combinaFiltroPrazo('no_prazo', null)).toBe(true)
    expect(combinaFiltroPrazo('encerrado', null)).toBe(true)
  })

  it('"atrasados" cobre as três faixas de atraso e só elas', () => {
    expect(combinaFiltroPrazo('atraso_1_15', 'atrasados')).toBe(true)
    expect(combinaFiltroPrazo('atraso_16_30', 'atrasados')).toBe(true)
    expect(combinaFiltroPrazo('atraso_acima_30', 'atrasados')).toBe(true)
    expect(combinaFiltroPrazo('vencendo', 'atrasados')).toBe(false)
    expect(combinaFiltroPrazo('no_prazo', 'atrasados')).toBe(false)
    expect(combinaFiltroPrazo('encerrado', 'atrasados')).toBe(false)
  })

  it('uma faixa específica casa só com ela', () => {
    expect(combinaFiltroPrazo('atraso_1_15', 'atraso_1_15')).toBe(true)
    expect(combinaFiltroPrazo('atraso_16_30', 'atraso_1_15')).toBe(false)
  })

  it('todo filtro exposto na interface tem rótulo', () => {
    for (const chave of ['atrasados', 'no_prazo', 'sem_prazo', ...FAIXAS_PRAZO.map(f => f.faixa)]) {
      expect(ROTULO_FILTRO_PRAZO[chave]).toBeTruthy()
    }
  })
})

describe('percentuais', () => {
  it('calcula a taxa de homologação da carteira real', () => {
    expect(calcularTaxaHomologacao(54260260.57, 39352473.91)).toBeCloseTo(72.52, 1)
  })

  it('devolve zero em vez de dividir por zero', () => {
    expect(calcularTaxaHomologacao(0, 100)).toBe(0)
    expect(calcularEconomiaPercentual(100, 0)).toBe(0)
  })

  it('mede economia contra o estimado dos concluídos, não contra a carteira', () => {
    expect(calcularEconomiaPercentual(717051.96, 19969928.17)).toBeCloseTo(3.59, 1)
  })
})

describe('agruparConcluidosPorMes', () => {
  it('devolve a janela pedida, do mais antigo ao mês corrente', () => {
    const r = agruparConcluidosPorMes([], HOJE, 6)
    expect(r).toHaveLength(6)
    expect(r[0].chave).toBe('2026-04')
    expect(r[5].chave).toBe('2026-09')
    expect(r[5].rotulo).toBe('Set')
  })

  it('mantém meses sem conclusão com zero, sem buraco na série', () => {
    const r = agruparConcluidosPorMes(
      [{ status_nome: 'Concluído', data_conclusao: '2026-09-02' }],
      HOJE,
      6,
    )
    expect(r.map(p => p.total)).toEqual([0, 0, 0, 0, 0, 1])
  })

  it('conta só status concluído e ignora o que cai fora da janela', () => {
    const r = agruparConcluidosPorMes(
      [
        { status_nome: 'Concluído', data_conclusao: '2026-08-15' },
        { status_nome: 'Homologado', data_conclusao: '2026-08-20' },
        { status_nome: 'Em andamento', data_conclusao: '2026-08-21' },
        { status_nome: 'Concluído', data_conclusao: '2025-01-10' },
        { status_nome: 'Concluído', data_conclusao: null },
      ],
      HOJE,
      6,
    )
    const agosto = r.find(p => p.chave === '2026-08')
    expect(agosto?.total).toBe(2)
    expect(r.reduce((s, p) => s + p.total, 0)).toBe(2)
  })

  it('atravessa a virada de ano', () => {
    const r = agruparConcluidosPorMes([], new Date(2026, 1, 15), 4)
    expect(r.map(p => p.chave)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })
})

describe('calcularLeadTimePorEtapa', () => {
  const base = { status: 'concluido' as const, fase: 'Execução' }
  const rep = (n: number, etapa: string, dias: number) =>
    Array.from({ length: n }, () => ({
      ...base, descricao: etapa,
      data_inicio: '2026-01-01',
      data_fim: `2026-01-${String(1 + dias).padStart(2, '0')}`,
    }))

  it('mede por etapa, não por fase — agrupado por fase o número achata', () => {
    const r = calcularLeadTimePorEtapa([...rep(5, 'Parecer jurídico', 9), ...rep(5, 'Publicação no site', 0)])
    expect(r.map(x => x.etapa)).toEqual(['Parecer jurídico', 'Publicação no site'])
    expect(r[0].dias).toBe(9)
    expect(r[1].dias).toBe(0)
  })

  it('exige amostra mínima: média de duas ocorrências não é tempo médio', () => {
    expect(calcularLeadTimePorEtapa(rep(4, 'Rara', 30))).toEqual([])
    expect(calcularLeadTimePorEtapa(rep(5, 'Rara', 30))).toHaveLength(1)
  })

  it('ordena da mais lenta para a mais rápida e desempata pela amostra', () => {
    const r = calcularLeadTimePorEtapa([
      ...rep(5, 'Lenta', 11), ...rep(9, 'Empatada A', 6), ...rep(5, 'Empatada B', 6),
    ])
    expect(r.map(x => x.etapa)).toEqual(['Lenta', 'Empatada A', 'Empatada B'])
  })

  it('respeita o limite de etapas mostradas', () => {
    const muitas = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].flatMap((e, i) => rep(5, e, 10 - i))
    expect(calcularLeadTimePorEtapa(muitas)).toHaveLength(6)
  })

  it('ignora atividade não concluída, sem datas ou com fim antes do início', () => {
    expect(calcularLeadTimePorEtapa([
      ...rep(5, 'ok', 3).map(a => ({ ...a, status: 'em_andamento' })),
      ...rep(5, 'sem data', 3).map(a => ({ ...a, data_inicio: null })),
      ...rep(5, 'invertida', 3).map(a => ({ ...a, data_fim: '2025-01-01' })),
    ])).toEqual([])
  })

  it('cai para a fase quando a etapa está vazia', () => {
    const r = calcularLeadTimePorEtapa(rep(5, '', 4).map(a => ({ ...a, descricao: '', fase: 'Instrução' })))
    expect(r[0].etapa).toBe('Instrução')
  })
})

describe('mapearConclusaoPorCronograma', () => {
  const at = (processo_id: string, data_fim: string | null, status = 'concluido') =>
    ({ processo_id, data_fim, status, fase: null, descricao: null, data_inicio: '2026-01-01' })

  it('usa o fim da última etapa concluída de cada processo', () => {
    const m = mapearConclusaoPorCronograma([
      at('p1', '2026-03-10'), at('p1', '2026-07-22'), at('p1', '2026-05-01'),
      at('p2', '2026-02-01'),
    ])
    expect(m.get('p1')).toBe('2026-07-22')
    expect(m.get('p2')).toBe('2026-02-01')
  })

  it('ignora etapa não concluída ou sem data de fim', () => {
    const m = mapearConclusaoPorCronograma([
      at('p1', '2026-09-01', 'em_andamento'),
      at('p1', null),
      at('p2', '2026-01-05'),
    ])
    expect(m.has('p1')).toBe(false)
    expect(m.get('p2')).toBe('2026-01-05')
  })

  it('processo sem cronograma simplesmente não aparece no mapa', () => {
    expect(mapearConclusaoPorCronograma([]).size).toBe(0)
  })
})

describe('agruparCargaPorResponsavel', () => {
  it('conta só processos em andamento e destaca a parcela atrasada', () => {
    const r = agruparCargaPorResponsavel([
      { responsavel_nome: 'Bruno', status_nome: 'Em andamento', data_entrega: '2026-08-01' }, // atrasado
      { responsavel_nome: 'Bruno', status_nome: 'Em andamento', data_entrega: '2026-12-01' },
      { responsavel_nome: 'Ilma', status_nome: 'Em andamento', data_entrega: '2026-12-01' },
      { responsavel_nome: 'Ilma', status_nome: 'Concluído', data_entrega: '2026-01-01' }, // fora
    ], HOJE)
    expect(r).toEqual([
      { nome: 'Bruno', total: 2, atrasados: 1 },
      { nome: 'Ilma', total: 1, atrasados: 0 },
    ])
  })

  it('agrupa quem está sem responsável sob um rótulo único', () => {
    const r = agruparCargaPorResponsavel([
      { responsavel_nome: null, status_nome: 'Em andamento', data_entrega: null },
      { responsavel_nome: '   ', status_nome: 'Em andamento', data_entrega: null },
    ], HOJE)
    expect(r).toEqual([{ nome: 'Sem responsável', total: 2, atrasados: 0 }])
  })

  it('desempata por nome, em ordem do português', () => {
    const r = agruparCargaPorResponsavel([
      { responsavel_nome: 'Zeca', status_nome: 'Em andamento', data_entrega: null },
      { responsavel_nome: 'Ana', status_nome: 'Em andamento', data_entrega: null },
      { responsavel_nome: 'Ávila', status_nome: 'Em andamento', data_entrega: null },
    ], HOJE)
    expect(r.map(x => x.nome)).toEqual(['Ana', 'Ávila', 'Zeca'])
  })

  it('não esconde ninguém: o 11º responsável da equipe continua na lista', () => {
    // um responsavel novo entra com um processo so e cai no fim da ordenacao;
    // com o limite de 10 que existia aqui, ele sumia sem aviso
    const equipe = ['Bruno', 'Guilherme', 'Thiago', 'Alice Camargo', 'Hugo',
                    'Karla Oliveira', 'Rebeca', 'Renan', 'Bárbara', 'Ilma', 'Isaias']
    const processos = equipe.map(nome => ({
      responsavel_nome: nome, status_nome: 'Em andamento', data_entrega: null,
    }))
    const r = agruparCargaPorResponsavel(processos, HOJE)
    expect(r).toHaveLength(11)
    expect(r.map(x => x.nome)).toContain('Isaias')
  })
})

describe('rotuloPrazo', () => {
  it('descreve atraso, vencimento e folga com o tom certo', () => {
    expect(rotuloPrazo({ data_entrega: '2026-09-08', status_nome: 'Em andamento' }, HOJE))
      .toEqual({ texto: '1 dia de atraso', tom: 'atraso' })
    expect(rotuloPrazo({ data_entrega: '2026-09-04', status_nome: 'Em andamento' }, HOJE))
      .toEqual({ texto: '5 dias de atraso', tom: 'atraso' })
    expect(rotuloPrazo({ data_entrega: '2026-09-09', status_nome: 'Em andamento' }, HOJE))
      .toEqual({ texto: 'vence hoje', tom: 'alerta' })
    expect(rotuloPrazo({ data_entrega: '2026-09-10', status_nome: 'Em andamento' }, HOJE))
      .toEqual({ texto: 'vence em 1 dia', tom: 'alerta' })
    expect(rotuloPrazo({ data_entrega: '2026-12-01', status_nome: 'Em andamento' }, HOJE))
      .toEqual({ texto: '83 dias restantes', tom: 'neutro' })
  })

  it('não cobra prazo de processo encerrado nem inventa prazo inexistente', () => {
    expect(rotuloPrazo({ data_entrega: '2020-01-01', status_nome: 'Concluído' }, HOJE).texto).toBe('—')
    expect(rotuloPrazo({ data_entrega: null, status_nome: 'Em andamento' }, HOJE).texto).toBe('sem prazo')
  })
})
