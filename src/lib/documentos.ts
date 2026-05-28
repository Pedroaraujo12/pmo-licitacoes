import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DocumentTemplate, TemplateVersion, TemplatePlaceholder,
  DocumentGenerated, TemplateMetric,
} from '@/types/documentos'
import { formatDateBR } from './utils'

async function getSessionUserId(supabase: SupabaseClient) {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user?.id ?? null
}

/* ─────────── MODELOS ─────────── */

export async function listTemplates(
  supabase: SupabaseClient,
  filters?: { tipo?: string; categoria?: string; status?: string; search?: string; limit?: number },
) {
  let query = supabase
    .from('document_templates')
    .select('*, profiles!document_templates_created_by_fkey(name)')
    .order('updated_at', { ascending: false })
    .limit(filters?.limit ?? 50)

  if (filters?.tipo) query = query.eq('tipo_documento', filters.tipo)
  if (filters?.categoria) query = query.eq('categoria', filters.categoria)
  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.search) {
    const { data } = await supabase.rpc('search_templates', { search_term: filters.search })
    return { data: data as DocumentTemplate[] | null, error: null }
  }

  return query as unknown as { data: DocumentTemplate[] | null; error: unknown }
}

export async function getTemplate(supabase: SupabaseClient, id: string) {
  return supabase
    .from('document_templates')
    .select('*, profiles!document_templates_created_by_fkey(name), versao_vigente:template_versions!document_templates_versao_vigente_id_fkey(*)')
    .eq('id', id)
    .single() as unknown as { data: DocumentTemplate | null; error: unknown }
}

export async function createTemplate(supabase: SupabaseClient, data: {
  title: string; tipo_documento: string; categoria: string
  base_legal?: string; sei_link?: string; descricao?: string; conteudo: string; tags?: string[]
}) {
  const userId = await getSessionUserId(supabase)
  if (!userId) throw new Error('Usuário não autenticado')

  const { data: template, error } = await supabase.from('document_templates').insert({
    title: data.title,
    tipo_documento: data.tipo_documento,
    categoria: data.categoria,
    base_legal: data.base_legal || null,
    sei_link: data.sei_link || null,
    descricao: data.descricao || null,
    conteudo: data.conteudo,
    tags: data.tags || [],
    created_by: userId,
    status: 'rascunho',
  }).select().single()

  if (error) throw error

  // Create initial version
  await supabase.from('template_versions').insert({
    template_id: template.id,
    version_number: 1,
    conteudo: data.conteudo,
    resumo_alteracao: 'Versão inicial',
    status: 'rascunho',
    author_id: userId,
  })

  return template
}

export async function updateTemplate(supabase: SupabaseClient, id: string, data: Partial<{
  title: string; tipo_documento: string; categoria: string
  base_legal: string; sei_link: string; descricao: string; conteudo: string; tags: string[]
}>) {
  return supabase.from('document_templates').update(data).eq('id', id)
}

export async function updateTemplateStatus(supabase: SupabaseClient, id: string, status: string) {
  return supabase.from('document_templates').update({ status }).eq('id', id)
}

export async function deleteTemplate(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from('document_templates').delete().eq('id', id)
  if (error) throw error
}

export async function toggleFavorite(supabase: SupabaseClient, templateId: string) {
  const userId = await getSessionUserId(supabase)
  if (!userId) throw new Error('Usuário não autenticado')

  const { data: existing } = await supabase
    .from('template_favorites')
    .select('id')
    .eq('template_id', templateId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    return supabase.from('template_favorites').delete().eq('id', existing.id)
  }
  return supabase.from('template_favorites').insert({ template_id: templateId, user_id: userId })
}

export async function listFavorites(supabase: SupabaseClient) {
  const userId = await getSessionUserId(supabase)
  if (!userId) return { data: null, error: 'Usuário não autenticado' }

  return supabase
    .from('template_favorites')
    .select('template_id')
    .eq('user_id', userId)
    .limit(100) as unknown as { data: { template_id: string }[] | null; error: unknown }
}

/* ─────────── VERSÕES ─────────── */

export async function listVersions(supabase: SupabaseClient, templateId: string) {
  return supabase
    .from('template_versions')
    .select('*, profiles!template_versions_author_id_fkey(name), profiles_aprovador:profiles!template_versions_aprovado_por_fkey(name)')
    .eq('template_id', templateId)
    .order('version_number', { ascending: false })
    .limit(50) as unknown as {
      data: TemplateVersion[] | null; error: unknown
    }
}

export async function createVersion(supabase: SupabaseClient, templateId: string, data: {
  conteudo: string; resumo_alteracao: string
}) {
  const userId = await getSessionUserId(supabase)
  if (!userId) throw new Error('Usuário não autenticado')

  const { data: last } = await supabase
    .from('template_versions')
    .select('version_number')
    .eq('template_id', templateId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single()

  const nextVersion = (last?.version_number || 0) + 1
  return supabase.from('template_versions').insert({
    template_id: templateId,
    version_number: nextVersion,
    conteudo: data.conteudo,
    resumo_alteracao: data.resumo_alteracao,
    status: 'rascunho',
    author_id: userId,
  }).select().single()
}

export async function approveVersion(
  supabase: SupabaseClient,
  versionId: string,
  observacoes?: string,
) {
  const userId = await getSessionUserId(supabase)
  if (!userId) throw new Error('Usuário não autenticado')

  const { data: version } = await supabase
    .from('template_versions')
    .update({
      status: 'aprovado',
      aprovado_por: userId,
      data_aprovacao: new Date().toISOString(),
      observacoes_aprovacao: observacoes || null,
    })
    .eq('id', versionId)
    .select()
    .single()

  if (version) {
    // Mark this version as vigente for the template
    await supabase.from('document_templates').update({
      versao_vigente_id: versionId,
      status: 'aprovado',
    }).eq('id', version.template_id)

    // Mark all other versions of this template as not vigente
    await supabase.from('template_versions')
      .update({ status: 'aprovado' })
      .eq('template_id', version.template_id)
      .neq('id', versionId)
      .eq('status', 'rascunho')
  }

  return version
}

export async function markVersionObsolete(supabase: SupabaseClient, versionId: string) {
  return supabase.from('template_versions').update({ status: 'obsoleto' }).eq('id', versionId)
}

/* ─────────── PLACEHOLDERS ─────────── */

export async function listPlaceholders(supabase: SupabaseClient) {
  return supabase
    .from('template_placeholders')
    .select('*')
    .order('placeholder')
    .limit(200) as unknown as { data: TemplatePlaceholder[] | null; error: unknown }
}

/* ─────────── GERAR DOCUMENTO ─────────── */

export async function generateDocument(
  supabase: SupabaseClient,
  processoId: string,
  templateVersionId: string,
) {
  const userId = await getSessionUserId(supabase)
  if (!userId) throw new Error('Usuário não autenticado')

  // 1. Buscar versão do modelo
  const { data: version, error: verr } = await supabase
    .from('template_versions')
    .select('*, document_templates!template_versions_template_id_fkey(title, tipo_documento)')
    .eq('id', templateVersionId)
    .single()

  if (verr || !version) throw new Error('Versão do modelo não encontrada')
  if (version.status === 'obsoleto') throw new Error('Esta versão está obsoleta')

  // 2. Buscar dados do processo com joins
  const { data: processo } = await supabase
    .from('processos')
    .select('*, coordenacoes(nome), status_processo(nome), responsaveis(nome), demandantes(nome), modalidades(nome)')
    .eq('id', processoId)
    .single()

  if (!processo) throw new Error('Processo não encontrado')

  // 3. Buscar mapeamento de placeholders
  const { data: placeholders } = await supabase
    .from('template_placeholders')
    .select('*')
    .limit(200)

  // 4. Extrair ano do número do processo
  let ano = ''
  const idNum = processo.id_processo || ''
  const anoMatch = idNum.match(/\/(\d{4})/)
  if (anoMatch) ano = anoMatch[1]

  // 5. Montar dicionário de substituição
  const dict: Record<string, string> = {}
  const phMap = placeholders || []

  for (const ph of phMap) {
    let value = ''

    if (ph.json_extract_path) {
      // Navegar por joins: ex "coordenacoes.nome"
      const parts = ph.json_extract_path.split('.')
      let obj: Record<string, unknown> = processo as unknown as Record<string, unknown>
      for (const part of parts) {
        if (obj && typeof obj === 'object') {
          const v = (obj as Record<string, unknown>)[part]
          if (v && typeof v === 'object') {
            obj = v as Record<string, unknown>
          } else {
            value = String(v ?? '')
            break
          }
        }
      }
    } else {
      const raw = (processo as Record<string, unknown>)[ph.coluna_origem]
      value = raw === null || raw === undefined ? '' : String(raw)
    }

    // Formatações especiais
    if (ph.placeholder === 'ANO_PROCESSO') value = ano
    if (ph.placeholder === 'VALOR_ESTIMADO' || ph.placeholder === 'VALOR_HOMOLOGADO' || ph.placeholder === 'DESPESA_EVITADA') {
      const num = Number(value)
      value = num ? num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''
    }
    if (ph.placeholder === 'HOUVE_RECURSO') {
      value = value?.toLowerCase() === 'sim' ? 'Sim' : value?.toLowerCase() === 'nao' ? 'Não' : value
    }
    if (ph.placeholder === 'DATA_ENTRADA' || ph.placeholder === 'DATA_ENTREGA') {
      value = value ? formatDateBR(value) : ''
    }

    dict[ph.placeholder] = value
  }

  // 6. Substituir placeholders no conteúdo
  let conteudo = version.conteudo
  for (const [key, val] of Object.entries(dict)) {
    conteudo = conteudo.replaceAll(`[[${key}]]`, val)
  }

  // 7. Salvar documento gerado
  const template = version.document_templates as unknown as { title: string; tipo_documento: string } | null
  const titulo = `${template?.tipo_documento?.replace('_', ' ')?.replace(/\b\w/g, c => c.toUpperCase()) || 'Documento'} - ${processo.id_processo || processoId}`

  const { data: doc, error: derr } = await supabase.from('document_generated').insert({
    processo_id: processoId,
    template_id: version.template_id,
    template_version_id: version.id,
    titulo_documento: titulo,
    conteudo_gerado: conteudo,
    created_by: userId,
  }).select().single()

  if (derr) throw derr

  // 8. Registrar uso no log
  await supabase.from('template_usage_log').insert({
    template_id: version.template_id,
    template_version_id: version.id,
    acao: 'utilizou',
    user_id: userId,
    processo_id: processoId,
    metadata: { titulo_documento: titulo },
  })

  return doc
}

export async function listGeneratedDocuments(supabase: SupabaseClient, processoId: string, limit = 50) {
  return supabase
    .from('document_generated')
    .select('*, document_templates!document_generated_template_id_fkey(title, tipo_documento), template_versions(version_number)')
    .eq('processo_id', processoId)
    .order('created_at', { ascending: false })
    .limit(limit) as unknown as {
      data: DocumentGenerated[] | null; error: unknown
    }
}

/* ─────────── MÉTRICAS ─────────── */

export async function getTemplateMetrics(supabase: SupabaseClient) {
  return supabase
    .from('vw_template_metrics')
    .select('*')
    .limit(100) as unknown as { data: TemplateMetric[] | null; error: unknown }
}

export async function getMostUsedTemplates(supabase: SupabaseClient, limit = 5) {
  return supabase
    .from('template_usage_log')
    .select('template_id, document_templates!template_usage_log_template_id_fkey(title, tipo_documento), count::int8')
    .eq('acao', 'utilizou')
    .order('count', { ascending: false })
    .limit(limit) as unknown as {
      data: { template_id: string; document_templates: { title: string; tipo_documento: string }; count: number }[] | null
      error: unknown
    }
}
