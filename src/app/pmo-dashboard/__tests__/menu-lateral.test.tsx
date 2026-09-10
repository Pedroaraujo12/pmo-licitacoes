// @vitest-environment jsdom
/**
 * O menu lateral tinha onze itens numa lista plana. Agrupar so ajuda se os
 * grupos forem estaveis e nenhum item sumir no caminho — e a barra recolhe,
 * entao a divisao precisa sobreviver sem os titulos.
 */

import { describe, it, expect } from 'vitest'
import { navGrupos } from '../nav-grupos'

const TODOS = navGrupos.flatMap(g => g.itens)

describe('navegação lateral', () => {
  it('mantém os onze destinos, sem perder nem duplicar nenhum', () => {
    expect(TODOS).toHaveLength(11)
    expect(new Set(TODOS.map(i => i.href)).size).toBe(11)
  })

  it('preserva a ordem que já existia — Cronograma e Simulador seguem no topo', () => {
    expect(TODOS.map(i => i.label)).toEqual([
      'Dashboard', 'Cronograma', 'Simulador',
      'Processos', 'Contratos', 'Fornecedores', 'Documentos',
      'Colaboradores', 'Notas', 'Painel do Dia', 'Usuários',
    ])
  })

  it('divide em três blocos, nenhum deles com um item só', () => {
    expect(navGrupos.map(g => g.titulo)).toEqual(['Visão geral', 'Processos', 'Apoio'])
    for (const g of navGrupos) expect(g.itens.length).toBeGreaterThan(1)
  })

  it('todo destino aponta para dentro do painel e tem ícone', () => {
    for (const i of TODOS) {
      expect(i.href.startsWith('/pmo-dashboard')).toBe(true)
      // lucide entrega forwardRef, que e objeto — o que importa e ser renderavel
      expect(['function', 'object']).toContain(typeof i.icon)
      expect(i.icon).toBeTruthy()
    }
  })

  it('"Painel do Dia" fica sob /notas/hoje e não colide com "Notas"', () => {
    // a marcacao de ativo usa startsWith(href + '/'), entao a rota mais
    // especifica precisa existir como item proprio para nao ser engolida
    const notas = TODOS.find(i => i.label === 'Notas')!
    const hoje = TODOS.find(i => i.label === 'Painel do Dia')!
    expect(hoje.href.startsWith(notas.href + '/')).toBe(true)
  })
})
