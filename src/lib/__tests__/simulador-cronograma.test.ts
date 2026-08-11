import { describe, it, expect } from 'vitest'
import {
  isDiaUtil,
  somarDiasUteis,
  projetarCronograma,
  ultimoAnoComFeriados,
  type EtapaModelo,
} from '../simulador-cronograma'

// Feriados reais do seed (migration 00002) usados nos testes
const FERIADOS = new Set(['2026-09-07', '2026-12-25', '2026-11-02'])
const SEM_FERIADOS = new Set<string>()

// Recorte do Cronograma DIOP de Cotação de Preços (migration 20260808000000)
const COTACAO: EtapaModelo[] = [
  { ordem: 1, fase: 'Planejamento', descricao: 'Analisar a Solicitação de Compras', setor: 'UAC', duracao_dias_uteis: 3 },
  { ordem: 2, fase: 'Produção', descricao: 'Elaboração da requisição de propostas', setor: 'UAC', duracao_dias_uteis: 2 },
  { ordem: 3, fase: 'Produção', descricao: 'Solicitar a publicação', setor: 'UAC', duracao_dias_uteis: 1 },
  { ordem: 4, fase: 'Execução', descricao: 'Publicação no site', setor: 'UCOM', duracao_dias_uteis: 1 },
  { ordem: 5, fase: 'Execução', descricao: 'Publicação da Cotação p/ Recebimento de Propostas', setor: 'UCOM', duracao_dias_uteis: 3 },
]

describe('isDiaUtil', () => {
  it('rejeita sábado e domingo', () => {
    expect(isDiaUtil(new Date(2026, 7, 8), SEM_FERIADOS)).toBe(false)  // sábado
    expect(isDiaUtil(new Date(2026, 7, 9), SEM_FERIADOS)).toBe(false)  // domingo
  })

  it('aceita dia de semana comum', () => {
    expect(isDiaUtil(new Date(2026, 7, 10), SEM_FERIADOS)).toBe(true)  // segunda
  })

  it('rejeita feriado cadastrado em dia de semana', () => {
    expect(isDiaUtil(new Date(2026, 8, 7), FERIADOS)).toBe(false)      // Independência, segunda
    expect(isDiaUtil(new Date(2026, 8, 7), SEM_FERIADOS)).toBe(true)   // sem calendário, é útil
  })
})

describe('somarDiasUteis', () => {
  // Convenção INCLUSIVA, igual à função somar_dias_uteis do banco (00002)
  it('etapa de 1 dia começa e termina no mesmo dia', () => {
    const fim = somarDiasUteis(new Date(2026, 7, 10), 1, SEM_FERIADOS)
    expect(fim.getDate()).toBe(10)
  })

  it('duração zero é marco: devolve o próprio dia', () => {
    const fim = somarDiasUteis(new Date(2026, 7, 10), 0, SEM_FERIADOS)
    expect(fim.getDate()).toBe(10)
  })

  it('atravessa o fim de semana', () => {
    // segunda 10/08 + 5 dias úteis = sexta 14/08
    const fim = somarDiasUteis(new Date(2026, 7, 10), 5, SEM_FERIADOS)
    expect(fim.toDateString()).toBe(new Date(2026, 7, 14).toDateString())
  })

  it('desconta feriado no meio do intervalo', () => {
    // terça 01/09 + 5 dias úteis, com Independência (segunda 07/09) no caminho
    const comFeriado = somarDiasUteis(new Date(2026, 8, 1), 5, FERIADOS)
    const semFeriado = somarDiasUteis(new Date(2026, 8, 1), 5, SEM_FERIADOS)
    expect(comFeriado.toDateString()).toBe(new Date(2026, 8, 8).toDateString())
    expect(semFeriado.toDateString()).toBe(new Date(2026, 8, 7).toDateString())
  })

  it('início em fim de semana desloca para o próximo dia útil', () => {
    // sábado 08/08 -> segunda 10/08
    const fim = somarDiasUteis(new Date(2026, 7, 8), 1, SEM_FERIADOS)
    expect(fim.toDateString()).toBe(new Date(2026, 7, 10).toDateString())
  })
})

describe('projetarCronograma', () => {
  it('encadeia as etapas em sequência, sem sobreposição', () => {
    const r = projetarCronograma(COTACAO, '2026-08-10', SEM_FERIADOS)
    expect(r.etapas).toHaveLength(5)
    expect(r.etapas[0].data_inicio).toBe('2026-08-10')
    expect(r.etapas[0].data_fim).toBe('2026-08-12')
    expect(r.etapas[1].data_inicio).toBe('2026-08-13')  // dia útil seguinte
    expect(r.etapas[4].data_fim).toBe('2026-08-21')
  })

  it('soma os dias úteis e devolve a conclusão', () => {
    const r = projetarCronograma(COTACAO, '2026-08-10', SEM_FERIADOS)
    expect(r.dias_uteis).toBe(10)
    expect(r.pendentes).toBe(5)
    expect(r.data_conclusao).toBe('2026-08-21')
  })

  it('a partir de uma etapa, marca as anteriores como cumpridas', () => {
    const r = projetarCronograma(COTACAO, '2026-08-10', SEM_FERIADOS, 5)
    expect(r.pendentes).toBe(1)
    expect(r.dias_uteis).toBe(3)
    expect(r.etapas.slice(0, 4).every(e => e.cumprida)).toBe(true)
    expect(r.etapas.slice(0, 4).every(e => e.data_inicio === null)).toBe(true)
    expect(r.etapas[4].data_inicio).toBe('2026-08-10')  // recomeça na data informada
    expect(r.data_conclusao).toBe('2026-08-12')
  })

  it('aPartirDe = 1 equivale ao rito completo', () => {
    const completo = projetarCronograma(COTACAO, '2026-08-10', SEM_FERIADOS)
    const explicito = projetarCronograma(COTACAO, '2026-08-10', SEM_FERIADOS, 1)
    expect(explicito.data_conclusao).toBe(completo.data_conclusao)
    expect(explicito.pendentes).toBe(completo.pendentes)
  })

  it('feriado no caminho empurra a conclusão', () => {
    const com = projetarCronograma(COTACAO, '2026-09-01', FERIADOS)
    const sem = projetarCronograma(COTACAO, '2026-09-01', SEM_FERIADOS)
    expect(new Date(com.data_conclusao!).getTime())
      .toBeGreaterThan(new Date(sem.data_conclusao!).getTime())
  })

  it('lista vazia não quebra', () => {
    const r = projetarCronograma([], '2026-08-10', SEM_FERIADOS)
    expect(r.pendentes).toBe(0)
    expect(r.data_conclusao).toBeNull()
    expect(r.dias_corridos).toBe(0)
  })
})

describe('ultimoAnoComFeriados', () => {
  it('devolve o maior ano cadastrado', () => {
    expect(ultimoAnoComFeriados(new Set(['2026-01-01', '2027-12-25']))).toBe(2027)
  })

  it('devolve null quando não há feriados', () => {
    expect(ultimoAnoComFeriados(new Set())).toBeNull()
  })
})
