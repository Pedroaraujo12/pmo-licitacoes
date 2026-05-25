'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getContrato } from '@/lib/contratos'
import { listOrdensServico } from '@/lib/ordens-servico'
import { formatDateBR, formatBRL } from '@/lib/utils'
import { OS_STATUS_RECORDS } from '@/types/contratos'
import type { Contrato, OrdemServico } from '@/types/contratos'
import { ArrowLeft, Plus } from 'lucide-react'

const cardStyle: React.CSSProperties = {
  background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
  borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', padding: 24, marginBottom: 16,
}

export default function OrdensServicoClient({ params }: { params: Promise<{ id: string }> }) {
  const paramsId = use(params).id
  const [id, setId] = useState(paramsId)
  const router = useRouter()
  const supabase = createClient()
  const [contrato, setContrato] = useState<Contrato | null>(null)
  const [ordens, setOrdens] = useState<OrdemServico[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const currentId = id
      if (currentId === 'placeholder') {
        const m = window.location.pathname.match(/\/contratos\/([a-f0-9-]+)\/ordens-servico/)
        if (m && m[1] !== 'placeholder') {
          setId(m[1])
          return
        }
      }
      const [c, osList] = await Promise.all([
        getContrato(supabase, currentId),
        listOrdensServico(supabase, { contrato_id: currentId }),
      ])
      setContrato(c)
      setOrdens(osList)
      setLoading(false)
    }
    load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        {[1, 2].map(i => (
          <div key={i} style={cardStyle}>
            {[1, 2, 3].map(j => (
              <div key={j} style={{ height: 14, background: 'rgba(71,85,105,0.4)', borderRadius: 6, marginBottom: 10, width: `${40 + j * 15}%` }} />
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.push(`/pmo-dashboard/contratos/${id}`)}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>Ordens de Serviço</h1>
          {contrato && (
            <p style={{ color: '#94a3b8', fontSize: 13, margin: '4px 0 0' }}>
              Contrato: {contrato.numero_contrato} — {contrato.contratada_nome}
            </p>
          )}
        </div>
        <button onClick={() => router.push(`/pmo-dashboard/ordens-servico/nova?contrato_id=${id}`)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={14} /> Nova OS
        </button>
      </div>

      {ordens.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748b', fontSize: 14 }}>
          Nenhuma ordem de serviço vinculada a este contrato
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '80px 2fr 120px 130px 110px 80px',
            gap: 8, padding: '8px 16px', fontSize: 11, fontWeight: 700, color: '#64748b',
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            <span>Nº OS</span>
            <span>Objeto</span>
            <span>Data Prevista</span>
            <span>Valor</span>
            <span>Status</span>
            <span>%</span>
          </div>
          {ordens.map(os => {
            const statusRec = OS_STATUS_RECORDS[os.status]
            return (
              <div key={os.id} onClick={() => router.push(`/pmo-dashboard/ordens-servico/${os.id}`)}
                style={{
                  display: 'grid', gridTemplateColumns: '80px 2fr 120px 130px 110px 80px',
                  gap: 8, padding: '12px 16px', background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
                  borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', fontSize: 13,
                  alignItems: 'center', transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(30,41,59,0.9)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(30,41,59,0.7)')}>
                <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{os.numero_os}</span>
                <span style={{ color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{os.objeto || '-'}</span>
                <span style={{ color: '#94a3b8' }}>{formatDateBR(os.data_fim_prevista)}</span>
                <span style={{ color: '#22c55e', fontWeight: 600 }}>{formatBRL(os.valor)}</span>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 6,
                  background: `${statusRec.bgColor}20`, color: statusRec.color, fontWeight: 600,
                  justifySelf: 'start', whiteSpace: 'nowrap',
                }}>{statusRec.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>{os.percentual_execucao || 0}%</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
