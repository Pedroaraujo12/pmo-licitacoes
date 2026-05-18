'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import GestaoProcessos from './gestao-processos'
import type { Processo, Modalidade, Responsavel, Profile, StatusProcessoCronograma } from '@/types/database'

const TODAY = new Date().toISOString().split('T')[0]

export default function ProcessosPage() {
  const supabase = createClient()
  const [modalidades, setModalidades] = useState<Modalidade[]>([])
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processos, setProcessos] = useState<(Processo & { processo_atrasado?: boolean; etapas_concluidas?: number; total_etapas?: number; data_fim_prevista_total?: string | null })[]>([])

  const loadData = async () => {
    try {
      const [m, r, respMap, userResult] = await Promise.all([
        supabase.from('modalidades').select('*'),
        supabase.from('responsaveis').select('*'),
        supabase.from('responsaveis').select('id, nome'),
        supabase.auth.getUser(),
      ])

      const user = (userResult as { data: { user: { id?: string } | null } }).data?.user
      if (user?.id) {
        const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        if (profileData) {
          setProfile(profileData as Profile)
        }
      }

      if (m.data) setModalidades(m.data)
      if (r.data) setResponsaveis(r.data)

      // Get responsavel name→id mapping for migration
      const respNameToId: Record<string, string> = {}
      if (respMap.data) {
        for (const r of respMap.data as { id: string; nome: string }[]) {
          respNameToId[r.nome] = r.id
        }
      }

      // On-demand migration: copy licitacoes → processos if not already migrated
      const { data: licData, error: licError } = await supabase.from('licitacoes').select('*').order('data_entrada', { ascending: false })
      if (licError && licError.message !== 'relation "licitacoes" does not exist') {
        console.error('Erro ao carregar licitacoes:', licError.message)
      }

      if (licData && licData.length > 0) {
        if (Object.keys(respNameToId).length > 0) {
          for (const l of licData) {
            const respId = l.responsavel && respNameToId[l.responsavel] ? respNameToId[l.responsavel] : null
            const idProc = l.id_processo
            if (!idProc) continue
            const { error: insErr } = await supabase
              .from('processos')
              .upsert({
                id_processo: idProc,
                objeto_resumido: l.objeto_resumido,
                data_entrada: l.data_entrada || TODAY,
                data_entrega: l.data_prevista,
                valor_estimado: l.vlr_estimado_anual || 0,
                valor_homologado: l.vlr_homologado || 0,
                responsavel_id: respId,
              }, { onConflict: 'id_processo', ignoreDuplicates: true })
            if (insErr && !insErr.message?.includes('violates unique constraint') && !insErr.message?.includes('duplicate key')) {
              console.error('Erro ao migrar', l.id_processo, insErr.message)
            }
          }
        } else {
          // No responsaveis configured yet - merge from licitacoes as fallback
          // This will show processes on screen even before migration is complete
        }
      }

      // Now load from processos (unified source)
      const { data: procData, error: procError } = await supabase
        .from('processos')
        .select('*, coordenacoes(nome), status_processo(nome), responsaveis(nome), demandantes(nome), modalidades(nome)')
        .order('data_entrada', { ascending: false })

      if (procError) {
        setError(procError.message)
        setLoading(false)
        return
      }

      const typed = (procData || []) as (Processo & { coordenacoes?: { nome: string } | null; status_processo?: { nome: string } | null; responsaveis?: { nome: string } | null; demandantes?: { nome: string } | null; modalidades?: { nome: string } | null })[]

      const merged: (Processo & { processo_atrasado?: boolean; etapas_concluidas?: number; total_etapas?: number; data_fim_prevista_total?: string | null })[] = []

      for (const p of typed) {
        merged.push({ ...p, processo_atrasado: false, etapas_concluidas: 0, total_etapas: 0, data_fim_prevista_total: null })
      }

      // Load cronograma data for all processes
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

  useEffect(() => { loadData() }, [])

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
      onDataChange={loadData}
    />
  )
}
