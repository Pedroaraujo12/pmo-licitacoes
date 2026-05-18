'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import GestaoProcessos from './gestao-processos'
import type { Processo, Modalidade, Responsavel, Profile, StatusProcessoCronograma } from '@/types/database'

export default function ProcessosPage() {
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

        const errors = [procResult.error, m.error, r.error].filter(Boolean)
        if (errors.length > 0) {
          setError(errors.map((e: unknown) => (e as { message: string }).message).join(' | '))
          setLoading(false)
          return
        }

        const procData = procResult.data as (Processo & { coordenacoes?: { nome: string } | null; status_processo?: { nome: string } | null; responsaveis?: { nome: string } | null; demandantes?: { nome: string } | null; modalidades?: { nome: string } | null })[] | null

        if (m.data) setModalidades(m.data)
        if (r.data) setResponsaveis(r.data)

        const user = (userResult as { data: { user: { user_metadata?: { role?: string } } | null } }).data?.user
        setProfile(user?.user_metadata?.role ? { role: user.user_metadata.role } as Profile : null)

        const merged: (Processo & { processo_atrasado?: boolean; etapas_concluidas?: number; total_etapas?: number; data_fim_prevista_total?: string | null })[] = []

        if (procData) {
          for (const p of procData) {
            merged.push({ ...p, processo_atrasado: false, etapas_concluidas: 0, total_etapas: 0, data_fim_prevista_total: null })
          }
        }

        const allIds = merged.map(p => p.id_processo).filter(Boolean) as string[]
        if (allIds.length > 0) {
          const { data: cronData } = await supabase.from('vw_status_processo_cronograma').select('*').in('id_processo', allIds)
          if (cronData) {
            const map: Record<string, StatusProcessoCronograma> = {}
            ;(cronData as StatusProcessoCronograma[]).forEach(c => { if (c.id_processo) map[c.id_processo] = c })
            for (const item of merged) {
              if (item.id_processo && map[item.id_processo]) {
                const c = map[item.id_processo]
                item.processo_atrasado = c.processo_atrasado ?? false
                item.etapas_concluidas = c.etapas_concluidas ?? 0
                item.total_etapas = c.total_etapas ?? 0
                item.data_fim_prevista_total = c.data_fim_prevista_total ?? null
                item.atividade_atual = c.atividade_atual || item.atividade_atual
                item.data_entrega = c.data_fim_atividade_atual || item.data_entrega
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
    <div style={{ textAlign: 'center', padding: 60, color: '#ef4444', fontSize: 14 }}>{error}</div>
  )

  return (
    <GestaoProcessos
      processos={processos}
      modalidades={modalidades}
      responsaveis={responsaveis}
      userRole={profile?.role || null}
    />
  )
}
