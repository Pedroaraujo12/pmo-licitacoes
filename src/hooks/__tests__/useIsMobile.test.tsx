// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIsMobile } from '../useIsMobile'

beforeEach(() => {
  window.innerWidth = 1024
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useIsMobile', () => {
  it('retorna false em desktop (1024px)', () => {
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('retorna true em tela pequena', () => {
    window.innerWidth = 375
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('retorna false no breakpoint exato (condição é <, não <=)', () => {
    window.innerWidth = 768
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('retorna false acima do breakpoint customizado', () => {
    window.innerWidth = 500
    const { result } = renderHook(() => useIsMobile(400))
    expect(result.current).toBe(false)
  })

  it('reativa ao redimensionar', () => {
    window.innerWidth = 1024
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)

    act(() => {
      window.innerWidth = 600
      window.dispatchEvent(new Event('resize'))
    })

    expect(result.current).toBe(true)
  })

  it('reativa ao redimensionar para desktop', () => {
    window.innerWidth = 600
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)

    act(() => {
      window.innerWidth = 1200
      window.dispatchEvent(new Event('resize'))
    })

    expect(result.current).toBe(false)
  })
})
