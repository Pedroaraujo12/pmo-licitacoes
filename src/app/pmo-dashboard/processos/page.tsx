'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import GestaoProcessos from './gestao-processos'
import type { Processo, Modalidade, Responsavel } from '@/types/database'

export default function ProcessosPage() {
  const { profile, loading: authLoading } = useAuth()
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [modalidades, setModalidades] = useState<Modalidade[]>([])
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processos, setProcessos] = useState<Processo[]>([])

  function getSupabase() {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }

  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    async function load() {
      try {
        const supabase = getSupabase()

        const [m, r, procResult] = await Promise.all([
          supabase.from('modalidades').select('*'),
          supabase.from('responsaveis').select('*'),
          supabase
            .from('processos')
            .select('*, coordenacoes(nome), status_processo(nome), responsaveis(nome), demandantes(nome), modalidades(nome)')
            .order('data_entrada', { ascending: false }),
        ])

        if (cancelled) return

        if (procResult.error) {
          setError(procResult.error.message)
          setLoading(false)
          return
        }

        if (m.data) setModalidades(m.data)
        if (r.data) setResponsaveis(r.data)
        setProcessos(procResult.data as Processo[] || [])
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
  }, [authLoading, reloadKey])

  function handleDataChange() {
    setLoading(true)
    setReloadKey(k => k + 1)
  }

  if (authLoading || loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="loading-spinner" />
    </div>
  )

  if (error) return (
    <div style={{ textAlign: 'center', padding: 60, color: '#ef4444', fontSize: 14 }}>{error}</div>
  )

  return (
    <GestaoProcessos
      processos={processos}
      setProcessos={setProcessos}
      modalidades={modalidades}
      responsaveis={responsaveis}
      userRole={profile?.role || null}
      onDataChange={handleDataChange}
    />
  )
}
