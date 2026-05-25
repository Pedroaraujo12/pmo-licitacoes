import type { ContratoAditivo } from '@/types/contratos'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function listAditivos(
  supabase: SupabaseClient,
  contratoId?: string,
  limit = 50,
): Promise<ContratoAditivo[]> {
  let query = supabase
    .from('contrato_aditivos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (contratoId) query = query.eq('contrato_id', contratoId)

  const { data } = await query
  return (data as ContratoAditivo[]) || []
}

export async function createAditivo(
  supabase: SupabaseClient,
  aditivo: Omit<ContratoAditivo, 'id' | 'created_at'>,
): Promise<ContratoAditivo | null> {
  const { data, error } = await supabase
    .from('contrato_aditivos')
    .insert(aditivo)
    .select()
    .single()

  if (error) throw error
  return data as ContratoAditivo | null
}

export async function updateAditivo(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<ContratoAditivo>,
): Promise<ContratoAditivo | null> {
  const { data, error } = await supabase
    .from('contrato_aditivos')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as ContratoAditivo | null
}

export async function deleteAditivo(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('contrato_aditivos').delete().eq('id', id)
  if (error) throw error
}
