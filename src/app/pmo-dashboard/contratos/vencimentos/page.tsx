'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDateBR } from '@/lib/utils'
import { CONTRATO_STATUS_RECORDS } from '@/types/contratos'
import type { Contrato } from '@/types/contratos'
import { Calendar, AlertTriangle, ArrowRight } from 'lucide-react'

const cardStyle: React.CSSProperties = {
  background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
  borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', padding: 24, marginBottom: 16,
}

function VencimentosContent() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [vencendo7d, setVencendo7d] = useState<Contrato[]>([])
  const [vencendo30d, setVencendo30d] = useState<Contrato[]>([])
  const [vencidos, setVencidos] = useState<Contrato[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const hoje = new Date().toISOString().slice(0, 10)
        const seteDias = new Date()
        seteDias.setDate(seteDias.getDate() + 7)
        const seteDiasStr = seteDias.toISOString().slice(0, 10)
        const trintaDias = new Date()
        trintaDias.setDate(trintaDias.getDate() + 30)
        const trintaDiasStr = trintaDias.toISOString().slice(0, 10)

        const { data: todos, error: err } = await supabase
          .from('contratos')
          .select('*, processos(id_processo, objeto_resumido)')
          .not('data_fim_vigencia', 'is', null)
          .order('data_fim_vigencia', { ascending: true })
          .limit(200)

        if (cancelled) return

        if (err) {
          setError('Erro ao carregar vencimentos')
          setLoading(false)
          return
        }

        const contratos = (todos as Contrato[]) || []
        setVencidos(contratos.filter(c =>
          c.data_fim_vigencia! < hoje && !['encerrado', 'rescindido'].includes(c.status)))
        setVencendo7d(contratos.filter(c =>
          c.data_fim_vigencia! >= hoje && c.data_fim_vigencia! <= seteDiasStr &&
          ['vigente', 'proximo_vencimento'].includes(c.status)))
        setVencendo30d(contratos.filter(c =>
          c.data_fim_vigencia! > seteDiasStr && c.data_fim_vigencia! <= trintaDiasStr &&
          ['vigente', 'proximo_vencimento'].includes(c.status)))
      } catch {
        if (!cancelled) setError('Erro ao carregar vencimentos')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function renderTable(lista: Contrato[], vazio: string) {
    if (lista.length === 0) {
      return <p style={{ fontSize: 13, color: '#64748b', textAlign: 'center', padding: 20 }}>{vazio}</p>
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lista.map(c => {
          const status = CONTRATO_STATUS_RECORDS[c.status as keyof typeof CONTRATO_STATUS_RECORDS]
          const diff = Math.ceil(
            (new Date(c.data_fim_vigencia! + 'T00:00:00').getTime() - new Date().getTime()) / 86400000,
          )
          return (
            <Link key={c.id} href={`/pmo-dashboard/contratos/detalhe?id=${c.id}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 10, textDecoration: 'none',
                background: 'rgba(30,41,59,0.5)', borderLeft: `3px solid ${status?.color || '#64748b'}`,
                gap: 12,
              }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', marginBottom: 2 }}>
                  {c.numero_contrato}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.contratada_nome}
                  {c.processos?.id_processo && ` · ${c.processos.id_processo}`}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>{formatDateBR(c.data_fim_vigencia)}</div>
                <div style={{
                  fontSize: 11, fontWeight: 600,
                  color: diff < 0 ? '#ef4444' : diff <= 7 ? '#f59e0b' : '#22c55e',
                }}>
                  {diff < 0 ? `Vencido há ${Math.abs(diff)}d` : `${diff}d restantes`}
                </div>
              </div>
              <ArrowRight size={14} style={{ color: '#475569', flexShrink: 0 }} />
            </Link>
          )
        })}
      </div>
    )
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Carregando vencimentos...</div>
  }

  if (error) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#ef4444' }}>{error}</div>
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>
          <Calendar size={20} style={{ marginRight: 8, verticalAlign: 'middle', color: '#f59e0b' }} />
          Vencimentos de Contratos
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, margin: '4px 0 0' }}>
          Acompanhamento de prazos contratuais
        </p>
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={16} /> Vencidos ({vencidos.length})
        </h2>
        {renderTable(vencidos, 'Nenhum contrato vencido')}
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={16} /> Vencem em 7 dias ({vencendo7d.length})
        </h2>
        {renderTable(vencendo7d, 'Nenhum contrato vence nos próximos 7 dias')}
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#60a5fa', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Calendar size={16} /> Vencem em 30 dias ({vencendo30d.length})
        </h2>
        {renderTable(vencendo30d, 'Nenhum contrato vence nos próximos 30 dias')}
      </div>
    </div>
  )
}

export default function VencimentosPage() {
  return <VencimentosContent />
}
