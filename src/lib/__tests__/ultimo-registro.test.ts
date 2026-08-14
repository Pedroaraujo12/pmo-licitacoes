import { describe, it, expect } from 'vitest'
import { ultimoRegistroPorProcesso, agregarLinhas, type RegistroRecente } from '../cronograma-lista'

const P1 = 'proc-1'
const P2 = 'proc-2'

describe('ultimoRegistroPorProcesso', () => {
  it('escolhe o mais recente de cada processo', () => {
    const mapa = ultimoRegistroPorProcesso([
      { processo_id: P1, atividade: 'Antiga', created_at: '2026-08-01T10:00:00Z' },
      { processo_id: P1, atividade: 'Recente', created_at: '2026-08-10T09:00:00Z' },
      { processo_id: P2, atividade: 'Do outro processo', created_at: '2026-08-05T09:00:00Z' },
    ])
    expect(mapa.get(P1)?.atividade).toBe('Recente')
    expect(mapa.get(P2)?.atividade).toBe('Do outro processo')
  })

  it('ignora a trilha de auditoria do cronograma', () => {
    const mapa = ultimoRegistroPorProcesso([
      { processo_id: P1, atividade: '__REPOSICIONAMENTO__', created_at: '2026-08-12T10:00:00Z' },
      { processo_id: P1, atividade: '__SEI_LINK__', created_at: '2026-08-11T10:00:00Z' },
      { processo_id: P1, atividade: 'Reunião com a área demandante', created_at: '2026-08-02T10:00:00Z' },
    ])
    expect(mapa.get(P1)?.atividade).toBe('Reunião com a área demandante')
  })

  it('não devolve nada quando o processo só tem auditoria', () => {
    const mapa = ultimoRegistroPorProcesso([
      { processo_id: P1, atividade: '__RITO_APLICADO__', created_at: '2026-08-12T10:00:00Z' },
    ])
    expect(mapa.has(P1)).toBe(false)
  })

  it('usa a data informada quando created_at falta', () => {
    const mapa = ultimoRegistroPorProcesso([
      { processo_id: P1, atividade: 'Sem carimbo, mais nova', data: '2026-08-10' },
      { processo_id: P1, atividade: 'Sem carimbo, mais velha', data: '2026-08-01' },
    ])
    expect(mapa.get(P1)?.atividade).toBe('Sem carimbo, mais nova')
  })

  it('descarta registro sem processo', () => {
    const mapa = ultimoRegistroPorProcesso([
      { processo_id: '', atividade: 'Órfã', created_at: '2026-08-10T10:00:00Z' },
    ])
    expect(mapa.size).toBe(0)
  })

  it('aceita lista vazia', () => {
    expect(ultimoRegistroPorProcesso([]).size).toBe(0)
  })
})

describe('agregarLinhas com o último registro', () => {
  const processos = [{ id: P1, id_processo: 'AGSUS.000123/2026-98' }]
  const atividades = [
    { processo_id: P1, status: 'concluido', data_fim: '2026-08-01', fase: 'Produção', descricao: 'Etapa 1', ordem: 1 },
  ]

  it('leva a anotação para a linha', () => {
    const ultimos = new Map<string, RegistroRecente>([[P1, {
      processo_id: P1,
      atividade: 'Aguardando parecer da UJUR',
      observacao: 'Cobrança feita por e-mail em 12/08',
      data: '2026-08-12',
      responsavel: 'pedroaraujo12@gmail.com',
    }]])

    const [linha] = agregarLinhas(processos, atividades, '2026-08-14', new Set(), ultimos)
    expect(linha.ultimo_registro).toBe('Aguardando parecer da UJUR')
    expect(linha.ultimo_registro_observacao).toBe('Cobrança feita por e-mail em 12/08')
    expect(linha.ultimo_registro_data).toBe('2026-08-12')
    expect(linha.ultimo_registro_autor).toBe('pedroaraujo12@gmail.com')
  })

  it('deixa os campos nulos quando o processo não tem anotação', () => {
    const [linha] = agregarLinhas(processos, atividades, '2026-08-14', new Set(), new Map())
    expect(linha.ultimo_registro).toBeNull()
    expect(linha.ultimo_registro_observacao).toBeNull()
  })

  it('segue funcionando sem o parâmetro, como antes', () => {
    const [linha] = agregarLinhas(processos, atividades, '2026-08-14')
    expect(linha.ultimo_registro).toBeNull()
    expect(linha.total_atividades).toBe(1)
  })
})
