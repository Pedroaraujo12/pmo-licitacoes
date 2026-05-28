'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, UserRole } from '@/types/database'

export interface AuthState {
  profile: Profile | null
  role: UserRole | null
  userId: string | null
  isLoading: boolean
  error: string | null
  retry: () => void
}

const IDLE_TIMEOUT = 8_000

export function useAuthSession(): AuthState {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const mountedRef = useRef(true)

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1)
    setIsLoading(true)
    setError(null)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    const controller = new AbortController()
    let active = true

    const timeout = setTimeout(() => {
      if (mountedRef.current) {
        setIsLoading(false)
        setError('Tempo limite excedido ao verificar autenticação.')
      }
    }, IDLE_TIMEOUT)

    const supabase = createClient()

    ;(async () => {
      try {
        const { data: { session }, error: sessionError } =
          await supabase.auth.getSession()

        if (!active) return

        if (sessionError) {
          setError(sessionError.message)
          return
        }

        if (!session?.user) {
          setProfile(null)
          setRole(null)
          setUserId(null)
          return
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, name, email, role, avatar_url, created_at, updated_at')
          .eq('id', session.user.id)
          .maybeSingle()

        if (!active) return

        if (profileError) {
          console.warn('[useAuthSession] profile error:', profileError.message)
          setUserId(session.user.id)
          setRole(null)
          return
        }

        if (profileData) {
          const p = profileData as Profile
          setProfile(p)
          setRole(p.role)
          setUserId(p.id)
        } else {
          setUserId(session.user.id)
          setRole(null)
        }
      } catch (err) {
        if (!active) return
        const message = err instanceof Error ? err.message : 'Erro desconhecido'
        console.error('[useAuthSession]', message)
        setError(message)
      } finally {
        if (active) {
          clearTimeout(timeout)
          setIsLoading(false)
        }
      }
    })()

    return () => {
      active = false
      mountedRef.current = false
      controller.abort()
      clearTimeout(timeout)
    }
  }, [retryCount])

  return { profile, role, userId, isLoading, error, retry }
}
