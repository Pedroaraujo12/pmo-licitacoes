'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import DashboardContent from './dashboard-content'
import type { Processo, Modalidade, Responsavel, Profile, StatusProcessoCronograma } from '@/types/database'

export default function DashboardPage() {
  const [modalidades, setModalidades] = useState<Modalidade[]>([])
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([])
  const [statusCronograma, setStatusCronograma] = useState<Record<string, StatusProcessoCronograma>>({})
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      try {
        const [procResult, licResult, m, r, userResult] = await Promise.all([
          supabase.from('processos').select('*, coordenacao(nome), status(nome), responsavel(nome), demandante(nome), modalidade(nome)').order('data_entrada', { ascending: false }),
          supabase.from('licitacoes').select('*').order('data_entrada', { ascending: false }),
          supabase.from('modalidades').select('*'),
          supabase.from('responsaveis').select('*'),
          supabase.auth.getUser(),
        ])

        const errors = [procResult.error, licResult.error, m.error, r.error].filter(Boolean)
        if (errors.length > 0) {
          setError(errors.map((e: unknown) => (e as { message: string }).message).join(' | '))
          setLoading(false)
          return
        }

        const procData = procResult.data as (Processo & { coordenacao?: { nome: string } | null; status?: { nome: string } | null; responsavel?: { nome: string } | null; demandante?: { nome: string } | null; modalidade?: { nome: string } | null })[] | null
        const licData = licResult.data as { id: string; id_processo: string; objeto_resumido: string; data_entrada: string; vlr_estimado_anual: number; vlr_homologado: number; prioridade: string; observacoes: string; coordenacao: string; status: string; responsavel: string; modalidade: string; demandante: string; progresso: number; processo_link: string; fase_atual: string; data_prevista: string; created_at: string }[] | null

        if (m.data) setModalidades(m.data)
        if (r.data) setResponsaveis(r.data)

        const user = (userResult as { data: { user: { user_metadata?: { role?: string } } | null } }).data?.user
        if (user?.user_metadata?.role) {
          setProfile({ role: user.user_metadata.role } as Profile)
        }

        // Merge processos + licitacoes into unified process list
        const merged: (Processo & { processo_atrasado?: boolean; etapas_concluidas?: number; total_etapas?: number; data_fim_prevista_total?: string | null })[] = []
        const seenIds = new Set<string>()

        // Add from processos table
        if (procData) {
          for (const p of procData) {
            seenIds.add(p.id)
            const crono = p.id_processo ? statusCronograma[p.id_processo] : null
            merged.push({
              ...p,
              processo_atrasado: crono?.processo_atrasado ?? false,
              etapas_concluidas: crono?.etapas_concluidas ?? 0,
              total_etapas: crono?.total_etapas ?? 0,
              data_fim_prevista_total: crono?.data_fim_prevista_total ?? null,
            })
          }
        }

        // Add from licitacoes (skip if already in processos by matching NUP)
        if (licData) {
          const procIds = new Set(procData?.map(p => p.id_processo).filter(Boolean) ?? [])
          for (const l of licData) {
            if (l.id_processo && procIds.has(l.id_processo)) continue
            merged.push({
              id: l.id,
              id_processo: l.id_processo,
              objeto_resumido: l.objeto_resumido,
              data_entrada: l.data_entrada,
              data_atividade: null,
              data_entrega: l.data_prevista || null,
              valor_estimado: l.vlr_estimado_anual || 0,
              valor_homologado: l.vlr_homologado || 0,
              progresso: l.progresso || 0,
              prioridade: l.prioridade || null,
              observacoes: l.observacoes || null,
              coordenacao: { nome: l.coordenacao || '' },
              status: { nome: l.status || '' },
              responsavel: { nome: l.responsavel || '' },
              modalidade: { nome: l.modalidade || '' },
              demandante: { nome: l.demandante || '' },
              drive: l.processo_link || null,
              coordenacao_id: null,
              status_id: null,
              responsavel_id: null,
              modalidade_id: null,
              demandante_id: null,
              qtd_itens: null,
              despesa_evitada: null,
              created_by: null,
              created_at: l.created_at || l.data_entrada,
              updated_at: l.created_at || l.data_entrada,
              houve_recurso: null,
              atividade_atual: l.fase_atual || null,
              processo_atrasado: false,
              etapas_concluidas: 0,
              total_etapas: 0,
              data_fim_prevista_total: null,
            })
          }
        }

        // Load cronograma status for all merged processos
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
            setStatusCronograma(map)
            // Update merged items with cronograma data
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

  const [processos, setProcessos] = useState<(Processo & { processo_atrasado?: boolean; etapas_concluidas?: number; total_etapas?: number; data_fim_prevista_total?: string | null })[]>([])

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
      statusCronograma={statusCronograma}
    />
  )
}
