'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import DashboardContent from './dashboard-content'
import type { Modalidade, Responsavel } from '@/types/database'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('licitacoes').select('*').order('created_at', { ascending: false }),
      supabase.from('modalidades').select('*'),
      supabase.from('responsaveis').select('*'),
    ]).then(([l, m, r]) => {
      const errs = [l.error, m.error, r.error].filter(Boolean)
      if (errs.length > 0) {
        console.error('Erros Supabase:', errs)
        setError(errs.map((e: unknown) => (e as { message: string }).message).join(' | '))
        setLoading(false)
        return
      }
      if (l.data) setLicitacoes(l.data as Licitacao[])
      if (m.data) setModalidades(m.data)
      if (r.data) setResponsaveis(r.data)
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

  return (
    <DashboardContent
      processos={licitacoes.map(l => ({
        id: l.id,
        id_processo: l.id_processo,
        objeto_resumido: l.objeto_resumido || l.objeto_detalhado,
        atividade_atual: l.fase_atual,
        data_entrega: l.data_prevista,
        data_atividade: l.data_prevista,
        valor_estimado: l.vlr_estimado_anual,
        valor_homologado: l.vlr_homologado,
        progresso: l.progresso,
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
        created_at: l.created_at,
        updated_at: l.created_at,
        houve_recurso: null,
      }))}
      modalidades={modalidades}
      responsaveis={responsaveis}
    />
  )
}
