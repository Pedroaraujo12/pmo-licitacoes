import type { SupabaseClient } from '@supabase/supabase-js'
import { ehRegistroDeSistema } from './registro-atividades'

/**
 * Edição de uma anotação de "Registrar Atividade".
 *
 * A política de UPDATE em `atividades` só libera admin e gestor. Quem não
 * tem o papel recebe do PostgREST um 200 com zero linhas — sem erro. Por
 * isso toda gravação aqui pede `.select()` de volta e trata resultado vazio
 * como falha: a tela não pode dizer "salvo" sobre algo que não gravou.
 */

export const PAPEIS_QUE_EDITAM = ['admin', 'gestor']

export function podeEditarRegistro(papel: string | null | undefined): boolean {
  return !!papel && PAPEIS_QUE_EDITAM.includes(papel)
}

export interface EdicaoRegistro {
  atividade: string
  observacao: string
}

export interface RegistroSalvo {
  id: string
  atividade: string
  observacao: string | null
}

export function validarEdicao(edicao: EdicaoRegistro): string | null {
  if (!edicao.atividade.trim()) return 'O título da atividade não pode ficar em branco.'
  if (edicao.atividade.trim().length > 300) return 'O título ficou longo demais (máximo de 300 caracteres).'
  if (ehRegistroDeSistema(edicao.atividade)) {
    return 'Esse título é reservado para os registros automáticos do cronograma. Escolha outro.'
  }
  return null
}

export async function atualizarRegistro(
  supabase: SupabaseClient,
  id: string,
  edicao: EdicaoRegistro,
): Promise<RegistroSalvo> {
  const problema = validarEdicao(edicao)
  if (problema) throw new Error(problema)

  const { data, error } = await supabase
    .from('atividades')
    .update({
      atividade: edicao.atividade.trim(),
      observacao: edicao.observacao.trim() || null,
    })
    .eq('id', id)
    .select('id, atividade, observacao')

  if (error) throw new Error(error.message)

  if (!data || data.length === 0) {
    throw new Error(
      'O banco aceitou a operação mas não alterou nada. Normalmente é permissão: '
      + 'editar uma atividade exige o papel de admin ou gestor.',
    )
  }

  return data[0] as RegistroSalvo
}
