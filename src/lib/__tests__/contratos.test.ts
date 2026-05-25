import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { listContratos, getContrato, createContrato, updateContrato, deleteContrato, getContratoMetricas, computeContratoAlertas, computeValoresBreakdown, computeSaldoContrato, computeDiasRestantes } from '../contratos'
import { listOrdensServico, getOrdemServico, createOrdemServico, updateOrdemServico, deleteOrdemServico } from '../ordens-servico'
import { listAditivos, createAditivo } from '../contrato-aditivos'
import { listMedicoes, createMedicao } from '../contrato-medicoes'
import { listPagamentos, createPagamento } from '../contrato-pagamentos'

function createChain(result: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in',
    'contains', 'gte', 'lte', 'or', 'order', 'not', 'is', 'limit']
  for (const m of methods) {
    const fn = vi.fn()
    fn.mockReturnValue(chain)
    chain[m] = fn
  }
  chain.then = (onfulfilled: (v: unknown) => unknown) =>
    Promise.resolve(result).then(onfulfilled)
  chain.catch = (onrejected: (v: unknown) => unknown) =>
    Promise.resolve(result).then(undefined, onrejected)
  chain.single = vi.fn().mockResolvedValue(result)
  chain.maybeSingle = vi.fn().mockResolvedValue(result)
  return chain
}

function createMockSupabase(results?: Record<string, unknown>) {
  const chains = new Map<string, ReturnType<typeof createChain>>()
  const getChain = (table: string) => {
    if (!chains.has(table)) {
      chains.set(table, createChain(results?.[table] ?? { data: [], error: null }))
    }
    return chains.get(table)!
  }
  const mock: Partial<SupabaseClient> = {
    from: vi.fn((table: string) => getChain(table)) as never,
    rpc: vi.fn().mockResolvedValue(results?.rpc ?? { data: null, error: null }) as never,
    auth: {
      getUser: vi.fn().mockResolvedValue(results?.auth ?? { data: { user: { id: 'user-1' } }, error: null }),
    } as never,
  }
  return {
    supabase: mock as unknown as SupabaseClient,
    chains,
    getChain,
  }
}

const mockContrato = {
  id: 'ct-1',
  processo_id: 'proc-1',
  numero_contrato: '045/2026',
  ano: 2026,
  contratada_nome: 'Empresa X LTDA',
  contratada_cnpj: '12.345.678/0001-90',
  contratada_representante: 'João da Silva',
  contratada_email: 'joao@empresax.com',
  contratada_telefone: '(11) 99999-8888',
  objeto: 'Serviços de suporte técnico',
  categoria: 'Serviços',
  tipo_contratacao: 'Pregão',
  valor_original: 100000,
  valor_inicial: 100000,
  valor_atual: 105000,
  total_aditivos: 5000,
  valor_executado: 67000,
  valor_pago: 60000,
  status: 'vigente' as const,
  data_assinatura: '2026-01-15',
  data_inicio_vigencia: '2026-02-01',
  data_fim_vigencia: '2027-01-31',
  gestor_id: 'col-1',
  fiscal_tecnico_id: 'col-2',
  observacoes: null,
  created_at: '2026-01-10T00:00:00Z',
}

const mockOS = {
  id: 'os-1',
  contrato_id: 'ct-1',
  processo_id: 'proc-1',
  numero_os: '001/2026',
  objeto: 'Instalação de equipamentos',
  valor: 50000,
  valor_medido: 30000,
  valor_pago: 25000,
  data_emissao: '2026-02-01',
  data_inicio: '2026-02-05',
  data_fim_prevista: '2026-04-30',
  status: 'em_execucao' as const,
  percentual_execucao: 60,
  fiscal_id: 'col-2',
  observacoes: null,
  created_at: '2026-02-01T00:00:00Z',
}

describe('contratos — listContratos', () => {
  it('retorna lista vazia quando não há dados', async () => {
    const { supabase } = createMockSupabase({ contratos: { data: [], error: null } })
    const result = await listContratos(supabase)
    expect(result).toEqual([])
  })

  it('retorna contratos mockados', async () => {
    const { supabase } = createMockSupabase({ contratos: { data: [mockContrato], error: null } })
    const result = await listContratos(supabase)
    expect(result).toHaveLength(1)
    expect(result[0].numero_contrato).toBe('045/2026')
    expect(result[0].contratada_nome).toBe('Empresa X LTDA')
  })

  it('filtra por status', async () => {
    const { supabase, chains } = createMockSupabase({ contratos: { data: [mockContrato], error: null } })
    await listContratos(supabase, { status: 'vigente' })
    expect(chains.get('contratos')!.eq).toHaveBeenCalledWith('status', 'vigente')
  })

  it('filtra por fiscal', async () => {
    const { supabase, chains } = createMockSupabase({ contratos: { data: [mockContrato], error: null } })
    await listContratos(supabase, { fiscal_id: 'col-2' })
    expect(chains.get('contratos')!.or).toHaveBeenCalled()
  })

  it('filtra sem_fiscal', async () => {
    const { supabase, chains } = createMockSupabase({ contratos: { data: [mockContrato], error: null } })
    await listContratos(supabase, { sem_fiscal: true })
    expect(chains.get('contratos')!.is).toHaveBeenCalledWith('fiscal_tecnico_id', null)
  })
})

describe('contratos — getContrato', () => {
  it('retorna contrato por ID', async () => {
    const { supabase } = createMockSupabase({ contratos: { data: mockContrato, error: null } })
    const result = await getContrato(supabase, 'ct-1')
    expect(result).not.toBeNull()
    expect(result!.numero_contrato).toBe('045/2026')
    expect(result!.contratada_nome).toBe('Empresa X LTDA')
  })

  it('retorna null quando não encontrado', async () => {
    const { supabase } = createMockSupabase({ contratos: { data: null, error: { message: 'not found' } } })
    const result = await getContrato(supabase, 'inexistente')
    expect(result).toBeNull()
  })
})

describe('contratos — createContrato', () => {
  it('cria contrato e retorna o registro', async () => {
    const novo = { ...mockContrato, id: undefined as unknown as string }
    const { supabase } = createMockSupabase({ contratos: { data: mockContrato, error: null } })
    const result = await createContrato(supabase, novo as never)
    expect(result).not.toBeNull()
    expect(result!.numero_contrato).toBe('045/2026')
  })

  it('lança erro quando insert falha', async () => {
    const { supabase } = createMockSupabase({ contratos: { data: null, error: new Error('falha no insert') } })
    await expect(createContrato(supabase, {} as never)).rejects.toThrow()
  })
})

describe('contratos — updateContrato', () => {
  it('atualiza contrato parcialmente', async () => {
    const { supabase, chains } = createMockSupabase({ contratos: { data: { ...mockContrato, contratada_nome: 'Empresa Y' }, error: null } })
    const result = await updateContrato(supabase, 'ct-1', { contratada_nome: 'Empresa Y' })
    expect(result).not.toBeNull()
    expect(chains.get('contratos')!.update).toHaveBeenCalledWith({ contratada_nome: 'Empresa Y' })
    expect(chains.get('contratos')!.eq).toHaveBeenCalledWith('id', 'ct-1')
  })
})

describe('contratos — deleteContrato', () => {
  it('deleta contrato por ID', async () => {
    const { supabase, chains } = createMockSupabase({ contratos: { data: null, error: null } })
    await deleteContrato(supabase, 'ct-1')
    expect(chains.get('contratos')!.delete).toHaveBeenCalled()
    expect(chains.get('contratos')!.eq).toHaveBeenCalledWith('id', 'ct-1')
  })
})

describe('contratos — getContratoMetricas', () => {
  it('retorna métricas zeradas sem dados', async () => {
    const { supabase } = createMockSupabase({
      contratos: { data: [], error: null },
      ordens_servico: { data: [], error: null },
      contrato_aditivos: { data: [], error: null },
      contrato_pagamentos: { data: [], error: null },
    })
    const m = await getContratoMetricas(supabase)
    expect(m.total).toBe(0)
    expect(m.vigentes).toBe(0)
    expect(m.valor_contratado).toBe(0)
  })

  it('calcula métricas corretamente', async () => {
    const { supabase } = createMockSupabase({
      rpc: {
        data: [{
          total: 2, vigentes: 1, vencendo_30d: 0, vencidos: 0,
          valor_contratado: 150000, valor_executado: 90000, saldo: 60000,
          sem_fiscal: 0, sem_movimentacao: 0,
          pagamentos_pendentes: 0, os_em_execucao: 1, aditivos_andamento: 0,
        }],
        error: null,
      },
    })
    const m = await getContratoMetricas(supabase)
    expect(m.total).toBe(2)
    expect(m.vigentes).toBe(1)
    expect(m.valor_contratado).toBe(150000)
    expect(m.valor_executado).toBe(90000)
    expect(m.saldo).toBe(60000)
  })
})

describe('contratos — computeContratoAlertas', () => {
  it('gera alerta de vencido', () => {
    const alertas = computeContratoAlertas({ ...mockContrato, status: 'vencido' } as never)
    expect(alertas.some(a => a.tipo === 'vencido')).toBe(true)
    expect(alertas.find(a => a.tipo === 'vencido')!.gravidade).toBe('alto')
  })

  it('gera alerta de sem fiscal', () => {
    const alertas = computeContratoAlertas({
      ...mockContrato,
      fiscal_tecnico_id: null,
      fiscal_administrativo_id: null,
    } as never)
    expect(alertas.some(a => a.tipo === 'sem_fiscal')).toBe(true)
  })

  it('gera alerta de saldo baixo', () => {
    const alertas = computeContratoAlertas({
      ...mockContrato,
      valor_atual: 10000,
      valor_executado: 9500,
    } as never)
    expect(alertas.some(a => a.tipo === 'saldo_baixo')).toBe(true)
  })

  it('não gera alerta de vencido para contrato vigente', () => {
    const alertas = computeContratoAlertas({ ...mockContrato, status: 'vigente', data_fim_vigencia: '2029-12-31' } as never)
    expect(alertas.some(a => a.tipo === 'vencido')).toBe(false)
  })

  it('alerta com 6 meses de antecedência', () => {
    const futuro = new Date()
    futuro.setMonth(futuro.getMonth() + 5)
    const alertas = computeContratoAlertas({
      ...mockContrato,
      status: 'vigente',
      data_fim_vigencia: futuro.toISOString().slice(0, 10),
    } as never)
    const venc = alertas.find(a => a.tipo === 'proximo_vencimento')
    expect(venc).toBeDefined()
    expect(venc!.gravidade).toBe('baixo')
  })

  it('não alerta além de 6 meses', () => {
    const futuro = new Date()
    futuro.setMonth(futuro.getMonth() + 12)
    const alertas = computeContratoAlertas({
      ...mockContrato,
      status: 'vigente',
      data_fim_vigencia: futuro.toISOString().slice(0, 10),
    } as never)
    expect(alertas.some(a => a.tipo === 'proximo_vencimento')).toBe(false)
  })
})

describe('contratos — computeValoresBreakdown', () => {
  it('usa valor_original e total_aditivos do contrato', () => {
    const bd = computeValoresBreakdown(mockContrato as never)
    expect(bd.valorOriginal).toBe(100000)
    expect(bd.totalAcrescimos).toBe(5000)
    expect(bd.totalSupressoes).toBe(0)
    expect(bd.valorAtualCalculado).toBe(105000)
  })

  it('usa valor_inicial como fallback quando valor_original é 0', () => {
    const bd = computeValoresBreakdown({ ...mockContrato, valor_original: 0, valor_inicial: 80000, total_aditivos: 20000 } as never)
    expect(bd.valorOriginal).toBe(80000)
  })

  it('classifica acrescimo e supressao via aditivos array', () => {
    const bd = computeValoresBreakdown(mockContrato as never, [
      { tipo: 'acrescimo', valor_alteracao: 10000 } as never,
      { tipo: 'supressao', valor_alteracao: -3000 } as never,
      { tipo: 'apostilamento', valor_alteracao: 2000 } as never,
    ])
    expect(bd.totalAcrescimos).toBe(12000)
    expect(bd.totalSupressoes).toBe(3000)
    expect(bd.valorAtualCalculado).toBe(100000 + 12000 - 3000)
  })
})

describe('contratos — computeSaldoContrato', () => {
  it('calcula saldo corretamente', () => {
    const saldo = computeSaldoContrato({ valor_atual: 100000, valor_executado: 40000 } as never)
    expect(saldo).toBe(60000)
  })

  it('retorna valor_atual se executado for zero', () => {
    const saldo = computeSaldoContrato({ valor_atual: 50000, valor_executado: 0 } as never)
    expect(saldo).toBe(50000)
  })
})

describe('contratos — computeDiasRestantes', () => {
  it('retorna 0 para data nula', () => {
    expect(computeDiasRestantes(null)).toBe(0)
  })

  it('retorna número positivo para data futura', () => {
    const futuro = new Date()
    futuro.setDate(futuro.getDate() + 30)
    const dias = computeDiasRestantes(futuro.toISOString().slice(0, 10))
    expect(Math.abs(dias - 30)).toBeLessThanOrEqual(1)
  })

  it('retorna número negativo para data passada', () => {
    const passado = new Date()
    passado.setDate(passado.getDate() - 10)
    const dias = computeDiasRestantes(passado.toISOString().slice(0, 10))
    expect(Math.abs(dias + 10)).toBeLessThanOrEqual(1)
  })
})

describe('ordens_servico — listOrdensServico', () => {
  it('retorna lista vazia', async () => {
    const { supabase } = createMockSupabase({ ordens_servico: { data: [], error: null } })
    const result = await listOrdensServico(supabase)
    expect(result).toEqual([])
  })

  it('retorna OS mockadas', async () => {
    const { supabase } = createMockSupabase({ ordens_servico: { data: [mockOS], error: null } })
    const result = await listOrdensServico(supabase)
    expect(result).toHaveLength(1)
    expect(result[0].numero_os).toBe('001/2026')
  })

  it('filtra por contrato_id', async () => {
    const { supabase, chains } = createMockSupabase({ ordens_servico: { data: [mockOS], error: null } })
    await listOrdensServico(supabase, { contrato_id: 'ct-1' })
    expect(chains.get('ordens_servico')!.eq).toHaveBeenCalledWith('contrato_id', 'ct-1')
  })

  it('filtra por status', async () => {
    const { supabase, chains } = createMockSupabase({ ordens_servico: { data: [mockOS], error: null } })
    await listOrdensServico(supabase, { status: 'em_execucao' })
    expect(chains.get('ordens_servico')!.eq).toHaveBeenCalledWith('status', 'em_execucao')
  })
})

describe('ordens_servico — getOrdemServico', () => {
  it('retorna OS por ID', async () => {
    const { supabase } = createMockSupabase({ ordens_servico: { data: mockOS, error: null } })
    const result = await getOrdemServico(supabase, 'os-1')
    expect(result).not.toBeNull()
    expect(result!.numero_os).toBe('001/2026')
  })

  it('retorna null na inexistente', async () => {
    const { supabase } = createMockSupabase({ ordens_servico: { data: null, error: { message: 'not found' } } })
    const result = await getOrdemServico(supabase, 'inexistente')
    expect(result).toBeNull()
  })
})

describe('ordens_servico — createOrdemServico', () => {
  it('cria OS', async () => {
    const { supabase } = createMockSupabase({ ordens_servico: { data: mockOS, error: null } })
    const result = await createOrdemServico(supabase, mockOS as never)
    expect(result).not.toBeNull()
    expect(result!.numero_os).toBe('001/2026')
  })

  it('lança erro no insert', async () => {
    const { supabase } = createMockSupabase({ ordens_servico: { data: null, error: new Error('insert fail') } })
    await expect(createOrdemServico(supabase, {} as never)).rejects.toThrow()
  })
})

describe('ordens_servico — updateOrdemServico', () => {
  it('atualiza parcialmente', async () => {
    const { supabase, chains } = createMockSupabase({ ordens_servico: { data: { ...mockOS, status: 'concluida' }, error: null } })
    await updateOrdemServico(supabase, 'os-1', { status: 'concluida', percentual_execucao: 100 })
    expect(chains.get('ordens_servico')!.update).toHaveBeenCalledWith({ status: 'concluida', percentual_execucao: 100 })
  })
})

describe('ordens_servico — deleteOrdemServico', () => {
  it('deleta por ID', async () => {
    const { supabase, chains } = createMockSupabase({ ordens_servico: { data: null, error: null } })
    await deleteOrdemServico(supabase, 'os-1')
    expect(chains.get('ordens_servico')!.delete).toHaveBeenCalled()
    expect(chains.get('ordens_servico')!.eq).toHaveBeenCalledWith('id', 'os-1')
  })
})

describe('contrato_aditivos — listAditivos', () => {
  it('retorna lista vazia', async () => {
    const { supabase } = createMockSupabase({ contrato_aditivos: { data: [], error: null } })
    const result = await listAditivos(supabase)
    expect(result).toEqual([])
  })

  it('filtra por contrato_id', async () => {
    const { supabase, chains } = createMockSupabase({ contrato_aditivos: { data: [], error: null } })
    await listAditivos(supabase, 'ct-1')
    expect(chains.get('contrato_aditivos')!.eq).toHaveBeenCalledWith('contrato_id', 'ct-1')
  })
})

describe('contrato_aditivos — createAditivo', () => {
  it('cria aditivo e retorna', async () => {
    const aditivo = {
      contrato_id: 'ct-1',
      numero_aditivo: '001',
      tipo: 'aditivo_prazo' as const,
      valor_anterior: 100000,
      valor_alteracao: 5000,
      valor_novo: 105000,
    }
    const { supabase } = createMockSupabase({ contrato_aditivos: { data: aditivo, error: null } })
    const result = await createAditivo(supabase, aditivo as never)
    expect(result).not.toBeNull()
    expect(result!.numero_aditivo).toBe('001')
  })
})

describe('contrato_medicoes — listMedicoes', () => {
  it('retorna lista vazia', async () => {
    const { supabase } = createMockSupabase({ contrato_medicoes: { data: [], error: null } })
    const result = await listMedicoes(supabase)
    expect(result).toEqual([])
  })
})

describe('contrato_medicoes — createMedicao', () => {
  it('cria medição', async () => {
    const medicao = {
      contrato_id: 'ct-1',
      ordem_servico_id: 'os-1',
      numero_medicao: '001',
      valor_medido: 15000,
      percentual_executado: 30,
      status: 'em_elaboracao' as const,
    }
    const { supabase } = createMockSupabase({ contrato_medicoes: { data: medicao, error: null } })
    const result = await createMedicao(supabase, medicao as never)
    expect(result).not.toBeNull()
    expect(result!.numero_medicao).toBe('001')
  })
})

describe('contrato_pagamentos — listPagamentos', () => {
  it('retorna lista vazia', async () => {
    const { supabase } = createMockSupabase({ contrato_pagamentos: { data: [], error: null } })
    const result = await listPagamentos(supabase)
    expect(result).toEqual([])
  })
})

describe('contrato_pagamentos — createPagamento', () => {
  it('cria pagamento', async () => {
    const pagamento = {
      contrato_id: 'ct-1',
      numero_nota_fiscal: 'NF-001',
      valor: 15000,
      status: 'aguardando_nf' as const,
    }
    const { supabase } = createMockSupabase({ contrato_pagamentos: { data: pagamento, error: null } })
    const result = await createPagamento(supabase, pagamento as never)
    expect(result).not.toBeNull()
    expect(result!.numero_nota_fiscal).toBe('NF-001')
  })
})
