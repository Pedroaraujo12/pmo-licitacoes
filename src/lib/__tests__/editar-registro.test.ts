import { describe, it, expect, vi } from 'vitest'
import { atualizarRegistro, validarEdicao, podeEditarRegistro } from '../editar-registro'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Encadeamento mínimo de `.update().eq().select()` do supabase-js. */
function supabaseFalso(resposta: { data: unknown[] | null; error: { message: string } | null }) {
  const select = vi.fn().mockResolvedValue(resposta)
  const eq = vi.fn(() => ({ select }))
  const update = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ update }))
  return { cliente: { from } as unknown as SupabaseClient, update, eq, select }
}

describe('podeEditarRegistro', () => {
  it('libera admin e gestor', () => {
    expect(podeEditarRegistro('admin')).toBe(true)
    expect(podeEditarRegistro('gestor')).toBe(true)
  })

  it('barra os demais papéis e a ausência de papel', () => {
    expect(podeEditarRegistro('consultor')).toBe(false)
    expect(podeEditarRegistro(null)).toBe(false)
    expect(podeEditarRegistro(undefined)).toBe(false)
    expect(podeEditarRegistro('')).toBe(false)
  })
})

describe('validarEdicao', () => {
  it('aceita uma edição comum', () => {
    expect(validarEdicao({ atividade: 'Aguardando parecer', observacao: '' })).toBeNull()
  })

  it('recusa título em branco', () => {
    expect(validarEdicao({ atividade: '   ', observacao: 'x' })).toMatch(/branco/)
  })

  it('recusa título longo demais', () => {
    expect(validarEdicao({ atividade: 'a'.repeat(301), observacao: '' })).toMatch(/longo/)
  })

  it('impede disfarçar a anotação de registro automático', () => {
    expect(validarEdicao({ atividade: '__RITO_APLICADO__', observacao: '' })).toMatch(/reservado/)
  })
})

describe('atualizarRegistro', () => {
  const edicao = { atividade: '  Aguardando parecer da UJUR  ', observacao: '  cobrado dia 12  ' }

  it('grava com os valores aparados e devolve o que o banco confirmou', async () => {
    const { cliente, update, eq, select } = supabaseFalso({
      data: [{ id: 'r1', atividade: 'Aguardando parecer da UJUR', observacao: 'cobrado dia 12' }],
      error: null,
    })

    const salvo = await atualizarRegistro(cliente, 'r1', edicao)

    expect(update).toHaveBeenCalledWith({
      atividade: 'Aguardando parecer da UJUR',
      observacao: 'cobrado dia 12',
    })
    expect(eq).toHaveBeenCalledWith('id', 'r1')
    expect(select).toHaveBeenCalled()
    expect(salvo.atividade).toBe('Aguardando parecer da UJUR')
  })

  it('grava observação vazia como nulo', async () => {
    const { cliente, update } = supabaseFalso({ data: [{ id: 'r1' }], error: null })
    await atualizarRegistro(cliente, 'r1', { atividade: 'Título', observacao: '   ' })
    expect(update).toHaveBeenCalledWith({ atividade: 'Título', observacao: null })
  })

  it('trata resultado vazio como falha de permissão, não como sucesso', async () => {
    // É o caso real: o PostgREST responde 200 com [] quando a RLS barra.
    const { cliente } = supabaseFalso({ data: [], error: null })
    await expect(atualizarRegistro(cliente, 'r1', edicao))
      .rejects.toThrow(/permissão/)
  })

  it('propaga o erro do banco', async () => {
    const { cliente } = supabaseFalso({ data: null, error: { message: 'coluna inexistente' } })
    await expect(atualizarRegistro(cliente, 'r1', edicao))
      .rejects.toThrow('coluna inexistente')
  })

  it('nem chega ao banco quando a edição é inválida', async () => {
    const { cliente, update } = supabaseFalso({ data: [{ id: 'r1' }], error: null })
    await expect(atualizarRegistro(cliente, 'r1', { atividade: '', observacao: '' }))
      .rejects.toThrow(/branco/)
    expect(update).not.toHaveBeenCalled()
  })
})
