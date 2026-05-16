'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import DashboardContent from './dashboard-content'
import type { Processo, Modalidade, Responsavel } from '@/types/database'

export default function DashboardPage() {
  const [processos, setProcessos] = useState<Processo[]>([])
  const [modalidades, setModalidades] = useState<Modalidade[]>([])
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('processos').select('*, status(nome), responsavel(nome), modalidade(nome), coordenacao(nome)'),
      supabase.from('modalidades').select('*'),
      supabase.from('responsaveis').select('*'),
    ]).then(([p, m, r]) => {
      if (p.error) console.error('Erro ao carregar processos:', p.error)
      if (m.error) console.error('Erro ao carregar modalidades:', m.error)
      if (r.error) console.error('Erro ao carregar responsáveis:', r.error)
      if (p.error || m.error || r.error) setError('Erro ao carregar dados do servidor')
      if (p.data) setProcessos(p.data)
      if (m.data) setModalidades(m.data)
      if (r.data) setResponsaveis(r.data)
      setLoading(false)
    }).catch(err => {
      console.error('Erro inesperado:', err)
      setError(err.message || 'Erro de conexão')
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
      processos={processos}
      modalidades={modalidades}
      responsaveis={responsaveis}
    />
  )
}
