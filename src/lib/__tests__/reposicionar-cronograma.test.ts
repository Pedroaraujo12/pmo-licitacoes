import { describe, it, expect } from 'vitest'
import {
  encontrarEtapaPorAtividade,
  planejarReposicionamento,
  deslocamentoDaEntrega,
  type EtapaDoCronograma,
} from '../reposicionar-cronograma'

const SEM_FERIADOS = new Set<string>()

const etapa = (
  ordem: number, descricao: string, dias = 5,
  status = 'nao_iniciado', data_inicio: string | null = null, data_fim: string | null = null,
): EtapaDoCronograma => ({ id: `e${ordem}`, ordem, descricao, status, dias_uteis: dias, data_inicio, data_fim })

/* Rito com a forma do real: etapas em ordem, as primeiras já cumpridas. */
const RITO: EtapaDoCronograma[] = [
  etapa(1, 'Analisar a Solicitação de Compras e anexos', 3, 'concluido', '2026-01-05', '2026-01-08'),
  etapa(2, 'Pesquisa de Preços', 5, 'concluido', '2026-01-09', '2026-01-15'),
  etapa(3, 'Emissão de Parecer jurídico (UJUR)', 10),
  etapa(4, 'Análise do Parecer emitido', 3),
  etapa(5, 'Assinatura do contrato', 2),
]

describe('encontrarEtapaPorAtividade', () => {
  it('casa pelo texto exato', () => {
    expect(encontrarEtapaPorAtividade(RITO, 'Pesquisa de Preços')?.ordem).toBe(2)
  })

  it('ignora acento, caixa e pontuação', () => {
    expect(encontrarEtapaPorAtividade(RITO, 'PESQUISA DE PRECOS')?.ordem).toBe(2)
    expect(encontrarEtapaPorAtividade(RITO, '  emissão de parecer jurídico (ujur)  ')?.ordem).toBe(3)
  })

  it('reconhece a mesma etapa escrita de outro jeito', () => {
    // é assim que o texto do rito antigo casa com o rito novo
    expect(encontrarEtapaPorAtividade(RITO, 'Parecer jurídico da UJUR emitido')?.ordem).toBe(3)
  })

  it('devolve null quando não dá para ter certeza — chutar erraria o processo todo', () => {
    expect(encontrarEtapaPorAtividade(RITO, 'Coffee break para 40 pessoas')).toBeNull()
    expect(encontrarEtapaPorAtividade(RITO, 'Concluído')).toBeNull()
  })

  it('campo vazio não casa com nada', () => {
    expect(encontrarEtapaPorAtividade(RITO, null)).toBeNull()
    expect(encontrarEtapaPorAtividade(RITO, '   ')).toBeNull()
  })
})

describe('planejarReposicionamento', () => {
  it('marca como cumpridas as etapas antes do alvo que ainda não estavam', () => {
    const p = planejarReposicionamento(RITO, 4, '2026-03-02', SEM_FERIADOS)!
    // 1 e 2 já estavam concluídas; 3 passa a concluída
    expect(p.concluir.map(c => c.ordem)).toEqual([3])
  })

  it('reprojeta do alvo em diante, em sequência e sem sobreposição', () => {
    const p = planejarReposicionamento(RITO, 3, '2026-03-02', SEM_FERIADOS)!
    expect(p.reprojetar.map(r => r.ordem)).toEqual([3, 4, 5])
    for (let i = 1; i < p.reprojetar.length; i++) {
      expect(p.reprojetar[i].data_inicio > p.reprojetar[i - 1].data_fim).toBe(true)
    }
  })

  it('não agenda etapa em fim de semana', () => {
    const p = planejarReposicionamento(RITO, 3, '2026-03-06', SEM_FERIADOS)! // sexta
    for (const r of p.reprojetar) {
      for (const iso of [r.data_inicio, r.data_fim]) {
        const [a, m, d] = iso.split('-').map(Number)
        const dia = new Date(a, m - 1, d).getDay()
        expect(dia).not.toBe(0)
        expect(dia).not.toBe(6)
      }
    }
  })

  it('respeita feriado cadastrado', () => {
    const feriados = new Set(['2026-03-03', '2026-03-04'])
    const p = planejarReposicionamento(RITO, 5, '2026-03-02', feriados)!
    expect(p.reprojetar[0].data_inicio).not.toBe('2026-03-03')
    expect(p.reprojetar[0].data_inicio).not.toBe('2026-03-04')
  })

  it('etapa já concluída depois do alvo mantém a data e só empurra a âncora', () => {
    const comConcluidaAdiante = [
      ...RITO.slice(0, 2),
      etapa(3, 'Emissão de Parecer jurídico (UJUR)', 10, 'concluido', '2026-02-01', '2026-02-10'),
      etapa(4, 'Análise do Parecer emitido', 3),
    ]
    const p = planejarReposicionamento(comConcluidaAdiante, 3, '2026-03-02', SEM_FERIADOS)!
    // a 3 não é reprojetada; a 4 começa depois do fim real dela
    expect(p.reprojetar.map(r => r.ordem)).toEqual([4])
    expect(p.reprojetar[0].data_inicio > '2026-02-10').toBe(true)
  })

  it('guarda as datas anteriores, para a tela mostrar o antes e o depois', () => {
    const comDatas = [etapa(1, 'Única', 4, 'nao_iniciado', '2026-01-01', '2026-01-06')]
    const p = planejarReposicionamento(comDatas, 1, '2026-05-04', SEM_FERIADOS)!
    expect(p.reprojetar[0].data_inicio_anterior).toBe('2026-01-01')
    expect(p.reprojetar[0].data_fim_anterior).toBe('2026-01-06')
    expect(p.reprojetar[0].data_inicio).not.toBe('2026-01-01')
  })

  it('a nova entrega é o fim da última etapa', () => {
    const p = planejarReposicionamento(RITO, 3, '2026-03-02', SEM_FERIADOS)!
    expect(p.novaDataEntrega).toBe(p.reprojetar[p.reprojetar.length - 1].data_fim)
  })

  it('etapa sem duração cadastrada ocupa um dia útil, não zero', () => {
    const semDias = [{ ...etapa(1, 'Sem duração'), dias_uteis: null }]
    const p = planejarReposicionamento(semDias, 1, '2026-03-02', SEM_FERIADOS)!
    expect(p.reprojetar[0].data_fim >= p.reprojetar[0].data_inicio).toBe(true)
  })

  it('ordem inexistente não produz plano', () => {
    expect(planejarReposicionamento(RITO, 99, '2026-03-02', SEM_FERIADOS)).toBeNull()
  })

  it('funciona com as etapas fora de ordem na consulta', () => {
    const embaralhado = [RITO[4], RITO[1], RITO[3], RITO[0], RITO[2]]
    const p = planejarReposicionamento(embaralhado, 3, '2026-03-02', SEM_FERIADOS)!
    expect(p.reprojetar.map(r => r.ordem)).toEqual([3, 4, 5])
  })
})

describe('deslocamentoDaEntrega', () => {
  it('conta os dias exatos entre a entrega antiga e a nova', () => {
    const p = planejarReposicionamento(RITO, 3, '2026-03-02', SEM_FERIADOS, '2026-03-20')!
    // o deslocamento e a diferenca em dias corridos entre as duas datas
    const dias = (a: string, b: string) =>
      Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000)
    expect(deslocamentoDaEntrega(p)).toBe(dias('2026-03-20', p.novaDataEntrega!))
  })

  it('entrega que atrasa da positivo; que antecipa, negativo', () => {
    const p = planejarReposicionamento(RITO, 3, '2026-03-02', SEM_FERIADOS)!
    const atrasa = { ...p, dataEntregaAnterior: '2026-01-01' }
    const antecipa = { ...p, dataEntregaAnterior: '2027-01-01' }
    expect(deslocamentoDaEntrega(atrasa)!).toBeGreaterThan(0)
    expect(deslocamentoDaEntrega(antecipa)!).toBeLessThan(0)
  })

  it('sem entrega anterior não há deslocamento a declarar', () => {
    const p = planejarReposicionamento(RITO, 3, '2026-03-02', SEM_FERIADOS, null)!
    expect(deslocamentoDaEntrega(p)).toBeNull()
  })
})
