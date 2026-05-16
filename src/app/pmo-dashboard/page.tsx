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

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('processos').select('*, status:nome, responsavel:nome, modalidade:nome, coordenacao:nome'),
      supabase.from('modalidades').select('*'),
      supabase.from('responsaveis').select('*'),
    ]).then(([p, m, r]) => {
      if (p.data) setProcessos(p.data)
      if (m.data) setModalidades(m.data)
      if (r.data) setResponsaveis(r.data)
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Carregando...</div>

  return (
    <DashboardContent
      processos={processos}
      modalidades={modalidades}
      responsaveis={responsaveis}
    />
  )
}
