import { describe, it, expect } from 'vitest'
import { normalizar, pontuarSemelhanca, casarEtapas, ritoDivergente } from '../aplicar-rito'
import type { EtapaModelo } from '../simulador-cronograma'
import type { CronogramaAtividade } from '@/types/database'

function atividade(over: Partial<CronogramaAtividade>): CronogramaAtividade {
  return {
    id: 'a1', processo_id: 'p1', ordem: 1, descricao: '', fase: 'Análise',
    setor: 'UAC', dias_uteis: 1, data_inicio: null, data_fim: null,
    data_inicio_real: null, data_fim_real: null, status: 'nao_iniciado',
    responsavel_id: null, observacao: null,
    ...over,
  } as CronogramaAtividade
}

const MODELO: EtapaModelo[] = [
  { ordem: 1, fase: 'Planejamento', descricao: 'Analisar a Solicitação de Compras e anexos', setor: 'UAC', duracao_dias_uteis: 3 },
  { ordem: 2, fase: 'Análise', descricao: 'Emissão de Parecer jurídico (UJUR)', setor: 'UJUR', duracao_dias_uteis: 7 },
]

describe('normalizar', () => {
  it('remove acentos, pontuação e caixa', () => {
    expect(normalizar('Análise Jurídica — Emissão!')).toBe('analise juridica emissao')
  })
})

describe('pontuarSemelhanca', () => {
  it('reconhece a mesma etapa escrita de formas diferentes', () => {
    const score = pontuarSemelhanca(
      'Análise jurídica e Emissão de Parecer',
      'Emissão de Parecer jurídico (UJUR)',
    )
    expect(score).toBeGreaterThanOrEqual(2)
  })

  it('não confunde etapas distintas', () => {
    const score = pontuarSemelhanca(
      'Abertura e Fase de Lances',
      'Confeccionar o Mapa de Preço',
    )
    expect(score).toBeLessThan(2)
  })

  it('ignora palavras vazias', () => {
    expect(pontuarSemelhanca('de da do e em', 'de da do e em')).toBe(0)
  })
})

describe('casarEtapas', () => {
  it('transporta status e datas reais da etapa equivalente', () => {
    const antigas = [
      atividade({ id: 'x1', ordem: 1, descricao: 'Análise da Solicitação de Compras', status: 'concluido', data_fim_real: '2026-08-12' }),
      atividade({ id: 'x2', ordem: 2, descricao: 'Análise jurídica e Emissão de Parecer', status: 'em_andamento' }),
    ]
    const heranca = casarEtapas(MODELO, antigas)

    expect(heranca.get(1)?.status).toBe('concluido')
    expect(heranca.get(1)?.data_fim_real).toBe('2026-08-12')
    expect(heranca.get(2)?.status).toBe('em_andamento')
  })

  it('não reaproveita a mesma etapa antiga duas vezes', () => {
    const antigas = [
      atividade({ id: 'x1', ordem: 1, descricao: 'Análise jurídica e Emissão de Parecer', status: 'concluido' }),
    ]
    const heranca = casarEtapas(MODELO, antigas)
    const usos = [...heranca.values()].length
    expect(usos).toBeLessThanOrEqual(1)
  })

  it('etapa sem correspondente fica de fora', () => {
    const antigas = [atividade({ id: 'x1', ordem: 1, descricao: 'Abertura e Fase de Lances', status: 'concluido' })]
    const heranca = casarEtapas(MODELO, antigas)
    expect(heranca.has(1)).toBe(false)
  })

  it('status fora do esperado vira nao_iniciado', () => {
    // O tipo restringe a três valores, mas o banco é a fonte real — um status
    // desconhecido não pode ser transportado como se fosse trabalho concluído.
    const statusInvalido = 'pausado' as unknown as CronogramaAtividade['status']
    const antigas = [atividade({ id: 'x1', ordem: 1, descricao: 'Analisar a Solicitação de Compras e anexos', status: statusInvalido })]
    const heranca = casarEtapas(MODELO, antigas)
    expect(heranca.get(1)?.status).toBe('nao_iniciado')
  })
})

describe('ritoDivergente', () => {
  it('detecta quantidade diferente de etapas', () => {
    const atividades = [atividade({ ordem: 1, descricao: 'Analisar a Solicitação de Compras e anexos' })]
    expect(ritoDivergente(atividades, MODELO)).toBe(true)
  })

  it('detecta descrições diferentes com a mesma contagem', () => {
    const atividades = [
      atividade({ id: 'a', ordem: 1, descricao: 'Análise do Termo de Referência e anexos' }),
      atividade({ id: 'b', ordem: 2, descricao: 'Abertura e Fase de Lances' }),
    ]
    expect(ritoDivergente(atividades, MODELO)).toBe(true)
  })

  it('não acusa divergência quando o rito já corresponde', () => {
    const atividades = MODELO.map((e, i) =>
      atividade({ id: `a${i}`, ordem: e.ordem, descricao: e.descricao }))
    expect(ritoDivergente(atividades, MODELO)).toBe(false)
  })

  it('modalidade sem modelo não é tratada como divergência', () => {
    expect(ritoDivergente([atividade({})], [])).toBe(false)
  })
})
