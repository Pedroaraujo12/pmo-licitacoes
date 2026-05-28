'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export interface PageReadyOptions {
  deps: (() => Promise<boolean>)[]
  timeout?: number
}

export interface PageReadyResult {
  ready: boolean
  error: string | null
  retry: () => void
}

export function usePageReady({
  deps,
  timeout = 12_000,
}: PageReadyOptions): PageReadyResult {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const retryCountRef = useRef(0)
  const [retryTrigger, setRetryTrigger] = useState(0)

  const retry = useCallback(() => {
    retryCountRef.current++
    setRetryTrigger((prev) => prev + 1)
    setError(null)
    setReady(false)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    const controller = new AbortController()
    let active = true

    const timer = setTimeout(() => {
      if (active) {
        setError(`Timeout após ${timeout}ms ao carregar dependências`)
        setReady(false)
      }
    }, timeout)

    ;(async () => {
      try {
        const results = await Promise.all(
          deps.map((fn) =>
            fn().catch((err: unknown) => {
              console.warn('[usePageReady] dependency failed:', err)
              return false
            }),
          ),
        )

        if (!active) return

        if (results.every(Boolean)) {
          setReady(true)
          setError(null)
        } else {
          setError('Algumas dependências não puderam ser carregadas')
        }
      } catch (err) {
        if (!active) return
        const message =
          err instanceof Error ? err.message : 'Erro desconhecido ao carregar página'
        console.error('[usePageReady]', message)
        setError(message)
      } finally {
        if (active) clearTimeout(timer)
      }
    })()

    return () => {
      active = false
      mountedRef.current = false
      controller.abort()
      clearTimeout(timer)
    }
  }, [deps, timeout, retryTrigger])

  return { ready, error, retry }
}
