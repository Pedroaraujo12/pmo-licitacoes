// @vitest-environment jsdom
/**
 * A paginacao e compartilhada por todas as telas de lista — um defeito aqui
 * aparece em todo lugar de uma vez, e nenhum teste cobria o componente.
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import Pagination from '../pagination'

afterEach(cleanup)

const base = { page: 3, totalPages: 7, total: 74, showingFrom: 25, showingTo: 36 }

describe('Pagination', () => {
  it('some quando ha uma pagina so — nao ha o que paginar', () => {
    const { container } = render(<Pagination {...base} totalPages={1} onPageChange={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('anuncia o recorte que esta na tela', () => {
    render(<Pagination {...base} onPageChange={vi.fn()} />)
    expect(screen.getByText(/25–36 de 74 processos · Página 3 de 7/)).toBeTruthy()
  })

  it('navega para tras e para frente sem passar dos limites', () => {
    const ir = vi.fn()
    const { rerender } = render(<Pagination {...base} onPageChange={ir} />)
    fireEvent.click(screen.getByRole('button', { name: 'Página anterior' }))
    expect(ir).toHaveBeenLastCalledWith(2)
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    expect(ir).toHaveBeenLastCalledWith(4)

    rerender(<Pagination {...base} page={1} onPageChange={ir} />)
    expect(screen.getByRole('button', { name: 'Página anterior' })).toHaveProperty('disabled', true)

    rerender(<Pagination {...base} page={7} onPageChange={ir} />)
    expect(screen.getByRole('button', { name: 'Próxima página' })).toHaveProperty('disabled', true)
  })

  it('marca a pagina corrente para leitura por voz, nao so pela cor', () => {
    render(<Pagination {...base} onPageChange={vi.fn()} />)
    const atual = screen.getByRole('button', { name: 'Página 3' })
    expect(atual.getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: 'Página 4' }).getAttribute('aria-current')).toBeNull()
  })

  it('a faixa de numeros acompanha a pagina e nao estoura o total', () => {
    render(<Pagination {...base} page={7} onPageChange={vi.fn()} />)
    const numeros = screen.getAllByRole('button')
      .map(b => b.textContent || '')
      .filter(t => /^\d+$/.test(t))
      .map(Number)
    expect(numeros).toEqual([3, 4, 5, 6, 7])
    expect(Math.max(...numeros)).toBeLessThanOrEqual(7)
  })

  it('o modo compacto mostra a posicao sem a lista de numeros', () => {
    render(<Pagination {...base} compact onPageChange={vi.fn()} />)
    expect(screen.getByText('Página 3 de 7')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Página 4' })).toBeNull()
  })

  it('e um marco de navegacao rotulado, em ambos os modos', () => {
    const { rerender } = render(<Pagination {...base} onPageChange={vi.fn()} />)
    expect(screen.getByRole('navigation', { name: 'Paginação' })).toBeTruthy()
    rerender(<Pagination {...base} compact onPageChange={vi.fn()} />)
    expect(screen.getByRole('navigation', { name: 'Paginação' })).toBeTruthy()
  })

  it('nao usa mais o cinza que reprovava no contraste minimo', () => {
    const { container } = render(<Pagination {...base} onPageChange={vi.fn()} />)
    expect(container.innerHTML).not.toContain('#64748b')
    expect(container.innerHTML).not.toContain('rgb(100, 116, 139)')
  })
})
