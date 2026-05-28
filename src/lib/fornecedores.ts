import type { SupabaseClient } from '@supabase/supabase-js'
import type { FornecedorResumo, FornecedorContrato } from '@/types/fornecedores'

export async function listFornecedores(
  supabase: SupabaseClient,
  filters?: { search?: string },
): Promise<FornecedorResumo[]> {
  let query = supabase
    .from('contratos')
    .select('contratada_nome, contratada_cnpj, contratada_representante, contratada_email, contratada_telefone, valor_atual, valor_executado, data_inicio_vigencia, data_fim_vigencia')
    .not('contratada_nome', 'is', null)
    .neq('contratada_nome', '')
    .order('contratada_nome', { ascending: true })

  if (filters?.search) {
    query = query.or(
      `contratada_nome.ilike.%${filters.search}%,contratada_cnpj.ilike.%${filters.search}%,contratada_representante.ilike.%${filters.search}%`,
    )
  }

  const { data } = await query
  if (!data) return []

  const map = new Map<string, FornecedorResumo>()
  for (const row of data as Record<string, unknown>[]) {
    const nome = String(row.contratada_nome ?? '')
    if (!nome) continue

    const existing = map.get(nome)
    const valorAtual = Number(row.valor_atual ?? 0)
    const valorExecutado = Number(row.valor_executado ?? 0)

    if (existing) {
      existing.total_contratos += 1
      existing.valor_total += valorAtual
      existing.valor_executado += valorExecutado
      if (row.data_inicio_vigencia && (!existing.primeiro_contrato || String(row.data_inicio_vigencia) < existing.primeiro_contrato)) {
        existing.primeiro_contrato = String(row.data_inicio_vigencia)
      }
      if (row.data_fim_vigencia && (!existing.ultimo_vencimento || String(row.data_fim_vigencia) > existing.ultimo_vencimento)) {
        existing.ultimo_vencimento = String(row.data_fim_vigencia)
      }
    } else {
      map.set(nome, {
        nome,
        cnpj: row.contratada_cnpj ? String(row.contratada_cnpj) : null,
        representante: row.contratada_representante ? String(row.contratada_representante) : null,
        email: row.contratada_email ? String(row.contratada_email) : null,
        telefone: row.contratada_telefone ? String(row.contratada_telefone) : null,
        total_contratos: 1,
        valor_total: valorAtual,
        valor_executado: valorExecutado,
        primeiro_contrato: row.data_inicio_vigencia ? String(row.data_inicio_vigencia) : null,
        ultimo_vencimento: row.data_fim_vigencia ? String(row.data_fim_vigencia) : null,
      })
    }
  }

  return Array.from(map.values())
}

export async function getFornecedorContratos(
  supabase: SupabaseClient,
  nome: string,
): Promise<FornecedorContrato[]> {
  const { data } = await supabase
    .from('contratos')
    .select('id, numero_contrato, objeto, valor_atual, valor_executado, status, data_inicio_vigencia, data_fim_vigencia')
    .eq('contratada_nome', nome)
    .order('created_at', { ascending: false })

  if (!data) return []
  return (data as FornecedorContrato[]) || []
}

export async function getFornecedor(
  supabase: SupabaseClient,
  nome: string,
): Promise<{ resumo: FornecedorResumo | null; contratos: FornecedorContrato[] }> {
  const contratos = await getFornecedorContratos(supabase, nome)
  if (contratos.length === 0) return { resumo: null, contratos: [] }

  const primeiro = contratos[contratos.length - 1]
  const resumo: FornecedorResumo = {
    nome,
    cnpj: null,
    representante: null,
    email: null,
    telefone: null,
    total_contratos: contratos.length,
    valor_total: contratos.reduce((s, c) => s + (c.valor_atual || 0), 0),
    valor_executado: contratos.reduce((s, c) => s + (c.valor_executado || 0), 0),
    primeiro_contrato: primeiro?.data_inicio_vigencia || null,
    ultimo_vencimento: contratos.reduce((latest, c) =>
      c.data_fim_vigencia && (!latest || c.data_fim_vigencia > latest) ? c.data_fim_vigencia : latest,
      null as string | null,
    ),
  }

  const { data } = await supabase
    .from('contratos')
    .select('contratada_cnpj, contratada_representante, contratada_email, contratada_telefone')
    .eq('contratada_nome', nome)
    .limit(1)
    .maybeSingle()

  if (data) {
    const row = data as Record<string, unknown>
    resumo.cnpj = row.contratada_cnpj ? String(row.contratada_cnpj) : null
    resumo.representante = row.contratada_representante ? String(row.contratada_representante) : null
    resumo.email = row.contratada_email ? String(row.contratada_email) : null
    resumo.telefone = row.contratada_telefone ? String(row.contratada_telefone) : null
  }

  return { resumo, contratos }
}
