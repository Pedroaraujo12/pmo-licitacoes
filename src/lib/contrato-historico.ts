import type { SupabaseClient } from '@supabase/supabase-js'

export async function logHistorico(
  supabase: SupabaseClient,
  params: {
    contrato_id: string
    entidade: string
    entidade_id?: string | null
    acao: string
    descricao?: string | null
    valor_anterior?: string | null
    valor_novo?: string | null
    created_by?: string | null
  },
) {
  try {
    await supabase.from('contrato_historico').insert({
      contrato_id: params.contrato_id,
      entidade: params.entidade,
      entidade_id: params.entidade_id ?? null,
      acao: params.acao,
      descricao: params.descricao ?? null,
      valor_anterior: params.valor_anterior ?? null,
      valor_novo: params.valor_novo ?? null,
      created_by: params.created_by ?? null,
    })
  } catch {
    // Logging de histórico não deve quebrar a operação principal
  }
}
