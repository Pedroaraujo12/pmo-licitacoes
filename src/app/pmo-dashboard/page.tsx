'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import DashboardContent from './dashboard-content'
import type { Processo, Modalidade, Responsavel, Profile, StatusProcessoCronograma } from '@/types/database'

export default function DashboardPage() {
  const [modalidades, setModalidades] = useState<Modalidade[]>([])
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processos, setProcessos] = useState<(Processo & { processo_atrasado?: boolean; etapas_concluidas?: number; total_etapas?: number; data_fim_prevista_total?: string | null })[]>([])

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      try {
        const [procResult, m, r, userResult] = await Promise.all([
          supabase.from('processos').select('*, coordenacoes(nome), status_processo(nome), responsaveis(nome), demandantes(nome), modalidades(nome)').order('data_entrada', { ascending: false }),
          supabase.from('modalidades').select('*'),
          supabase.from('responsaveis').select('*'),
          supabase.auth.getUser(),
        ])

        if (procResult.error) {
          setError(procResult.error.message)
          setLoading(false)
          return
        }

        if (m.data) setModalidades(m.data)
        if (r.data) setResponsaveis(r.data)

        const user = (userResult as { data: { user: { id?: string } | null } }).data?.user
        if (user?.id) {
          const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).single()
          if (profileData) {
            setProfile(profileData as Profile)
          }
        }

        const procData = (procResult.data || []) as (Processo & { coordenacoes?: { nome: string } | null; status_processo?: { nome: string } | null; responsaveis?: { nome: string } | null; demandantes?: { nome: string } | null; modalidades?: { nome: string } | null })[]

        const merged = procData.map(p => ({
          ...p,
          processo_atrasado: false,
          etapas_concluidas: 0,
          total_etapas: 0,
          data_fim_prevista_total: null,
        }))

        const allIds = merged.map(p => p.id_processo).filter(Boolean) as string[]
        if (allIds.length > 0) {
          const { data: cronData } = await supabase
            .from('vw_status_processo_cronograma')
            .select('*')
            .in('id_processo', allIds)
          if (cronData) {
            const map: Record<string, StatusProcessoCronograma> = {}
            ;(cronData as StatusProcessoCronograma[]).forEach(c => {
              if (c.id_processo) map[c.id_processo] = c
            })
            for (const item of merged) {
              if (item.id_processo && map[item.id_processo]) {
                const c = map[item.id_processo]
                const r = item as unknown as { [key: string]: unknown }
                if (c.processo_atrasado != null) r.processo_atrasado = !!c.processo_atrasado
                if (c.etapas_concluidas != null) r.etapas_concluidas = c.etapas_concluidas
                if (c.total_etapas != null) r.total_etapas = c.total_etapas
                if (c.data_fim_prevista_total) r.data_fim_prevista_total = c.data_fim_prevista_total
                if (c.atividade_atual) r.atividade_atual = c.atividade_atual
                if (c.data_fim_atividade_atual) r.data_entrega = c.data_fim_atividade_atual
              }
            }
          }
        }

        setProcessos(merged)
        setLoading(false)
      } catch (err) {
        console.error('Erro inesperado:', err)
        setError((err as Error)?.message || 'Erro de conexão')
        setLoading(false)
      }
    }
    load()
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
      modalidades={modalidades}
      responsaveis={responsaveis}
      userRole={profile?.role || null}
    />
  )
}
