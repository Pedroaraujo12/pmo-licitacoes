import { describe, it, expect } from 'vitest'
import {
  mapearEtapaAtualDoCronograma,
  mapearEtapasDoProcesso,
  diagnosticarAtividade,
  cronogramasNuncaIniciados,
  type EtapaCronograma,
} from '../dashboard-metrics'
import { validarProcesso, avisosProcesso } from '../validacao-processo'

const etapa = (
  processo_id: string, ordem: number, descricao: string | null, status = 'nao_iniciado',
): EtapaCronograma => ({ processo_id, ordem, descricao, status })

/* Rito de exemplo com a forma do real: etapas em ordem, algumas concluídas. */
const CRONOGRAMA: EtapaCronograma[] = [
  etapa('p1', 1, 'Análise TR/UAC', 'concluido'),
  etapa('p1', 2, 'Pesquisa de Preços', 'concluido'),
  etapa('p1', 3, 'Emissão de Parecer jurídico (UJUR)'),
  etapa('p1', 4, 'Homologação'),
  // p2 nunca teve etapa concluída — o rito está parado na primeira
  etapa('p2', 1, 'Análise TR/UAC'),
  etapa('p2', 2, 'Pesquisa de Preços'),
]

describe('mapearEtapaAtualDoCronograma', () => {
  it('aponta a primeira etapa não concluída, por ordem', () => {
    const m = mapearEtapaAtualDoCronograma(CRONOGRAMA)
    expect(m.get('p1')).toBe('Emissão de Parecer jurídico (UJUR)')
    expect(m.get('p2')).toBe('Análise TR/UAC')
  })

  it('não se deixa enganar por etapas fora de ordem na consulta', () => {
    const m = mapearEtapaAtualDoCronograma([
      etapa('px', 9, 'Nona'), etapa('px', 3, 'Terceira'), etapa('px', 7, 'Sétima'),
    ])
    expect(m.get('px')).toBe('Terceira')
  })

  it('processo com tudo concluído não tem etapa atual', () => {
    const m = mapearEtapaAtualDoCronograma([etapa('pz', 1, 'Única', 'concluido')])
    expect(m.has('pz')).toBe(false)
  })

  it('ignora etapa sem descrição', () => {
    const m = mapearEtapaAtualDoCronograma([etapa('py', 1, '   '), etapa('py', 2, 'Vale')])
    expect(m.get('py')).toBe('Vale')
  })
})

describe('diagnosticarAtividade', () => {
  const atual = mapearEtapaAtualDoCronograma(CRONOGRAMA)
  const etapas = mapearEtapasDoProcesso(CRONOGRAMA)
  const diag = (id: string, texto: string | null) => diagnosticarAtividade(id, texto, atual, etapas)

  it('confere quando o texto é a etapa que o cronograma aponta', () => {
    expect(diag('p1', 'Emissão de Parecer jurídico (UJUR)').aderencia).toBe('confere')
  })

  it('ignora espaço em volta antes de comparar', () => {
    expect(diag('p1', '  Emissão de Parecer jurídico (UJUR)  ').aderencia).toBe('confere')
  })

  it('separa "etapa errada do mesmo rito" de "texto de outro rito"', () => {
    // existe no cronograma, mas não é a atual — atraso de registro
    expect(diag('p1', 'Homologação').aderencia).toBe('outra_etapa')
    // não existe no rito: é o caso dos 39 processos com texto do rito antigo
    expect(diag('p1', 'Publicação do Edital (prazos legais: 3 dias úteis)').aderencia).toBe('fora_do_rito')
  })

  it('distingue campo vazio de ausência de cronograma', () => {
    expect(diag('p1', null).aderencia).toBe('nao_declarada')
    expect(diag('p1', '   ').aderencia).toBe('nao_declarada')
    expect(diag('desconhecido', 'Qualquer').aderencia).toBe('sem_cronograma')
  })

  it('sempre devolve a etapa do cronograma, para a tela poder oferecer a correção', () => {
    expect(diag('p1', 'Homologação').etapaDoCronograma).toBe('Emissão de Parecer jurídico (UJUR)')
    expect(diag('p2', null).etapaDoCronograma).toBe('Análise TR/UAC')
  })
})

describe('cronogramasNuncaIniciados', () => {
  it('encontra o rito parado na primeira etapa', () => {
    const s = cronogramasNuncaIniciados(CRONOGRAMA)
    expect(s.has('p2')).toBe(true)
    expect(s.has('p1')).toBe(false)
  })

  it('processo sem cronograma nenhum não entra na conta', () => {
    expect(cronogramasNuncaIniciados([]).size).toBe(0)
  })
})

describe('validarProcesso', () => {
  const ok = {
    responsavel_id: 'r1', status_nome: 'Em andamento',
    data_entrega: '2026-12-01', valor_estimado: 100, valor_homologado: 0,
  }

  it('processo em andamento completo passa', () => {
    expect(validarProcesso(ok)).toEqual([])
  })

  it('exige responsável', () => {
    expect(validarProcesso({ ...ok, responsavel_id: null }).map(p => p.campo)).toContain('responsavel_id')
  })

  it('exige data de entrega enquanto o processo não é terminal', () => {
    expect(validarProcesso({ ...ok, data_entrega: null }).map(p => p.campo)).toContain('data_entrega')
    // encerrado não precisa mais: cobrar prazo de processo cancelado não faz sentido
    expect(validarProcesso({ ...ok, status_nome: 'Cancelado', data_entrega: null })).toEqual([])
  })

  it('não deixa concluir sem valor homologado nem sem data de conclusão', () => {
    const campos = validarProcesso({
      ...ok, status_nome: 'Concluído', valor_homologado: 0, data_atividade: null,
    }).map(p => p.campo)
    expect(campos).toContain('valor_homologado')
    expect(campos).toContain('data_atividade')
  })

  it('toda mensagem cita o rótulo exato que aparece na tela', () => {
    /* A primeira versão pedia "data da conclusão" — nome que não existe no
       formulário, onde o campo se chama "Data Atividade". Quem foi procurar
       não achou. Os rótulos abaixo são os do formulário de edição. */
    const rotulosDoFormulario = ['Responsável', 'Data Entrega', 'Valor Homologado (R$)', 'Data Atividade']
    const problemas = validarProcesso({
      responsavel_id: null, status_nome: 'Concluído',
      data_entrega: null, valor_homologado: 0, data_atividade: null,
    })
    expect(problemas.length).toBe(3) // entrega não é cobrada de processo terminal
    for (const p of problemas) {
      expect(rotulosDoFormulario).toContain(p.rotulo)
      expect(p.mensagem).toContain(`"${p.rotulo}"`)
    }
  })

  it('concluído com valor e data passa', () => {
    expect(validarProcesso({
      ...ok, status_nome: 'Concluído', valor_homologado: 90, data_atividade: '2026-08-10',
    })).toEqual([])
  })

  it('vale para Homologado tanto quanto para Concluído', () => {
    expect(validarProcesso({ ...ok, status_nome: 'Homologado', valor_homologado: 0, data_atividade: null }).length)
      .toBeGreaterThan(0)
  })
})

describe('avisosProcesso', () => {
  it('avisa, sem bloquear, quando o homologado passa do estimado', () => {
    expect(avisosProcesso({ valor_estimado: 100, valor_homologado: 120 })).toHaveLength(1)
  })

  it('cala quando o homologado está abaixo, ou quando não há estimado', () => {
    expect(avisosProcesso({ valor_estimado: 100, valor_homologado: 90 })).toEqual([])
    expect(avisosProcesso({ valor_estimado: 0, valor_homologado: 120 })).toEqual([])
  })
})
