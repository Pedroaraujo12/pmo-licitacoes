'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import DashboardContent from './dashboard-content'
import type { Processo } from '@/types/database'

export default function DashboardPage() {
  const { profile, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processos, setProcessos] = useState<Processo[]>([])

  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    const supabase = createClient()
    async function load() {
      try {
        const { data, error: err } = await supabase
          .from('processos')
          .select('*, coordenacoes(nome), status_processo(nome), responsaveis(nome), demandantes(nome), modalidades(nome)')
          .order('data_entrada', { ascending: false })

        if (cancelled) return

        if (err) {
          setError(err.message)
          setLoading(false)
          return
        }

        setProcessos((data || []) as Processo[])
        setLoading(false)
      } catch (err) {
        if (!cancelled) {
          console.warn('Erro inesperado:', err)
          setError((err as Error)?.message || 'Erro de conexão')
          setLoading(false)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [authLoading])

  if (authLoading || loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="loading-spinner" />
    </div>
  )

  if (error) return (
    <div style={{ textAlign: 'center', padding: 60, color: '#ef4444', fontSize: 14 }}>
      {error}
    </div>
  )

  return (
    <DashboardContent
      processos={processos}
      userRole={profile?.role || null}
    />
  )
}
