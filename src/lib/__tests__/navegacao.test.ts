// @vitest-environment jsdom
// Usa sessionStorage, que só existe no navegador.

import { describe, it, expect, beforeEach } from 'vitest'
import {
  registrarNavegacao,
  temHistoricoInterno,
  rotaAnterior,
  nomeDaRota,
} from '../navegacao'

describe('histórico de navegação', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('não há histórico interno na primeira tela', () => {
    registrarNavegacao('/pmo-dashboard/processos/detalhe')
    expect(temHistoricoInterno()).toBe(false)
    expect(rotaAnterior()).toBeNull()
  })

  it('registra a tela anterior após navegar', () => {
    registrarNavegacao('/pmo-dashboard/cronograma')
    registrarNavegacao('/pmo-dashboard/processos/detalhe')

    expect(temHistoricoInterno()).toBe(true)
    expect(rotaAnterior()).toBe('/pmo-dashboard/cronograma')
  })

  it('ignora recarregamento da mesma tela', () => {
    registrarNavegacao('/pmo-dashboard/cronograma')
    registrarNavegacao('/pmo-dashboard/cronograma')
    expect(temHistoricoInterno()).toBe(false)
  })

  it('mantém a pilha limitada, preservando as mais recentes', () => {
    for (let i = 0; i < 15; i++) registrarNavegacao(`/pmo-dashboard/rota-${i}`)
    expect(rotaAnterior()).toBe('/pmo-dashboard/rota-13')
  })

  it('a origem correta é preservada entre módulos diferentes', () => {
    registrarNavegacao('/pmo-dashboard/colaboradores/detalhe')
    registrarNavegacao('/pmo-dashboard/processos/detalhe')
    expect(rotaAnterior()).toBe('/pmo-dashboard/colaboradores/detalhe')
  })

  it('não quebra com pathname vazio', () => {
    registrarNavegacao('')
    expect(temHistoricoInterno()).toBe(false)
  })
})

describe('nomeDaRota', () => {
  it('nomeia rotas conhecidas', () => {
    expect(nomeDaRota('/pmo-dashboard/cronograma')).toBe('Cronograma')
    expect(nomeDaRota('/pmo-dashboard/notas/hoje')).toBe('Painel do Dia')
    expect(nomeDaRota('/pmo-dashboard')).toBe('Dashboard')
  })

  it('reconhece subrotas pelo módulo', () => {
    expect(nomeDaRota('/pmo-dashboard/processos/detalhe')).toBe('Processos')
    expect(nomeDaRota('/pmo-dashboard/contratos/123/medicoes')).toBe('Contratos')
  })

  it('devolve null para rota desconhecida ou ausente', () => {
    expect(nomeDaRota('/outra-coisa')).toBeNull()
    expect(nomeDaRota(null)).toBeNull()
  })
})
