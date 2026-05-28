/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NoteFilters } from '@/types/notes'

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

const fakeClient = {
  from: vi.fn(),
  rpc: vi.fn(),
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
  },
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => fakeClient),
}))

const mockNote = {
  id: 'note-1',
  user_id: 'user-1',
  title: 'Reunião hoje',
  content: 'Preparar pauta',
  priority: 'alta' as const,
  status: 'ativa' as const,
  destacado: false,
  compartilhada: false,
  reminder_at: '2026-05-23T10:00:00Z',
  tags: ['Hoje'],
  processo_id: null,
  colaborador_id: null,
  created_at: '2026-05-22T00:00:00Z',
  updated_at: '2026-05-22T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  fakeClient.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  fakeClient.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null })
})

describe('listNotes', () => {
  async function testListNotes(filters: NoteFilters) {
    const { listNotes } = await import('../notes')
    return listNotes(filters)
  }

  it('retorna lista sem filtros', async () => {
    const chain = createChain({ data: [mockNote], error: null })
    fakeClient.from.mockReturnValue(chain)
    const result = await testListNotes({})
    expect(fakeClient.from).toHaveBeenCalledWith('notes')
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Reunião hoje')
  })

  it('usa RPC quando search é fornecido', async () => {
    fakeClient.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    fakeClient.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null })
    const notesChain = createChain({ data: [], error: null })
    fakeClient.rpc.mockResolvedValue({ data: [mockNote], error: null })
    fakeClient.from.mockReturnValue(notesChain)
    const processosChain = createChain({ data: [], error: null })
    fakeClient.from.mockReturnValue(processosChain)
    const result = await testListNotes({ search: 'Reunião' })
    expect(fakeClient.rpc).toHaveBeenCalledWith('search_notes', { search_term: 'Reunião', p_user_id: 'user-1' })
    expect(result).toHaveLength(1)
  })

  it('filtra por status ativa', async () => {
    const chain = createChain({ data: [mockNote], error: null })
    fakeClient.from.mockReturnValue(chain)
    await testListNotes({ status: 'ativa' })
    expect(chain.eq).toHaveBeenCalledWith('status', 'ativa')
  })

  it('filtra por status arquivada', async () => {
    const chain = createChain({ data: [mockNote], error: null })
    fakeClient.from.mockReturnValue(chain)
    await testListNotes({ status: 'arquivada' })
    expect(chain.eq).toHaveBeenCalledWith('status', 'arquivada')
  })

  it('filtra por prioridade', async () => {
    const chain = createChain({ data: [mockNote], error: null })
    fakeClient.from.mockReturnValue(chain)
    await testListNotes({ priority: 'alta' })
    expect(chain.eq).toHaveBeenCalledWith('priority', 'alta')
  })

  it('filtra por tag', async () => {
    const chain = createChain({ data: [mockNote], error: null })
    fakeClient.from.mockReturnValue(chain)
    await testListNotes({ tag: 'Hoje' })
    expect(chain.contains).toHaveBeenCalledWith('tags', ['Hoje'])
  })

  it('filtra por destacado', async () => {
    const chain = createChain({ data: [mockNote], error: null })
    fakeClient.from.mockReturnValue(chain)
    await testListNotes({ destacado: true })
    expect(chain.eq).toHaveBeenCalledWith('destacado', true)
  })

  it('filtra por dateRange hoje', async () => {
    const chain = createChain({ data: [mockNote], error: null })
    fakeClient.from.mockReturnValue(chain)
    await testListNotes({ dateRange: 'hoje' })
    expect(chain.gte).toHaveBeenCalled()
  })

  it('retorna [] se não autenticado', async () => {
    fakeClient.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'no user' } })
    fakeClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: { message: 'no user' } })
    const result = await testListNotes({})
    expect(result).toEqual([])
  })
})

describe('getNote', () => {
  async function testGetNote(id: string) {
    const { getNote } = await import('../notes')
    return getNote(id)
  }

  it('retorna nota por id', async () => {
    const chain = createChain({ data: mockNote, error: null })
    fakeClient.from.mockReturnValue(chain)
    const result = await testGetNote('note-1')
    expect(chain.eq).toHaveBeenCalledWith('id', 'note-1')
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(result?.title).toBe('Reunião hoje')
  })

  it('retorna null se não autenticado', async () => {
    fakeClient.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'no user' } })
    fakeClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: { message: 'no user' } })
    const result = await testGetNote('note-1')
    expect(result).toBeNull()
  })
})

describe('createNote', () => {
  async function testCreateNote() {
    const { createNote } = await import('../notes')
    return createNote({ title: 'Nova nota', content: 'Conteúdo' })
  }

  it('cria nota', async () => {
    const chain = createChain({ data: mockNote, error: null })
    fakeClient.from.mockReturnValue(chain)
    const result = await testCreateNote()
    expect(chain.insert).toHaveBeenCalledWith({ title: 'Nova nota', content: 'Conteúdo', user_id: 'user-1' })
    expect(result).not.toBeNull()
  })
})

describe('updateNote', () => {
  async function testUpdateNote() {
    const { updateNote } = await import('../notes')
    return updateNote('note-1', { title: 'Atualizada' })
  }

  it('atualiza nota', async () => {
    const chain = createChain({ data: { ...mockNote, title: 'Atualizada' }, error: null })
    fakeClient.from.mockReturnValue(chain)
    const result = await testUpdateNote()
    expect(chain.update).toHaveBeenCalledWith({ title: 'Atualizada' })
    expect(chain.eq).toHaveBeenCalledWith('id', 'note-1')
  })
})

describe('archiveNote / unarchiveNote', () => {
  async function testArchive(id: string) {
    const { archiveNote } = await import('../notes')
    return archiveNote(id)
  }

  async function testUnarchive(id: string) {
    const { unarchiveNote } = await import('../notes')
    return unarchiveNote(id)
  }

  it('arquiva nota', async () => {
    const chain = createChain({ data: null, error: null })
    fakeClient.from.mockReturnValue(chain)
    await testArchive('note-1')
    expect(chain.update).toHaveBeenCalledWith({ status: 'arquivada' })
  })

  it('desarquiva nota', async () => {
    const chain = createChain({ data: null, error: null })
    fakeClient.from.mockReturnValue(chain)
    await testUnarchive('note-1')
    expect(chain.update).toHaveBeenCalledWith({ status: 'ativa' })
  })
})

describe('deleteNote', () => {
  async function testDeleteNote(id: string) {
    const { deleteNote } = await import('../notes')
    return deleteNote(id)
  }

  it('deleta nota', async () => {
    const chain = createChain({ data: null, error: null })
    fakeClient.from.mockReturnValue(chain)
    await testDeleteNote('note-1')
    expect(chain.delete).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('id', 'note-1')
  })
})

describe('getNoteCounts', () => {
  async function testGetNoteCounts() {
    const { getNoteCounts } = await import('../notes')
    return getNoteCounts()
  }

  it('retorna contagens', async () => {
    const makeCountQuery = () => {
      const q = createChain({ data: null, error: null, count: 5 })
      q.select = vi.fn().mockReturnValue(q)
      q.eq = vi.fn().mockReturnValue(q)
      q.lte = vi.fn().mockReturnValue(q)
      q.gte = vi.fn().mockReturnValue(q)
      return q
    }
    fakeClient.from.mockReturnValue(makeCountQuery())
    const result = await testGetNoteCounts()
    expect(result.active).toBe(5)
  })
})

describe('getTodayNotes', () => {
  async function testGetTodayNotes() {
    const { getTodayNotes } = await import('../notes')
    return getTodayNotes()
  }

  it('retorna notas do dia', async () => {
    const chain = createChain({ data: [mockNote], error: null })
    fakeClient.from.mockReturnValue(chain)
    const result = await testGetTodayNotes()
    expect(chain.or).toHaveBeenCalled()
    expect(result).toHaveLength(1)
  })
})

describe('getNotesByProcesso / getNotesByColaborador', () => {
  async function testByProcesso(id: string) {
    const { getNotesByProcesso } = await import('../notes')
    return getNotesByProcesso(id)
  }

  async function testByColaborador(id: string) {
    const { getNotesByColaborador } = await import('../notes')
    return getNotesByColaborador(id)
  }

  it('retorna notas por processo', async () => {
    const chain = createChain({ data: [mockNote], error: null })
    fakeClient.from.mockReturnValue(chain)
    const result = await testByProcesso('proc-1')
    expect(chain.eq).toHaveBeenCalledWith('processo_id', 'proc-1')
    expect(result).toHaveLength(1)
  })

  it('retorna notas por colaborador', async () => {
    const chain = createChain({ data: [mockNote], error: null })
    fakeClient.from.mockReturnValue(chain)
    const result = await testByColaborador('colab-1')
    expect(chain.eq).toHaveBeenCalledWith('colaborador_id', 'colab-1')
    expect(result).toHaveLength(1)
  })
})
