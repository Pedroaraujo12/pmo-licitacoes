import { describe, it, expect } from 'vitest'
import { contarDiasUteis, agregarLinhas } from '../cronograma-lista'

// Feriados reais do calendário do sistema
const FERIADOS = new Set(['2026-09-07', '2026-11-02', '2026-11-15', '2026-11-20'])
const SEM_FERIADOS = new Set<string>()

describe('contarDiasUteis', () => {
  it('não conta o próprio dia do prazo', () => {
    // Prazo numa segunda; no mesmo dia não há atraso
    expect(contarDiasUteis('2026-08-10', '2026-08-10', SEM_FERIADOS)).toBe(0)
  })

  it('conta o primeiro dia útil após o prazo', () => {
    // segunda 10/08 -> terça 11/08 = 1 dia útil de atraso
    expect(contarDiasUteis('2026-08-10', '2026-08-11', SEM_FERIADOS)).toBe(1)
  })

  it('pula o fim de semana', () => {
    // sexta 14/08 -> segunda 17/08: sábado e domingo não contam
    expect(contarDiasUteis('2026-08-14', '2026-08-17', SEM_FERIADOS)).toBe(1)
  })

  it('desconta feriado no intervalo', () => {
    // sexta 04/09 -> quarta 09/09, com Independência na segunda 07/09
    expect(contarDiasUteis('2026-09-04', '2026-09-09', FERIADOS)).toBe(2)
    expect(contarDiasUteis('2026-09-04', '2026-09-09', SEM_FERIADOS)).toBe(3)
  })

  it('semana cheia conta cinco dias úteis', () => {
    // segunda 10/08 -> segunda 17/08
    expect(contarDiasUteis('2026-08-10', '2026-08-17', SEM_FERIADOS)).toBe(5)
  })

  it('data futura não gera atraso negativo', () => {
    expect(contarDiasUteis('2026-12-01', '2026-08-10', SEM_FERIADOS)).toBe(0)
  })

  it('entrada vazia devolve zero', () => {
    expect(contarDiasUteis('', '2026-08-10', SEM_FERIADOS)).toBe(0)
  })
})

describe('atraso da etapa atual', () => {
  const processo = {
    id: 'p1', id_processo: 'AGSUS.000001/2026-11', objeto_resumido: 'Obra',
    data_entrada: '2026-06-01', data_entrega: '2026-12-01',
    modalidades: { nome: 'Pregão' }, status_processo: { nome: 'Em andamento' },
  }

  function etapa(ordem: number, descricao: string, status: string, data_fim: string | null) {
    return { processo_id: 'p1', ordem, descricao, status, data_fim, fase: 'Execução' }
  }

  it('mede o atraso pela etapa atual, não pelas seguintes', () => {
    const [linha] = agregarLinhas([processo], [
      etapa(1, 'Análise', 'concluido', '2026-08-01'),
      etapa(2, 'Pesquisa de Preços', 'nao_iniciado', '2026-09-04'), // vencida
      etapa(3, 'Edital', 'nao_iniciado', '2026-12-01'),
    ], '2026-09-09', FERIADOS)

    expect(linha.etapa_atual).toBe('Pesquisa de Preços')
    expect(linha.etapa_atual_data_fim).toBe('2026-09-04')
    expect(linha.dias_uteis_atraso).toBe(2) // 07/09 é feriado
  })

  it('etapa dentro do prazo não acusa atraso', () => {
    const [linha] = agregarLinhas([processo], [
      etapa(1, 'Análise', 'nao_iniciado', '2026-12-01'),
    ], '2026-09-09', FERIADOS)

    expect(linha.dias_uteis_atraso).toBe(0)
  })

  it('etapa sem prazo não acusa atraso', () => {
    const [linha] = agregarLinhas([processo], [
      etapa(1, 'Marco', 'nao_iniciado', null),
    ], '2026-09-09', FERIADOS)

    expect(linha.dias_uteis_atraso).toBe(0)
    expect(linha.etapa_atual_data_fim).toBeNull()
  })

  it('processo concluído não acumula atraso', () => {
    const [linha] = agregarLinhas([processo], [
      etapa(1, 'Análise', 'concluido', '2026-08-01'),
    ], '2026-09-09', FERIADOS)

    expect(linha.etapa_atual).toBeNull()
    expect(linha.dias_uteis_atraso).toBe(0)
  })
})
