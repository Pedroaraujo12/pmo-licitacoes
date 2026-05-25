'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { translateAuthError } from '@/lib/auth-errors'
import GestaoProcessos from './gestao-processos'
import type { Processo, Modalidade, Responsavel, Profile } from '@/types/database'

function mapRpcToProcesso(row: Record<string, unknown>): Processo {
  return {
    id: row.id as string,
    id_processo: (row.id_processo as string) || null,
    objeto_resumido: (row.objeto_resumido as string) || null,
    data_entrada: (row.data_entrada as string) || null,
    data_entrega: (row.data_entrega as string) || null,
    valor_estimado: (row.valor_estimado as number) || null,
    valor_homologado: (row.valor_homologado as number) || null,
    prioridade: (row.prioridade as string) || null,
    status_nome: (row.status_nome as string) || null,
    status_processo: row.status_nome ? { nome: row.status_nome as string } : undefined,
    modalidades: row.modalidade_nome ? { nome: row.modalidade_nome as string } : undefined,
    responsaveis: row.responsavel_nome ? { nome: row.responsavel_nome as string } : undefined,
    coordenacoes: row.coordenacao_nome ? { nome: row.coordenacao_nome as string } : undefined,
    demandantes: row.demandante_nome ? { nome: row.demandante_nome as string } : undefined,
  } as unknown as Processo
}

export default function ProcessosPage() {
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [modalidades, setModalidades] = useState<Modalidade[]>([])
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processos, setProcessos] = useState<Processo[]>([])

  function getSupabase() {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const supabase = getSupabase()

        const [userResult, m, r, procResult] = await Promise.all([
          supabase.auth.getUser(),
          supabase.from('modalidades').select('id, nome'),
          supabase.from('responsaveis').select('*'),
          supabase.rpc('search_processos', {
            p_search: null, p_status_id: null, p_modalidade_id: null,
            p_responsavel_id: null, p_coordenacao_id: null,
            p_data_inicio: null, p_data_fim: null, p_prioridade: null,
            p_limit: 300, p_offset: 0,
          }),
        ])

        if (cancelled) return
        if (procResult.error) { setError(translateAuthError(procResult.error.message)); setLoading(false); return }

        const user = (userResult as { data: { user: { id?: string } | null } }).data?.user
        if (user?.id) {
          const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).single()
          if (profileData && !cancelled) setProfile(profileData as Profile)
        }

        if (m.data) setModalidades(m.data)
        if (r.data) setResponsaveis(r.data)
        const rows = procResult.data || []
        setProcessos(rows.map(mapRpcToProcesso))
        setLoading(false)
      } catch (err) {
        if (!cancelled) { console.warn('Erro inesperado:', err); setError((err as Error)?.message || 'Erro de conexão'); setLoading(false) }
      }
    }
    load()
    return () => { cancelled = true }
  }, [reloadKey])

  function handleDataChange() { setLoading(true); setReloadKey(k => k + 1) }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="loading-spinner" />
    </div>
  )

  if (error) return <div style={{ textAlign: 'center', padding: 60, color: '#ef4444', fontSize: 14 }}>{error}</div>

  return (
    <GestaoProcessos
      processos={processos} setProcessos={setProcessos}
      modalidades={modalidades} responsaveis={responsaveis}
      userRole={profile?.role || null} onDataChange={handleDataChange}
    />
  )
}
