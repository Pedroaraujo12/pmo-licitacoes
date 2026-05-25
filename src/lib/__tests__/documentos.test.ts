/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

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

const mockTemplate = {
  id: 'tmpl-1',
  title: 'Edital Padrão',
  tipo_documento: 'edital',
  categoria: 'licitacoes',
  base_legal: 'Lei 14.133/2021',
  sei_link: null,
  descricao: 'Modelo padrão de edital',
  conteudo: '[[PREAMBULO]] [[OBJETO]]',
  status: 'rascunho',
  tags: ['edital'],
  versao_vigente_id: null,
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('listTemplates', () => {
  it('lista com filtros', async () => {
    const { supabase, getChain } = createMockSupabase({
      document_templates: { data: [mockTemplate], error: null },
    })
    const result = await (await import('../documentos')).listTemplates(supabase, { tipo: 'edital' })
    expect(getChain('document_templates').eq).toHaveBeenCalledWith('tipo_documento', 'edital')
    expect(result.data).toHaveLength(1)
  })

  it('usa RPC quando search é fornecido', async () => {
    const { supabase } = createMockSupabase({
      rpc: { data: [mockTemplate], error: null },
    })
    const result = await (await import('../documentos')).listTemplates(supabase, { search: 'edital' })
    expect(supabase.rpc).toHaveBeenCalledWith('search_templates', { search_term: 'edital' })
    expect(result.data).toHaveLength(1)
  })

  it('lista sem filtros', async () => {
    const { supabase } = createMockSupabase({
      document_templates: { data: [mockTemplate], error: null },
    })
    const result = await (await import('../documentos')).listTemplates(supabase)
    expect(result.data).toHaveLength(1)
  })
})

describe('getTemplate', () => {
  it('retorna template por id', async () => {
    const { supabase, getChain } = createMockSupabase({
      document_templates: { data: mockTemplate, error: null },
    })
    const result = await (await import('../documentos')).getTemplate(supabase, 'tmpl-1')
    expect(getChain('document_templates').eq).toHaveBeenCalledWith('id', 'tmpl-1')
    expect(result.data?.title).toBe('Edital Padrão')
  })
})

describe('createTemplate', () => {
  it('cria template com versão inicial', async () => {
    const { supabase, getChain } = createMockSupabase({
      document_templates: { data: { ...mockTemplate, id: 'tmpl-new' }, error: null },
      template_versions: { data: null, error: null },
    })
    const result = await (await import('../documentos')).createTemplate(supabase, {
      title: 'Novo Edital',
      tipo_documento: 'edital',
      categoria: 'licitacoes',
      conteudo: '[[OBJETO]]',
    })
    expect(getChain('document_templates').insert).toHaveBeenCalled()
    expect(getChain('template_versions').insert).toHaveBeenCalledWith({
      template_id: 'tmpl-new',
      version_number: 1,
      conteudo: '[[OBJETO]]',
      resumo_alteracao: 'Versão inicial',
      status: 'rascunho',
      author_id: 'user-1',
    })
    expect(result.title).toBe('Edital Padrão')
  })

  it('lança erro se não autenticado', async () => {
    const { supabase } = createMockSupabase({
      auth: { data: { user: null }, error: { message: 'No user' } },
    })
    await expect((await import('../documentos')).createTemplate(supabase, {
      title: 'Teste', tipo_documento: 'edital', categoria: 'licitacoes', conteudo: 'teste',
    })).rejects.toThrow('Usuário não autenticado')
  })
})

describe('updateTemplate / updateTemplateStatus', () => {
  it('atualiza template', async () => {
    const { supabase, getChain } = createMockSupabase({
      document_templates: { data: null, error: null },
    })
    await (await import('../documentos')).updateTemplate(supabase, 'tmpl-1', { title: 'Atualizado' })
    expect(getChain('document_templates').update).toHaveBeenCalledWith({ title: 'Atualizado' })
  })

  it('atualiza status', async () => {
    const { supabase, getChain } = createMockSupabase({
      document_templates: { data: null, error: null },
    })
    await (await import('../documentos')).updateTemplateStatus(supabase, 'tmpl-1', 'aprovado')
    expect(getChain('document_templates').update).toHaveBeenCalledWith({ status: 'aprovado' })
  })
})

describe('deleteTemplate', () => {
  it('deleta template', async () => {
    const { supabase, getChain } = createMockSupabase()
    await (await import('../documentos')).deleteTemplate(supabase, 'tmpl-1')
    expect(getChain('document_templates').delete).toHaveBeenCalled()
    expect(getChain('document_templates').eq).toHaveBeenCalledWith('id', 'tmpl-1')
  })
})

describe('toggleFavorite / listFavorites', () => {
  it('adiciona favorito quando não existe', async () => {
    const { supabase, getChain } = createMockSupabase()
    getChain('template_favorites').maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    await (await import('../documentos')).toggleFavorite(supabase, 'tmpl-1')
    expect(getChain('template_favorites').insert).toHaveBeenCalledWith({ template_id: 'tmpl-1', user_id: 'user-1' })
  })

  it('remove favorito quando já existe', async () => {
    const { supabase, getChain } = createMockSupabase()
    getChain('template_favorites').maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'fav-1' }, error: null })
    await (await import('../documentos')).toggleFavorite(supabase, 'tmpl-1')
    expect(getChain('template_favorites').delete).toHaveBeenCalled()
  })

  it('lista favoritos', async () => {
    const { supabase } = createMockSupabase({
      template_favorites: { data: [{ template_id: 'tmpl-1' }], error: null },
    })
    const result = await (await import('../documentos')).listFavorites(supabase)
    expect(result.data).toHaveLength(1)
  })
})

describe('listVersions', () => {
  it('lista versões', async () => {
    const { supabase, getChain } = createMockSupabase({
      template_versions: { data: [{ id: 'ver-1', version_number: 1 }], error: null },
    })
    const result = await (await import('../documentos')).listVersions(supabase, 'tmpl-1')
    expect(getChain('template_versions').eq).toHaveBeenCalledWith('template_id', 'tmpl-1')
    expect(result.data).toHaveLength(1)
  })
})

describe('createVersion', () => {
  it('cria nova versão com número incremental', async () => {
    const { supabase, getChain } = createMockSupabase()
    getChain('template_versions').select = vi.fn().mockReturnThis()
    getChain('template_versions').eq = vi.fn().mockReturnThis()
    getChain('template_versions').order = vi.fn().mockReturnThis()
    getChain('template_versions').limit = vi.fn().mockReturnThis()
    getChain('template_versions').single = vi.fn().mockResolvedValue({ data: { version_number: 2 }, error: null })
    const result = await (await import('../documentos')).createVersion(supabase, 'tmpl-1', {
      conteudo: 'novo conteúdo', resumo_alteracao: 'Ajustes',
    })
    expect(getChain('template_versions').insert).toHaveBeenCalledWith(expect.objectContaining({ version_number: 3 }))
  })
})

describe('approveVersion', () => {
  it('aprova versão e marca como vigente', async () => {
    const { supabase, getChain } = createMockSupabase()
    const verChain = getChain('template_versions')
    const docChain = getChain('document_templates')

    verChain.update = vi.fn().mockReturnThis()
    verChain.eq = vi.fn().mockReturnThis()
    verChain.select = vi.fn().mockReturnThis()
    verChain.single = vi.fn().mockResolvedValue({ data: { id: 'ver-1', template_id: 'tmpl-1' }, error: null })
    verChain.neq = vi.fn().mockReturnThis()

    docChain.update = vi.fn().mockReturnThis()
    docChain.eq = vi.fn().mockReturnThis()

    const result = await (await import('../documentos')).approveVersion(supabase, 'ver-1')
    expect(verChain.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'aprovado' }))
    expect(docChain.update).toHaveBeenCalledWith(expect.objectContaining({ versao_vigente_id: 'ver-1' }))
    expect(result.id).toBe('ver-1')
  })
})

describe('generateDocument', () => {
  it('gera documento com substituição de placeholders', async () => {
    const { supabase, chains } = createMockSupabase()

    const version = {
      id: 'ver-1',
      template_id: 'tmpl-1',
      version_number: 1,
      conteudo: 'Processo [[ID_PROCESSO]] - Valor [[VALOR_ESTIMADO]]',
      status: 'aprovado',
      document_templates: { title: 'Edital', tipo_documento: 'edital' },
    }

    const processo = {
      id: 'proc-1',
      id_processo: '2026.0001',
      objeto_resumido: 'Aquisição',
      valor_estimado: 50000,
      coordenacoes: { nome: 'Licitações' },
      status_processo: { nome: 'Em andamento' },
      responsaveis: { nome: 'João' },
      demandantes: { nome: 'Compras' },
      modalidades: { nome: 'Pregão' },
    }

    chains.set('template_versions', createChain({ data: version, error: null }))
    chains.set('processos', createChain({ data: processo, error: null }))
    chains.set('template_placeholders', createChain({
      data: [
        { placeholder: 'ID_PROCESSO', coluna_origem: 'id_processo', json_extract_path: null },
        { placeholder: 'VALOR_ESTIMADO', coluna_origem: 'valor_estimado', json_extract_path: null },
        { placeholder: 'ANO_PROCESSO', coluna_origem: 'id_processo', json_extract_path: null },
      ],
      error: null,
    }))
    chains.set('document_generated', createChain({ data: { id: 'doc-1', conteudo_gerado: '' }, error: null }))
    chains.set('template_usage_log', createChain({ data: null, error: null }))

    const doc = await (await import('../documentos')).generateDocument(supabase, 'proc-1', 'ver-1')
    expect(doc).not.toBeNull()
    expect(doc.id).toBe('doc-1')
  })

  it('lança erro para versão obsoleta', async () => {
    const { supabase, chains } = createMockSupabase()
    chains.set('template_versions', createChain({ data: { status: 'obsoleto' }, error: null }))
    await expect((await import('../documentos')).generateDocument(supabase, 'proc-1', 'ver-1'))
      .rejects.toThrow('Esta versão está obsoleta')
  })
})

describe('listGeneratedDocuments', () => {
  it('lista documentos de um processo', async () => {
    const { supabase, getChain } = createMockSupabase({
      document_generated: { data: [{ id: 'doc-1', titulo_documento: 'Edital - 2026.0001' }], error: null },
    })
    const result = await (await import('../documentos')).listGeneratedDocuments(supabase, 'proc-1')
    expect(getChain('document_generated').eq).toHaveBeenCalledWith('processo_id', 'proc-1')
    expect(result.data).toHaveLength(1)
  })
})

describe('getTemplateMetrics / getMostUsedTemplates', () => {
  it('retorna métricas', async () => {
    const { supabase, getChain } = createMockSupabase({
      vw_template_metrics: { data: [{ tipo_documento: 'edital', modelos_ativos: 5 }], error: null },
    })
    const result = await (await import('../documentos')).getTemplateMetrics(supabase)
    expect(getChain('vw_template_metrics').select).toHaveBeenCalled()
  })

  it('retorna templates mais usados', async () => {
    const { supabase, getChain } = createMockSupabase({
      template_usage_log: { data: [{ template_id: 'tmpl-1', document_templates: { title: 'Edital', tipo_documento: 'edital' }, count: 10 }], error: null },
    })
    const result = await (await import('../documentos')).getMostUsedTemplates(supabase, 5)
    expect(getChain('template_usage_log').eq).toHaveBeenCalledWith('acao', 'utilizou')
  })
})
