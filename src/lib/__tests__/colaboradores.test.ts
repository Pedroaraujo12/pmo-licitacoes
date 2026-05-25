import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  listColaboradores,
  getColaborador,
  createColaborador,
  updateColaborador,
  deleteColaborador,
  vincularUsuario,
  desvincularUsuario,
  getColaboradorByUserId,
  listUsersWithoutColaborador,
  listFavoritos,
  toggleFavorito,
  isFavorito,
  listAniversariantes,
  getMetricas,
  listProcessosColaborador,
  listUnidades,
  listCargos,
} from '../colaboradores'

function createChain(result: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in',
    'contains', 'gte', 'lte', 'or', 'order', 'limit', 'not']
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

const mockColaborador = {
  id: 'col-1',
  nome_completo: 'João Silva',
  cpf: '123.456.789-00',
  matricula: '123',
  sexo: 'M',
  data_nascimento: '1990-01-15',
  cargo: 'Analista',
  funcao: null,
  unidade: 'Licitações',
  lotacao: null,
  regime: 'efetivo' as const,
  data_admissao: '2020-03-01',
  situacao: 'ativo' as const,
  data_desligamento: null,
  email_institucional: 'joao@teste.com',
  telefone_institucional: null,
  ramal: null,
  email_pessoal: null,
  celular: null,
  logradouro: null,
  numero: null,
  complemento: null,
  bairro: null,
  cidade: null,
  uf: null,
  cep: null,
  user_id: null,
  foto_url: null,
  observacoes: null,
  created_by: 'user-1',
  updated_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('listColaboradores', () => {
  it('usa RPC quando search é fornecido', async () => {
    const { supabase } = createMockSupabase({
      rpc: { data: [mockColaborador], error: null },
    })
    const result = await listColaboradores(supabase, { search: 'João' })
    expect(supabase.rpc).toHaveBeenCalledWith('search_colaboradores', { search_term: 'João' })
    expect(result.data).toHaveLength(1)
    expect(result.data![0].nome_completo).toBe('João Silva')
  })

  it('constrói query com filtros', async () => {
    const { supabase, getChain } = createMockSupabase({
      colaboradores: { data: [mockColaborador], error: null },
    })
    const chain = getChain('colaboradores')
    const result = await listColaboradores(supabase, { unidade: 'Licitações', situacao: 'ativo' })

    expect(supabase.from).toHaveBeenCalledWith('colaboradores')
    expect(chain.select).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('unidade', 'Licitações')
    expect(chain.eq).toHaveBeenCalledWith('situacao', 'ativo')
    expect(chain.order).toHaveBeenCalledWith('nome_completo', { ascending: true })
    expect(result.data).toHaveLength(1)
  })

  it('retorna dados sem filtros', async () => {
    const { supabase } = createMockSupabase({
      colaboradores: { data: [mockColaborador], error: null },
    })
    const result = await listColaboradores(supabase)
    expect(supabase.from).toHaveBeenCalledWith('colaboradores')
    expect(result.data).toHaveLength(1)
    expect(result.error).toBeNull()
  })
})

describe('getColaborador', () => {
  it('retorna colaborador por id', async () => {
    const { supabase, getChain } = createMockSupabase({
      colaboradores: { data: mockColaborador, error: null },
    })
    const chain = getChain('colaboradores')
    const result = await getColaborador(supabase, 'col-1')
    expect(chain.eq).toHaveBeenCalledWith('id', 'col-1')
    expect(chain.single).toHaveBeenCalled()
    expect(result.data?.nome_completo).toBe('João Silva')
  })
})

describe('createColaborador', () => {
  it('cria e retorna novo colaborador', async () => {
    const { supabase, getChain } = createMockSupabase({
      colaboradores: { data: mockColaborador, error: null },
    })
    const result = await createColaborador(supabase, { nome_completo: 'João Silva', data_nascimento: '1990-01-15' })
    expect(result.nome_completo).toBe('João Silva')
    expect(getChain('colaboradores').insert).toHaveBeenCalled()
    expect(getChain('colaboradores').single).toHaveBeenCalled()
  })

  it('lança erro se não autenticado', async () => {
    const { supabase } = createMockSupabase({
      auth: { data: { user: null }, error: { message: 'No user' } },
    })
    await expect(createColaborador(supabase, { nome_completo: 'João', data_nascimento: '1990-01-15' }))
      .rejects.toThrow('Usuário não autenticado')
  })
})

describe('updateColaborador', () => {
  it('atualiza e retorna colaborador', async () => {
    const updated = { ...mockColaborador, cargo: 'Coordenador' }
    const { supabase, getChain } = createMockSupabase({
      colaboradores: { data: updated, error: null },
    })
    const result = await updateColaborador(supabase, 'col-1', { cargo: 'Coordenador' })
    expect(result.cargo).toBe('Coordenador')
    expect(getChain('colaboradores').update).toHaveBeenCalledWith({ cargo: 'Coordenador', updated_by: 'user-1' })
  })
})

describe('deleteColaborador', () => {
  it('deleta colaborador', async () => {
    const { supabase, getChain } = createMockSupabase({
      colaboradores: { data: null, error: null },
    })
    await deleteColaborador(supabase, 'col-1')
    expect(getChain('colaboradores').delete).toHaveBeenCalled()
    expect(getChain('colaboradores').eq).toHaveBeenCalledWith('id', 'col-1')
  })
})

describe('vincularUsuario / desvincularUsuario', () => {
  it('vincula usuário', async () => {
    const vinculado = { ...mockColaborador, user_id: 'user-2' }
    const { supabase, getChain } = createMockSupabase({
      colaboradores: { data: vinculado, error: null },
    })
    const result = await vincularUsuario(supabase, 'col-1', 'user-2')
    expect(result.user_id).toBe('user-2')
    expect(getChain('colaboradores').update).toHaveBeenCalledWith({ user_id: 'user-2', updated_by: 'user-1' })
  })

  it('desvincula usuário', async () => {
    const desvinculado = { ...mockColaborador, user_id: null }
    const { supabase, getChain } = createMockSupabase({
      colaboradores: { data: desvinculado, error: null },
    })
    const result = await desvincularUsuario(supabase, 'col-1')
    expect(result.user_id).toBeNull()
    expect(getChain('colaboradores').update).toHaveBeenCalledWith({ user_id: null, updated_by: 'user-1' })
  })
})

describe('getColaboradorByUserId', () => {
  it('retorna colaborador pelo user_id', async () => {
    const { supabase, getChain } = createMockSupabase({
      colaboradores: { data: mockColaborador, error: null },
    })
    const result = await getColaboradorByUserId(supabase, 'user-2')
    expect(getChain('colaboradores').eq).toHaveBeenCalledWith('user_id', 'user-2')
    expect(result?.nome_completo).toBe('João Silva')
  })

  it('retorna null se não encontrado', async () => {
    const { supabase } = createMockSupabase({
      colaboradores: { data: null, error: { message: 'not found' } },
    })
    const result = await getColaboradorByUserId(supabase, 'user-not-found')
    expect(result).toBeNull()
  })
})

describe('listUsersWithoutColaborador', () => {
  it('filtra usuários já vinculados', async () => {
    const { supabase, chains } = createMockSupabase()
    const colabChain = createChain({ data: [{ user_id: 'user-a' }], error: null })
    chains.set('colaboradores', colabChain)
    const profilesChain = createChain({
      data: [
        { id: 'user-a', name: 'A', email: 'a@test.com', role: 'admin' },
        { id: 'user-b', name: 'B', email: 'b@test.com', role: 'visualizador' },
      ],
      error: null,
    })
    chains.set('profiles', profilesChain)

    const result = await listUsersWithoutColaborador(supabase)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('user-b')
  })
})

describe('Favoritos', () => {
  it('listFavoritos retorna favoritos do usuário', async () => {
    const { supabase, getChain } = createMockSupabase({
      colaborador_favoritos: {
        data: [
          { id: 'fav-1', colaborador_id: 'col-1', user_id: 'user-1', created_at: '2026-01-01T00:00:00Z', colaboradores: mockColaborador },
        ],
        error: null,
      },
    })
    const result = await listFavoritos(supabase)
    expect(getChain('colaborador_favoritos').eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(result).toHaveLength(1)
  })

  it('toggleFavorito adiciona quando não existe', async () => {
    const { supabase, getChain } = createMockSupabase({
      colaborador_favoritos: { data: null, error: null },
    })
    getChain('colaborador_favoritos').maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const result = await toggleFavorito(supabase, 'col-1')
    expect(result).toBe(true)
    expect(getChain('colaborador_favoritos').insert).toHaveBeenCalled()
  })

  it('toggleFavorito remove quando já existe', async () => {
    const { supabase, getChain } = createMockSupabase({
      colaborador_favoritos: { data: { id: 'fav-1' }, error: null },
    })
    getChain('colaborador_favoritos').maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'fav-1' }, error: null })
    const result = await toggleFavorito(supabase, 'col-1')
    expect(result).toBe(false)
    expect(getChain('colaborador_favoritos').delete).toHaveBeenCalled()
  })

  it('isFavorito retorna true se existe', async () => {
    const { supabase, getChain } = createMockSupabase()
    getChain('colaborador_favoritos').maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'fav-1' }, error: null })
    const result = await isFavorito(supabase, 'col-1')
    expect(result).toBe(true)
  })

  it('isFavorito retorna false se não existe', async () => {
    const { supabase, getChain } = createMockSupabase()
    getChain('colaborador_favoritos').maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const result = await isFavorito(supabase, 'col-1')
    expect(result).toBe(false)
  })
})

describe('listAniversariantes', () => {
  it('lista com filtro de período', async () => {
    const { supabase, getChain } = createMockSupabase({
      vw_aniversariantes: {
        data: [{ ...mockColaborador, mes_nascimento: 5, dia_nascimento: 23, idade: 36, periodo_aniversario: 'hoje' }],
        error: null,
      },
    })
    const result = await listAniversariantes(supabase, 'hoje')
    expect(getChain('vw_aniversariantes').eq).toHaveBeenCalledWith('periodo_aniversario', 'hoje')
    expect(result).toHaveLength(1)
  })

  it('lista sem filtro de período', async () => {
    const { supabase } = createMockSupabase({
      vw_aniversariantes: { data: [], error: null },
    })
    const result = await listAniversariantes(supabase)
    expect(result).toEqual([])
  })
})

describe('getMetricas', () => {
  it('retorna métricas', async () => {
    const metricas = { ativos: 10, afastados: 2, desligados: 1, total: 13, unidades_distintas: 3, efetivos: 8, comissionados: 3, terceirizados: 1, estagiarios: 1, cedidos: 0 }
    const { supabase, getChain } = createMockSupabase({
      vw_colaboradores_metricas: { data: metricas, error: null },
    })
    const result = await getMetricas(supabase)
    expect(getChain('vw_colaboradores_metricas').single).toHaveBeenCalled()
    expect(result?.ativos).toBe(10)
  })
})

describe('listProcessosColaborador', () => {
  it('retorna processos do colaborador', async () => {
    const { supabase, chains } = createMockSupabase()
    chains.set('colaboradores', createChain({
      data: { user_id: 'user-2', nome_completo: 'João Silva' },
      error: null,
    }))
    chains.set('responsaveis', createChain({
      data: [{ id: 'resp-1' }],
      error: null,
    }))
    chains.set('processos', createChain({
      data: [{ id: 'proc-1', id_processo: '2026.0001', objeto_resumido: 'Teste', data_entrada: '2026-01-01' }],
      error: null,
    }))
    chains.set('cronograma_atividades', createChain({ data: [], error: null }))

    const result = await listProcessosColaborador(supabase, 'col-1')
    expect(result.nome).toBe('João Silva')
    expect(result.processos).toHaveLength(1)
    expect(result.processos[0].id_processo).toBe('2026.0001')
  })
})

describe('listUnidades / listCargos', () => {
  it('lista unidades', async () => {
    const { supabase } = createMockSupabase({
      colaboradores: { data: [{ unidade: 'Licitações' }, { unidade: 'Contratos' }, { unidade: 'Licitações' }], error: null },
    })
    const result = await listUnidades(supabase)
    expect(result).toEqual(['Licitações', 'Contratos'])
  })

  it('listCargos retorna cargos únicos', async () => {
    const { supabase } = createMockSupabase({
      colaboradores: { data: [{ cargo: 'Analista' }, { cargo: 'Coordenador' }], error: null },
    })
    const result = await listCargos(supabase)
    expect(result).toEqual(['Analista', 'Coordenador'])
  })
})
