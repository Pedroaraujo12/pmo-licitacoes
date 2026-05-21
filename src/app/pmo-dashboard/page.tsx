'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import DashboardContent from './dashboard-content'
import type { Processo, Profile } from '@/types/database'

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processos, setProcessos] = useState<Processo[]>([])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    async function load() {
      try {
        const [procResult, userResult] = await Promise.all([
          supabase.from('processos').select('*, coordenacoes(nome), status_processo(nome), responsaveis(nome), demandantes(nome), modalidades(nome)').order('data_entrada', { ascending: false }),
          supabase.auth.getUser(),
        ])

        if (cancelled) return

        if (procResult.error) {
          setError(procResult.error.message)
          setLoading(false)
          return
        }

        const user = (userResult as { data: { user: { id?: string } | null } }).data?.user
        if (user?.id) {
          const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).single()
          if (profileData && !cancelled) setProfile(profileData as Profile)
        }

        setProcessos((procResult.data || []) as Processo[])
        setLoading(false)
      } catch (err) {
        if (!cancelled) {
          console.error('Erro inesperado:', err)
          setError((err as Error)?.message || 'Erro de conexão')
          setLoading(false)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) return (
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
