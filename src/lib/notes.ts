import { createClient } from './supabase/client'
import type { Note, NoteInsert, NoteUpdate, NoteFilters, NoteCounts } from '@/types/notes'

async function getCurrentUserId() {
  const client = createClient()
  const { data: { session } } = await client.auth.getSession()
  return { client, userId: session?.user?.id ?? null }
}

export async function listNotes(filters: NoteFilters): Promise<Note[]> {
  const { client, userId } = await getCurrentUserId()
  if (!userId) return []

  const selectWithJoins = '*, processos!notes_processo_id_fkey(id_processo), colaboradores!notes_colaborador_id_fkey(nome_completo)'

  if (filters.search) {
    const { data, error } = await client.rpc('search_notes', {
      search_term: filters.search,
      p_user_id: userId,
    })
    if (error || !data) return []
    const notes = data as Note[]
    const pIds = notes.map(n => n.processo_id).filter(Boolean) as string[]
    const cIds = notes.map(n => n.colaborador_id).filter(Boolean) as string[]
    if (pIds.length) {
      const { data: pData } = await client.from('processos').select('id, id_processo').in('id', pIds)
      if (pData) {
        const map = Object.fromEntries((pData as { id: string; id_processo: string | null }[]).map(p => [p.id, p.id_processo]))
        for (const n of notes) {
          if (n.processo_id) (n as Note & { processos: { id_processo: string | null } }).processos = { id_processo: map[n.processo_id] ?? null }
        }
      }
    }
    if (cIds.length) {
      const { data: cData } = await client.from('colaboradores').select('id, nome_completo').in('id', cIds)
      if (cData) {
        const map = Object.fromEntries((cData as { id: string; nome_completo: string }[]).map(c => [c.id, c.nome_completo]))
        for (const n of notes) {
          if (n.colaborador_id) (n as Note & { colaboradores: { nome_completo: string | null } }).colaboradores = { nome_completo: map[n.colaborador_id] ?? null }
        }
      }
    }
    return notes
  }

  let query = client
    .from('notes')
    .select(selectWithJoins)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (filters.status === 'ativa' || !filters.status || filters.status === 'todas') {
    if (filters.status === 'ativa') query = query.eq('status', 'ativa')
  } else if (filters.status === 'arquivada') {
    query = query.eq('status', 'arquivada')
  }

  if (filters.priority) {
    query = query.eq('priority', filters.priority)
  }

  if (filters.tag) {
    query = query.contains('tags', [filters.tag])
  }

  if (filters.destacado) {
    query = query.eq('destacado', true)
  }

  if (filters.dateRange === 'hoje') {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    query = query.gte('created_at', today.toISOString())
  } else if (filters.dateRange === '7d') {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    d.setHours(0, 0, 0, 0)
    query = query.gte('created_at', d.toISOString())
  } else if (filters.dateRange === '30d') {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    d.setHours(0, 0, 0, 0)
    query = query.gte('created_at', d.toISOString())
  }

  const { data } = await query.limit(50)
  return (data ?? []) as Note[]
}

export async function getNote(id: string): Promise<Note | null> {
  const { client, userId } = await getCurrentUserId()
  if (!userId) return null

  const { data } = await client
    .from('notes')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  return data as Note | null
}

export async function createNote(note: NoteInsert): Promise<Note | null> {
  const { client, userId } = await getCurrentUserId()
  if (!userId) return null

  const { data, error } = await client
    .from('notes')
    .insert({ ...note, user_id: userId })
    .select()
    .single()

  if (error) throw error
  return data as Note | null
}

export async function updateNote(id: string, updates: NoteUpdate): Promise<Note | null> {
  const { client, userId } = await getCurrentUserId()
  if (!userId) return null

  const { data, error } = await client
    .from('notes')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error
  return data as Note | null
}

export async function archiveNote(id: string): Promise<void> {
  const { client, userId } = await getCurrentUserId()
  if (!userId) return

  await client
    .from('notes')
    .update({ status: 'arquivada' })
    .eq('id', id)
    .eq('user_id', userId)
}

export async function unarchiveNote(id: string): Promise<void> {
  const { client, userId } = await getCurrentUserId()
  if (!userId) return

  await client
    .from('notes')
    .update({ status: 'ativa' })
    .eq('id', id)
    .eq('user_id', userId)
}

export async function deleteNote(id: string): Promise<void> {
  const { client, userId } = await getCurrentUserId()
  if (!userId) return

  await client
    .from('notes')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
}

export async function getNoteCounts(): Promise<NoteCounts> {
  const { client, userId } = await getCurrentUserId()
  if (!userId) return { active: 0, today: 0, high_priority: 0 }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString()

  const [activeRes, todayRes, highRes] = await Promise.all([
    client.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'ativa'),
    client.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'ativa').lte('reminder_at', tomorrowStr).gte('reminder_at', todayStr),
    client.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'ativa').eq('priority', 'alta'),
  ])

  return {
    active: activeRes.count ?? 0,
    today: todayRes.count ?? 0,
    high_priority: highRes.count ?? 0,
  }
}

export async function getTodayNotes(): Promise<Note[]> {
  const { client, userId } = await getCurrentUserId()
  if (!userId) return []

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const { data } = await client
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'ativa')
    .or(`priority.eq.alta,destacado.eq.true,reminder_at.gte.${today.toISOString()},reminder_at.lt.${tomorrow.toISOString()},tags.cs.{Hoje}`)
    .order('priority', { ascending: false })
    .order('reminder_at', { ascending: true })
    .limit(10)

  return (data ?? []) as Note[]
}

export async function getNotesByProcesso(processoId: string): Promise<Note[]> {
  const { client, userId } = await getCurrentUserId()
  if (!userId) return []

  const { data } = await client
    .from('notes')
    .select('id, title, content, priority, destacado, reminder_at, tags, created_at, processo_id, colaborador_id')
    .eq('user_id', userId)
    .eq('processo_id', processoId)
    .eq('status', 'ativa')
    .order('created_at', { ascending: false })
    .limit(20)

  return (data ?? []) as Note[]
}

export async function getNotesByColaborador(colaboradorId: string): Promise<Note[]> {
  const { client, userId } = await getCurrentUserId()
  if (!userId) return []

  const { data } = await client
    .from('notes')
    .select('id, title, content, priority, destacado, reminder_at, tags, created_at, processo_id, colaborador_id')
    .eq('user_id', userId)
    .eq('colaborador_id', colaboradorId)
    .eq('status', 'ativa')
    .order('created_at', { ascending: false })
    .limit(20)

  return (data ?? []) as Note[]
}
