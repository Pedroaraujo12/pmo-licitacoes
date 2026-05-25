import { describe, it, expect } from 'vitest'
import {
  computeCronogramaStatus,
  getAtividadeIcon,
  getAtividadeBadgeColor,
  recalcCascata,
  getFaseAgrupada,
} from '../cronograma-engine'
import type { CronogramaAtividade } from '@/types/database'

function makeAtividade(overrides: Partial<CronogramaAtividade> = {}): CronogramaAtividade {
  return {
    id: 'a1',
    processo_id: 'p1',
    ordem: 1,
    dias_uteis: 5,
    fase: 'Planejamento',
    descricao: 'Atividade 1',
    setor: 'Licitações',
    status: 'nao_iniciado',
    data_inicio: '2026-05-25',
    data_fim: '2026-05-29',
    modelo_etapa_id: null,
    responsavel_id: null,
    data_inicio_real: null,
    data_fim_real: null,
    observacao: null,
    created_at: '2026-05-01T00:00:00Z',
    ...overrides,
  }
}

describe('computeCronogramaStatus', () => {
  it('retorna zeros para lista vazia', () => {
    const s = computeCronogramaStatus([])
    expect(s.total).toBe(0)
    expect(s.concluidas).toBe(0)
    expect(s.atrasadas).toBe(0)
    expect(s.progresso).toBe(0)
    expect(s.process_atrasado).toBe(false)
    expect(s.atividade_atual).toBeNull()
    expect(s.dias_restantes).toBeNull()
    expect(s.alerta).toBe('normal')
  })

  it('calcula progresso 100% quando todas concluídas', () => {
    const atividades = [
      makeAtividade({ id: 'a1', status: 'concluido', data_fim: '2026-05-20' }),
      makeAtividade({ id: 'a2', ordem: 2, status: 'concluido', data_fim: '2026-05-25' }),
    ]
    const s = computeCronogramaStatus(atividades)
    expect(s.concluidas).toBe(2)
    expect(s.progresso).toBe(100)
    expect(s.process_atrasado).toBe(false)
  })

  it('detecta atividades atrasadas', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 5)
    const dateStr = yesterday.toISOString().split('T')[0]
    const atividades = [
      makeAtividade({ status: 'nao_iniciado', data_fim: dateStr }),
    ]
    const s = computeCronogramaStatus(atividades)
    expect(s.atrasadas).toBe(1)
    expect(s.process_atrasado).toBe(true)
    expect(s.alerta).toBe('atrasado')
  })

  it('não marca atividade sem data_fim como atrasada', () => {
    const atividades = [
      makeAtividade({ status: 'nao_iniciado', data_fim: null }),
    ]
    const s = computeCronogramaStatus(atividades)
    expect(s.atrasadas).toBe(0)
    expect(s.alerta).toBe('normal')
  })

  it('marca alerta proximo_vencimento quando faltam <= 3 dias', () => {
    const future = new Date()
    future.setDate(future.getDate() + 2)
    const dateStr = future.toISOString().split('T')[0]
    const atividades = [
      makeAtividade({ status: 'nao_iniciado', data_fim: dateStr }),
    ]
    const s = computeCronogramaStatus(atividades)
    expect(s.alerta).toBe('proximo_vencimento')
  })

  it('retorna atividade_atual como primeira não concluída', () => {
    const atividades = [
      makeAtividade({ id: 'a1', status: 'concluido', descricao: 'Pronto' }),
      makeAtividade({ id: 'a2', ordem: 2, status: 'em_andamento', descricao: 'Em execução' }),
      makeAtividade({ id: 'a3', ordem: 3, status: 'nao_iniciado', descricao: 'Pendente' }),
    ]
    const s = computeCronogramaStatus(atividades)
    expect(s.atividade_atual).toBe('Em execução')
  })
})

describe('getAtividadeIcon', () => {
  it('retorna verde para concluído', () => {
    const r = getAtividadeIcon('concluido', '2026-05-20')
    expect(r.color).toBe('#22c55e')
  })

  it('retorna azul para em_andamento', () => {
    const r = getAtividadeIcon('em_andamento', null)
    expect(r.color).toBe('#3b82f6')
  })

  it('retorna vermelho para atrasado', () => {
    const past = new Date()
    past.setDate(past.getDate() - 10)
    const r = getAtividadeIcon('nao_iniciado', past.toISOString().split('T')[0])
    expect(r.color).toBe('#ef4444')
  })

  it('retorna amarelo para vencendo em <= 3 dias', () => {
    const future = new Date()
    future.setDate(future.getDate() + 2)
    const r = getAtividadeIcon('nao_iniciado', future.toISOString().split('T')[0])
    expect(r.color).toBe('#eab308')
  })

  it('retorna cinza para sem data_fim', () => {
    const r = getAtividadeIcon('nao_iniciado', null)
    expect(r.color).toBe('#94a3b8')
  })
})

describe('getAtividadeBadgeColor', () => {
  it('retorna cores específicas para cada fase', () => {
    expect(getAtividadeBadgeColor('Planejamento')).toBe('#6366f1')
    expect(getAtividadeBadgeColor('Produção')).toBe('#3b82f6')
    expect(getAtividadeBadgeColor('Análise')).toBe('#f59e0b')
    expect(getAtividadeBadgeColor('Revisão')).toBe('#8b5cf6')
    expect(getAtividadeBadgeColor('Execução')).toBe('#06b6d4')
    expect(getAtividadeBadgeColor('Aprovação')).toBe('#10b981')
  })

  it('retorna fallback para fase desconhecida', () => {
    expect(getAtividadeBadgeColor('Indefinida')).toBe('#64748b')
  })
})

describe('recalcCascata', () => {
  it('retorna array inalterado se atividade não encontrada', () => {
    const atividades = [makeAtividade()]
    const result = recalcCascata(atividades, 'not-found', '2026-06-01')
    expect(result).toEqual(atividades)
  })

  it('aplica override de data_inicio_real', () => {
    const atividades = [makeAtividade({ data_inicio: '2026-05-25', data_fim: '2026-05-29' })]
    const result = recalcCascata(atividades, 'a1', '2026-06-01')
    expect(result[0].data_inicio_real).toBe('2026-06-01')
  })

  it('pula atividades concluídas no recálculo', () => {
    const atividades = [
      makeAtividade({ id: 'a1', status: 'concluido', data_inicio: '2026-05-25', data_fim: '2026-05-25', data_fim_real: '2026-05-25' }),
      makeAtividade({ id: 'a2', ordem: 2, status: 'nao_iniciado', data_inicio: null, data_fim: null, dias_uteis: 3 }),
    ]
    const result = recalcCascata(atividades, 'a1', '2026-06-01')
    // a1 is concluded and skipped, but a2 recalculates from a1's data_fim_real
    expect(result[0].data_inicio_real).toBe('2026-06-01')
    expect(result[1].data_inicio).toBe('2026-05-26')
  })

  it('recalcula em cascata para atividades seguintes', () => {
    // 2026-06-08 is a Monday
    const atividades = [
      makeAtividade({ id: 'a1', status: 'concluido', data_inicio: '2026-05-25', data_fim_real: '2026-05-25' }),
      makeAtividade({ id: 'a2', ordem: 2, status: 'nao_iniciado', data_inicio: '2026-05-26', data_fim: '2026-05-26', dias_uteis: 1 }),
      makeAtividade({ id: 'a3', ordem: 3, status: 'nao_iniciado', data_inicio: '2026-05-27', data_fim: '2026-05-27', dias_uteis: 1 }),
    ]
    const result = recalcCascata(atividades, 'a2', '2026-06-08')
    expect(result[1].data_inicio_real).toBe('2026-06-08')
    expect(result[1].data_inicio).toBe('2026-06-08')
    // 1 business day from Monday = Tuesday
    expect(result[1].data_fim).toBe('2026-06-09')
    // next activity starts day after previous data_fim
    expect(result[2].data_inicio).toBe('2026-06-10')
  })

  it('usa data_fim_real da anterior quando disponível', () => {
    const atividades = [
      makeAtividade({ id: 'a1', status: 'concluido', data_fim_real: '2026-06-05' }),
      makeAtividade({ id: 'a2', ordem: 2, status: 'nao_iniciado', data_inicio: '2026-05-26', data_fim: '2026-05-26', dias_uteis: 1 }),
    ]
    const result = recalcCascata(atividades, 'a1', '2026-06-01')
    expect(result[1].data_inicio).toBe('2026-06-06')
  })

  it('define data_fim = data_inicio quando dias_uteis = 0', () => {
    const atividades = [
      makeAtividade({ status: 'nao_iniciado', data_inicio: '2026-06-01', data_fim: '2026-06-05', dias_uteis: 0 }),
    ]
    const result = recalcCascata(atividades, 'a1', '2026-06-10')
    expect(result[0].data_fim).toBe('2026-06-10')
  })

  it('conta dias úteis corretamente (5 dias = seg-sex + seg)', () => {
    // 2026-06-01 is Monday
    const atividades = [
      makeAtividade({ status: 'nao_iniciado', data_inicio: '2026-06-01', data_fim: '2026-06-05', dias_uteis: 5 }),
    ]
    const result = recalcCascata(atividades, 'a1', null)
    // 5 business days from June 1: Jun 2(Tue)+3(Wed)+4(Thu)+5(Fri)+8(Mon)
    expect(result[0].data_fim).toBe('2026-06-08')
  })
})

describe('getFaseAgrupada', () => {
  it('mapeia fases conhecidas', () => {
    expect(getFaseAgrupada('Planejamento')).toContain('Planejamento')
    expect(getFaseAgrupada('Produção')).toContain('Produção')
    expect(getFaseAgrupada('Análise')).toContain('Análise')
    expect(getFaseAgrupada('Revisão')).toContain('Revisão')
    expect(getFaseAgrupada('Execução')).toContain('Execução')
    expect(getFaseAgrupada('Aprovação')).toContain('Aprovação')
  })

  it('retorna o próprio nome para fase desconhecida', () => {
    expect(getFaseAgrupada('Indefinida')).toBe('Indefinida')
  })
})
