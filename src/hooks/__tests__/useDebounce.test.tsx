// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebounce } from '../useDebounce'

afterEach(() => {
  vi.useRealTimers()
})

describe('useDebounce', () => {
  it('retorna valor inicial imediatamente', () => {
    const { result } = renderHook(() => useDebounce('inicial', 300))
    expect(result.current).toBe('inicial')
  })

  it('atualiza valor após o delay', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'primeiro', delay: 300 } },
    )

    expect(result.current).toBe('primeiro')

    rerender({ value: 'segundo', delay: 300 })
    expect(result.current).toBe('primeiro')

    act(() => { vi.advanceTimersByTime(300) })
    expect(result.current).toBe('segundo')
  })

  it('não atualiza antes do delay', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 500 } },
    )

    rerender({ value: 'b', delay: 500 })
    act(() => { vi.advanceTimersByTime(250) })
    expect(result.current).toBe('a')
  })

  it('cancela timer anterior em mudanças rápidas', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 300 } },
    )

    rerender({ value: 'b', delay: 300 })
    act(() => { vi.advanceTimersByTime(100) })
    rerender({ value: 'c', delay: 300 })
    act(() => { vi.advanceTimersByTime(100) })
    rerender({ value: 'd', delay: 300 })
    act(() => { vi.advanceTimersByTime(100) })

    // Still 'a' because timer keeps being reset
    expect(result.current).toBe('a')

    act(() => { vi.advanceTimersByTime(200) })
    expect(result.current).toBe('d')
  })

  it('funciona com delay zero', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'x', delay: 0 } },
    )
    rerender({ value: 'y', delay: 0 })
    act(() => { vi.advanceTimersByTime(0) })
    expect(result.current).toBe('y')
  })
})
