'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import DashboardContent from './dashboard-content'
import type { Modalidade, Responsavel, Profile, StatusProcessoCronograma } from '@/types/database'

interface Licitacao {
  id: string
  id_processo: string
  objeto_resumido: string
  objeto_detalhado: string
  status: string
  fase_atual: string
  data_entrada: string
  data_prevista: string
  data_homologacao: string
  vlr_estimado_anual: number
  vlr_homologado: number
  modalidade: string
  responsavel: string
  coordenacao: string
  demandante: string
  prioridade: string
  progresso: number
  observacoes: string
  processo_link: string
  created_at: string
}

export default function DashboardPage() {
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([])
  const [modalidades, setModalidades] = useState<Modalidade[]>([])
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([])
  const [statusCronograma, setStatusCronograma] = useState<Record<string, StatusProcessoCronograma>>({})
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('licitacoes').select('*').order('data_entrada', { ascending: false }),
      supabase.from('modalidades').select('*'),
      supabase.from('responsaveis').select('*'),
      supabase.auth.getUser(),
    ]).then(async ([l, m, r, userResult]) => {
      const errors = [l.error, m.error, r.error].filter(Boolean)
      if (errors.length > 0) {
        console.error('Erros Supabase:', errors)
        setError(errors.map((e: unknown) => (e as { message: string }).message).join(' | '))
        setLoading(false)
        return
      }
      const licData = l.data as Licitacao[] | null
      if (licData) setLicitacoes(licData)
      if (m.data) setModalidades(m.data)
      if (r.data) setResponsaveis(r.data)

      // Carregar status do cronograma para cada licitação
      if (licData && licData.length > 0) {
        const idProcessos = licData.map(l => l.id_processo).filter(Boolean)
        if (idProcessos.length > 0) {
          const { data: cronData } = await supabase
            .from('vw_status_processo_cronograma')
            .select('*')
            .in('id_processo', idProcessos)
          if (cronData) {
            const map: Record<string, StatusProcessoCronograma> = {}
            ;(cronData as StatusProcessoCronograma[]).forEach(c => {
              if (c.id_processo) map[c.id_processo] = c
            })
            setStatusCronograma(map)
          }
        }
      }

      const user = (userResult as { data: { user: { user_metadata?: { role?: string } } | null } }).data?.user
      if (user?.user_metadata?.role) {
        setProfile({ role: user.user_metadata.role } as Profile)
      }
      setLoading(false)
    }).catch(err => {
      console.error('Erro inesperado:', err)
      setError(err?.message || 'Erro de conexão')
      setLoading(false)
    })
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

  const processos = licitacoes.map(l => {
    const crono = l.id_processo ? statusCronograma[l.id_processo] : null
    return {
      id: l.id,
      id_processo: l.id_processo,
      objeto_resumido: l.objeto_resumido || l.objeto_detalhado,
      atividade_atual: crono?.atividade_atual || l.fase_atual || '-',
      data_entrega: crono?.data_fim_atividade_atual || l.data_prevista || null,
      data_atividade: crono?.data_fim_atividade_atual || l.data_prevista || null,
      valor_estimado: l.vlr_estimado_anual,
      valor_homologado: l.vlr_homologado,
      progresso: crono?.progresso_calculado ?? l.progresso ?? 0,
      prioridade: l.prioridade,
      observacoes: l.observacoes,
      coordenacao: { nome: l.coordenacao },
      status: { nome: l.status },
      responsavel: { nome: l.responsavel },
      modalidade: { nome: l.modalidade },
      demandante: { nome: l.demandante },
      data_entrada: l.data_entrada,
      drive: l.processo_link,
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
      processo_atrasado: crono?.processo_atrasado ?? false,
      etapas_concluidas: crono?.etapas_concluidas ?? 0,
      total_etapas: crono?.total_etapas ?? 0,
      data_fim_prevista_total: crono?.data_fim_prevista_total ?? null,
    }
  })

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
