import { describe, it, expect, vi } from 'vitest'
import { buscarTodasAsPaginas } from '../paginacao-supabase'

/** Banco falso que respeita o teto de 1.000 linhas por resposta do PostgREST. */
function bancoFalso(totalDeLinhas: number, tetoDoServidor = 1000) {
  const chamadas: [number, number][] = []
  const consulta = async (de: number, ate: number) => {
    chamadas.push([de, ate])
    const pedido = ate - de + 1
    const entregue = Math.min(pedido, tetoDoServidor)
    const linhas = []
    for (let i = de; i < Math.min(de + entregue, totalDeLinhas); i++) linhas.push({ i })
    return { data: linhas }
  }
  return { consulta, chamadas }
}

describe('buscarTodasAsPaginas', () => {
  it('traz as 1.380 linhas que uma única resposta cortaria em 1.000', async () => {
    const { consulta, chamadas } = bancoFalso(1380)
    const r = await buscarTodasAsPaginas(consulta)
    expect(r.linhas).toHaveLength(1380)
    expect(r.truncado).toBe(false)
    expect(chamadas).toHaveLength(2)
  })

  it('para na primeira página quando tudo já coube', async () => {
    const { consulta, chamadas } = bancoFalso(74)
    const r = await buscarTodasAsPaginas(consulta)
    expect(r.linhas).toHaveLength(74)
    expect(chamadas).toHaveLength(1)
  })

  it('tabela vazia devolve lista vazia, sem laço', async () => {
    const { consulta, chamadas } = bancoFalso(0)
    const r = await buscarTodasAsPaginas(consulta)
    expect(r.linhas).toEqual([])
    expect(r.truncado).toBe(false)
    expect(chamadas).toHaveLength(1)
  })

  it('total exatamente múltiplo da página não perde nem repete linha', async () => {
    const { consulta } = bancoFalso(2000)
    const r = await buscarTodasAsPaginas(consulta)
    expect(r.linhas).toHaveLength(2000)
    expect(new Set(r.linhas.map(l => l.i)).size).toBe(2000)
  })

  it('avisa quando encosta no teto, em vez de varrer sem fim', async () => {
    const { consulta } = bancoFalso(50000)
    const r = await buscarTodasAsPaginas(consulta, { teto: 3000 })
    expect(r.linhas).toHaveLength(3000)
    expect(r.truncado).toBe(true)
  })

  it('erro no meio devolve o que já veio, marcado como incompleto', async () => {
    let n = 0
    const consulta = async (de: number) => {
      if (n++ === 1) return { data: null, error: new Error('conexão caiu') }
      return { data: Array.from({ length: 1000 }, (_, i) => ({ i: de + i })) }
    }
    const r = await buscarTodasAsPaginas(consulta)
    expect(r.linhas).toHaveLength(1000)
    expect(r.truncado).toBe(true)
  })

  it('não pede mais que 1.000 por vez — o servidor não entregaria', async () => {
    const { consulta, chamadas } = bancoFalso(2500)
    await buscarTodasAsPaginas(consulta, { tamanhoPagina: 5000 })
    for (const [de, ate] of chamadas) expect(ate - de + 1).toBeLessThanOrEqual(1000)
  })

  it('respeita um tamanho de página menor, quando pedido', async () => {
    const { consulta, chamadas } = bancoFalso(250)
    const r = await buscarTodasAsPaginas(consulta, { tamanhoPagina: 100 })
    expect(r.linhas).toHaveLength(250)
    expect(chamadas).toHaveLength(3)
  })

  it('as faixas pedidas são contíguas e sem sobreposição', async () => {
    const { consulta, chamadas } = bancoFalso(2500)
    await buscarTodasAsPaginas(consulta)
    for (let i = 1; i < chamadas.length; i++) {
      expect(chamadas[i][0]).toBe(chamadas[i - 1][1] + 1)
    }
  })

  it('não engole exceção do chamador', async () => {
    const explode = vi.fn(async () => { throw new Error('falha inesperada') })
    await expect(buscarTodasAsPaginas(explode)).rejects.toThrow('falha inesperada')
  })
})
