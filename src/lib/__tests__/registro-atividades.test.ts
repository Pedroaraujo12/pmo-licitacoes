import { describe, it, expect } from 'vitest'
import {
  ehRegistroDeSistema, separarRegistros, descreverRegistroDeSistema,
  MARCADORES_CONHECIDOS, MARCADOR_SEI_LINK,
} from '../registro-atividades'

describe('ehRegistroDeSistema', () => {
  it('reconhece todos os marcadores em uso', () => {
    for (const m of MARCADORES_CONHECIDOS) {
      expect(ehRegistroDeSistema(m), m).toBe(true)
    }
  })

  it('reconhece um marcador novo pelo formato, sem lista', () => {
    expect(ehRegistroDeSistema('__QUALQUER_COISA_NOVA__')).toBe(true)
  })

  it('não confunde texto digitado com marcador', () => {
    expect(ehRegistroDeSistema('Reunião com a área demandante')).toBe(false)
    expect(ehRegistroDeSistema('Envio __urgente__ ao SEI')).toBe(false)
    expect(ehRegistroDeSistema('__ inicio com espaço __')).toBe(false)
  })

  it('não quebra com vazio ou ausência', () => {
    expect(ehRegistroDeSistema('')).toBe(false)
    expect(ehRegistroDeSistema(null)).toBe(false)
    expect(ehRegistroDeSistema(undefined)).toBe(false)
  })

  it('ignora espaços em volta do marcador', () => {
    expect(ehRegistroDeSistema('  __OVERRIDE__  ')).toBe(true)
  })
})

describe('separarRegistros', () => {
  const lista = [
    { atividade: 'Publicação do edital' },
    { atividade: '__REPOSICIONAMENTO__' },
    { atividade: 'Impugnação recebida' },
    { atividade: MARCADOR_SEI_LINK },
  ]

  it('separa o diário da trilha', () => {
    const { manuais, sistema } = separarRegistros(lista)
    expect(manuais.map(a => a.atividade)).toEqual(['Publicação do edital', 'Impugnação recebida'])
    expect(sistema.map(a => a.atividade)).toEqual(['__REPOSICIONAMENTO__', MARCADOR_SEI_LINK])
  })

  it('preserva a ordem de entrada em cada grupo', () => {
    const { manuais } = separarRegistros([
      { atividade: 'primeiro' }, { atividade: '__X_Y__' }, { atividade: 'segundo' },
    ])
    expect(manuais.map(a => a.atividade)).toEqual(['primeiro', 'segundo'])
  })

  it('aceita lista vazia', () => {
    expect(separarRegistros([])).toEqual({ manuais: [], sistema: [] })
  })
})

describe('descreverRegistroDeSistema', () => {
  it('traduz um reposicionamento', () => {
    const r = descreverRegistroDeSistema({
      atividade: '__REPOSICIONAMENTO__',
      observacao: JSON.stringify({
        etapa_ordem: 1, etapa_descricao: 'Abertura do processo',
        data_base: '2026-08-13', etapas_reagendadas: 20, etapas_reabertas: 20,
        anteriores_concluidas: 0, justificativa: 'Recontratação do mesmo objeto',
      }),
    })
    expect(r.titulo).toBe('Etapa atual redefinida')
    expect(r.detalhe).toContain('Etapa 1 — Abertura do processo')
    expect(r.detalhe).toContain('20 etapas reagendadas')
    expect(r.detalhe).toContain('20 etapas reabertas')
    expect(r.detalhe).not.toContain('anteriores')
    expect(r.justificativa).toBe('Recontratação do mesmo objeto')
  })

  it('traduz uma alteração de duração', () => {
    const r = descreverRegistroDeSistema({
      atividade: '__OVERRIDE__',
      observacao: JSON.stringify({
        atividade: 'Elaboração do ETP', anterior: 5, novo: 10,
        justificativa: 'Complexidade técnica',
      }),
    })
    expect(r.titulo).toBe('Duração de etapa alterada')
    expect(r.detalhe).toBe('Elaboração do ETP · 5 → 10 dias úteis')
    expect(r.justificativa).toBe('Complexidade técnica')
  })

  it('usa singular quando é uma etapa só', () => {
    const r = descreverRegistroDeSistema({
      atividade: '__REINICIO_PRAZOS__',
      observacao: JSON.stringify({ atividades_reiniciadas: 1, nova_data_base: '2026-08-13' }),
    })
    expect(r.detalhe).toContain('1 etapa reiniciada')
  })

  it('trata o link do SEI, cuja observação não é JSON', () => {
    const r = descreverRegistroDeSistema({
      atividade: MARCADOR_SEI_LINK,
      observacao: 'https://sei.exemplo.gov.br/processo/123',
    })
    expect(r.titulo).toBe('Link do SEI atualizado')
    expect(r.detalhe).toBe('https://sei.exemplo.gov.br/processo/123')
  })

  it('não quebra com observação corrompida', () => {
    const r = descreverRegistroDeSistema({
      atividade: '__RITO_APLICADO__',
      observacao: '{isso não é json',
    })
    expect(r.titulo).toBe('Cronograma regerado pelo rito da modalidade')
    expect(r.detalhe).toBe('')
  })

  it('não quebra com observação ausente', () => {
    const r = descreverRegistroDeSistema({ atividade: '__OVERRIDE__', observacao: null })
    expect(r.titulo).toBe('Duração de etapa alterada')
    expect(r.detalhe).toBe('')
    expect(r.justificativa).toBeNull()
  })

  it('dá um título legível a um marcador desconhecido', () => {
    const r = descreverRegistroDeSistema({ atividade: '__ALGO_NOVO__', observacao: 'detalhe' })
    expect(r.titulo).toBe('ALGO NOVO')
    expect(r.detalhe).toBe('detalhe')
  })
})
