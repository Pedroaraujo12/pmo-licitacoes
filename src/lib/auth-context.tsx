'use client'

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'

interface AuthContextValue {
  profile: Profile | null
  loading: boolean
  atrasadosCount: number
  proximosVencimentos: number
}

const AuthContext = createContext<AuthContextValue>({
  profile: null,
  loading: true,
  atrasadosCount: 0,
  proximosVencimentos: 0,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [atrasadosCount, setAtrasadosCount] = useState(0)
  const [proximosVencimentos, setProximosVencimentos] = useState(0)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)

  function getSupabase() {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }

  useEffect(() => {
    let cancelled = false
    const supabase = getSupabase()

    async function load() {
      try {
        const userResult = await supabase.auth.getUser()
        if (cancelled) return
        const user = userResult.data?.user
        if (!user) { setLoading(false); return }

        const [profileResult, procsResult, cronoResult] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).single(),
          supabase.from('processos').select('id, data_entrega'),
          supabase.from('cronograma_atividades').select('processo_id, status, data_fim'),
        ])

        if (cancelled) return
        setProfile((profileResult.data || null) as Profile | null)
        setLoading(false)

        const procs = (procsResult.data || []) as { id: string; data_entrega: string | null }[]
        const crono = (cronoResult.data || []) as { processo_id: string; status: string; data_fim: string | null }[]

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const stats = new Map<string, { total: number; concluido: number }>()
        for (const a of crono) {
          const s = stats.get(a.processo_id) || { total: 0, concluido: 0 }
          s.total++
          if (a.status === 'concluido') s.concluido++
          stats.set(a.processo_id, s)
        }
        const concluido: Record<string, boolean> = {}
        for (const [id, s] of stats) concluido[id] = s.total === s.concluido

        const atrasados = procs.filter(p => {
          if (concluido[p.id]) return false
          if (!p.data_entrega) return false
          const d = new Date(p.data_entrega)
          return !isNaN(d.getTime()) && d < today
        }).length
        setAtrasadosCount(atrasados)

        const vencimentos = crono.filter(a => {
          if (a.status === 'concluido' || !a.data_fim) return false
          const fim = new Date(a.data_fim)
          const diff = Math.ceil((fim.getTime() - today.getTime()) / 86400000)
          return diff >= 0 && diff <= 3
        }).length
        setProximosVencimentos(vencimentos)
      } catch {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return (
    <AuthContext.Provider value={{ profile, loading, atrasadosCount, proximosVencimentos }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
