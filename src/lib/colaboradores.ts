import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Colaborador, ColaboradorAniversariante, ColaboradorFavorito,
  SituacaoFuncional, RegimeColaborador,
} from '@/types/colaboradores'

type ColaboradorInput = {
  nome_completo: string
  cpf?: string
  matricula?: string
  sexo?: string
  data_nascimento: string
  cargo?: string
  funcao?: string
  unidade?: string
  lotacao?: string
  regime?: RegimeColaborador
  data_admissao?: string
  situacao?: SituacaoFuncional
  email_institucional?: string
  telefone_institucional?: string
  ramal?: string
  email_pessoal?: string
  celular?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
  cep?: string
  foto_url?: string
  observacoes?: string
}

/* ─────────── CRUD ─────────── */

export async function listColaboradores(
  supabase: SupabaseClient,
  filters?: {
    search?: string
    unidade?: string
    cargo?: string
    situacao?: string
    regime?: string
    limit?: number
  },
) {
  if (filters?.search) {
    const { data, error } = await supabase.rpc('search_colaboradores', { search_term: filters.search })
    if (error) return { data: null, error }
    return { data: data as Colaborador[] | null, error: null }
  }

  let query = supabase
    .from('colaboradores')
    .select('*, created_by:profiles!colaboradores_created_by_fkey(name), updated_by:profiles!colaboradores_updated_by_fkey(name)')
    .order('nome_completo', { ascending: true })
    .limit(filters?.limit ?? 200)

  if (filters?.unidade) query = query.eq('unidade', filters.unidade)
  if (filters?.cargo) query = query.eq('cargo', filters.cargo)
  if (filters?.situacao) query = query.eq('situacao', filters.situacao)
  if (filters?.regime) query = query.eq('regime', filters.regime)

  return query as unknown as { data: Colaborador[] | null; error: unknown }
}

export async function getColaborador(supabase: SupabaseClient, id: string) {
  return supabase
    .from('colaboradores')
    .select('*, created_by:profiles!colaboradores_created_by_fkey(name), updated_by:profiles!colaboradores_updated_by_fkey(name)')
    .eq('id', id)
    .single() as unknown as { data: Colaborador | null; error: unknown }
}

export async function createColaborador(supabase: SupabaseClient, data: ColaboradorInput) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado')

  const { data: colaborador, error } = await supabase.from('colaboradores').insert({
    nome_completo: data.nome_completo,
    cpf: data.cpf || null,
    matricula: data.matricula || null,
    sexo: data.sexo || 'Nao_informado',
    data_nascimento: data.data_nascimento,
    cargo: data.cargo || null,
    funcao: data.funcao || null,
    unidade: data.unidade || null,
    lotacao: data.lotacao || null,
    regime: data.regime || 'efetivo',
    data_admissao: data.data_admissao || null,
    situacao: data.situacao || 'ativo',
    email_institucional: data.email_institucional || null,
    telefone_institucional: data.telefone_institucional || null,
    ramal: data.ramal || null,
    email_pessoal: data.email_pessoal || null,
    celular: data.celular || null,
    logradouro: data.logradouro || null,
    numero: data.numero || null,
    complemento: data.complemento || null,
    bairro: data.bairro || null,
    cidade: data.cidade || null,
    uf: data.uf || null,
    cep: data.cep || null,
    foto_url: data.foto_url || null,
    observacoes: data.observacoes || null,
    created_by: user.id,
    updated_by: user.id,
  }).select().single()

  if (error) throw error
  return colaborador as Colaborador
}

export async function updateColaborador(supabase: SupabaseClient, id: string, data: Partial<ColaboradorInput>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado')

  const { data: colaborador, error } = await supabase.from('colaboradores').update({
    ...data,
    updated_by: user.id,
  }).eq('id', id).select().single()

  if (error) throw error
  return colaborador as Colaborador
}

export async function deleteColaborador(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from('colaboradores').delete().eq('id', id)
  if (error) throw error
}

/* ─────────── VINCULAÇÃO COM USUÁRIO ─────────── */

export async function vincularUsuario(
  supabase: SupabaseClient,
  colaboradorId: string,
  userId: string,
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado')

  const { data, error } = await supabase.from('colaboradores').update({
    user_id: userId,
    updated_by: user.id,
  }).eq('id', colaboradorId).select().single()

  if (error) throw error
  return data as Colaborador
}

export async function desvincularUsuario(supabase: SupabaseClient, colaboradorId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado')

  const { data, error } = await supabase.from('colaboradores').update({
    user_id: null,
    updated_by: user.id,
  }).eq('id', colaboradorId).select().single()

  if (error) throw error
  return data as Colaborador
}

export async function getColaboradorByUserId(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('colaboradores')
    .select('*, created_by:profiles!colaboradores_created_by_fkey(name), updated_by:profiles!colaboradores_updated_by_fkey(name)')
    .eq('user_id', userId)
    .maybeSingle() as unknown as { data: Colaborador | null; error: unknown }
  return data
}

export async function listUsersWithoutColaborador(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado')

  const { data: allUsers } = await supabase.from('profiles').select('id, name, email, role').limit(500)
  if (!allUsers) return []

  const { data: colaboradores } = await supabase.from('colaboradores').select('user_id').limit(500)
  const linkedUserIds = new Set((colaboradores || []).map(c => c.user_id).filter(Boolean))

  return allUsers.filter(u => !linkedUserIds.has(u.id))
}

/* ─────────── FAVORITOS ─────────── */

export async function listFavoritos(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado')

  const { data } = await supabase
    .from('colaborador_favoritos')
    .select('*, colaboradores!colaborador_favoritos_colaborador_id_fkey(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  return (data || []) as unknown as (ColaboradorFavorito & { colaboradores: Colaborador })[]
}

export async function toggleFavorito(supabase: SupabaseClient, colaboradorId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado')

  const existing = await supabase
    .from('colaborador_favoritos')
    .select('id')
    .eq('colaborador_id', colaboradorId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing.data) {
    const { error } = await supabase.from('colaborador_favoritos').delete().eq('id', existing.data.id)
    if (error) throw error
    return false
  }

  const { error } = await supabase.from('colaborador_favoritos').insert({
    colaborador_id: colaboradorId,
    user_id: user.id,
  })
  if (error) throw error
  return true
}

export async function isFavorito(supabase: SupabaseClient, colaboradorId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from('colaborador_favoritos')
    .select('id')
    .eq('colaborador_id', colaboradorId)
    .eq('user_id', user.id)
    .maybeSingle()

  return !!data
}

/* ─────────── ANIVERSARIANTES ─────────── */

export async function listAniversariantes(
  supabase: SupabaseClient,
  periodo?: 'hoje' | 'essa_semana' | 'esse_mes',
  unidade?: string,
  limit = 100,
) {
  let query = supabase
    .from('vw_aniversariantes')
    .select('*')
    .neq('periodo_aniversario', 'outro')
    .order('dia_nascimento', { ascending: true })
    .limit(limit)

  if (periodo) query = query.eq('periodo_aniversario', periodo)
  if (unidade) query = query.eq('unidade', unidade)

  const { data } = await query as unknown as { data: ColaboradorAniversariante[] | null; error: unknown }
  return data || []
}

export async function getMetricas(supabase: SupabaseClient) {
  const { data } = await supabase.from('vw_colaboradores_metricas').select('*').single()
  return data as {
    ativos: number
    afastados: number
    desligados: number
    total: number
    unidades_distintas: number
    efetivos: number
    comissionados: number
    terceirizados: number
    estagiarios: number
    cedidos: number
  } | null
}

/* ─────────── PROCESSOS DO COLABORADOR ─────────── */

export async function listProcessosColaborador(supabase: SupabaseClient, colaboradorId: string) {
  const { data: colab } = await supabase.from('colaboradores').select('user_id, nome_completo').eq('id', colaboradorId).single()
  if (!colab) return { processos: [], nome: '' }

  const nome = colab.nome_completo
  const userId = colab.user_id

  // Find responsaveis linked to this colaborador
  const { data: responsaveis } = await supabase
    .from('responsaveis')
    .select('id')
    .eq('colaborador_id', colaboradorId)

  const responsavelIds = (responsaveis || []).map(r => r.id)

  // Processos where the colaborador is the responsavel via the responsaveis table
  // or where the colaborador's user created the processo
  let query = supabase
    .from('processos')
    .select('id, id_processo, objeto_resumido, data_entrada, data_entrega, modalidade_id, status_id, modalidades(nome), status_processo(nome)')
    .order('data_entrada', { ascending: false })
    .limit(100)

  if (responsavelIds.length > 0 && userId) {
    query = query.or(`responsavel_id.in.(${responsavelIds.join(',')}),created_by.eq.${userId}`)
  } else if (responsavelIds.length > 0) {
    query = query.in('responsavel_id', responsavelIds)
  } else if (userId) {
    query = query.eq('created_by', userId)
  } else {
    return { processos: [], nome }
  }

  const [procResp, procCrono] = await Promise.all([
    query,
    responsavelIds.length > 0
      ? supabase.from('cronograma_atividades')
          .select('processo_id, atividade, status, processos!cronograma_atividades_processo_id_fkey(id, id_processo, objeto_resumido, data_entrada)')
          .in('responsavel_id', responsavelIds)
          .order('processo_id', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
  ])

  const allProcessos = (procResp.data || []) as Array<Record<string, unknown>>
  const viaCrono = ((procCrono as { data?: Array<{ processos: Record<string, unknown> }> }).data || []).map(c => c.processos).filter((v: unknown): v is Record<string, unknown> => !!v)
  const seen = new Set<string>()
  for (const p of allProcessos) {
    const id = String(p.id ?? '')
    if (id) seen.add(id)
  }
  for (const p of viaCrono) {
    const id = String(p.id ?? '')
    if (id && !seen.has(id)) {
      allProcessos.push(p)
      seen.add(id)
    }
  }

  return { processos: allProcessos, nome }
}

/* ─────────── UNIDADES E CARGOS (para filtros) ─────────── */

export async function listUnidades(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('colaboradores')
    .select('unidade')
    .not('unidade', 'is', null)
    .order('unidade', { ascending: true })
    .limit(200)
  return [...new Set((data || []).map(r => r.unidade).filter(Boolean))] as string[]
}

export async function listCargos(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('colaboradores')
    .select('cargo')
    .not('cargo', 'is', null)
    .order('cargo', { ascending: true })
    .limit(200)
  return [...new Set((data || []).map(r => r.cargo).filter(Boolean))] as string[]
}
