'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { listOrdensServico } from '@/lib/ordens-servico'
import { formatDateBR, formatBRL } from '@/lib/utils'
import { OS_STATUS_RECORDS } from '@/types/contratos'
import type { OrdemServico } from '@/types/contratos'
import { Plus, Search } from 'lucide-react'

const baseInput: React.CSSProperties = {
  padding: '8px 10px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
  fontSize: 13, background: 'rgba(30,41,59,0.5)', color: '#cbd5e1', outline: 'none',
}

export default function OrdensServicoListPage() {
  const router = useRouter()
  const supabase = createClient()
  const [ordens, setOrdens] = useState<OrdemServico[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  async function load() {
    setLoading(true)
    const data = await listOrdensServico(supabase, {
      search: search || undefined,
      status: statusFilter || undefined,
      limit: 100,
    })
    setOrdens(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [search, statusFilter]) // eslint-disable-line react-hooks/set-state-in-effect,react-hooks/exhaustive-deps

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>Ordens de Serviço</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: '4px 0 0' }}>{ordens.length} registro(s)</p>
        </div>
        <button onClick={() => router.push('/pmo-dashboard/ordens-servico/nova')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={14} /> Nova OS
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#64748b' }} />
          <input placeholder="Buscar por Nº OS ou Objeto..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...baseInput, paddingLeft: 32, width: '100%' }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...baseInput, minWidth: 160, cursor: 'pointer' }}>
          <option value="">Todos os status</option>
          {Object.entries(OS_STATUS_RECORDS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ height: 56, background: 'rgba(30,41,59,0.5)', borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ height: 14, background: 'rgba(71,85,105,0.4)', borderRadius: 6, width: '60%' }} />
            </div>
          ))}
        </div>
      ) : ordens.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748b', fontSize: 14 }}>
          Nenhuma ordem de serviço encontrada
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '80px 1fr 2fr 120px 130px 120px 100px 80px',
            gap: 8, padding: '8px 16px', fontSize: 11, fontWeight: 700, color: '#64748b',
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            <span>Nº OS</span>
            <span>Contrato</span>
            <span>Objeto</span>
            <span>Data Prevista</span>
            <span>Valor</span>
            <span>Status</span>
            <span>%</span>
          </div>
          {ordens.map(os => {
            const statusRec = OS_STATUS_RECORDS[os.status]
            return (
              <div key={os.id} onClick={() => router.push(`/pmo-dashboard/ordens-servico/detalhe?id=${os.id}`)}
                style={{
                  display: 'grid', gridTemplateColumns: '80px 1fr 2fr 120px 130px 120px 100px 80px',
                  gap: 8, padding: '12px 16px', background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
                  borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', fontSize: 13,
                  alignItems: 'center', transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(30,41,59,0.9)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(30,41,59,0.7)')}>
                <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{os.numero_os}</span>
                <span style={{ color: '#94a3b8' }}>{os.contratos?.numero_contrato || '-'}</span>
                <span style={{ color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{os.objeto || '-'}</span>
                <span style={{ color: '#94a3b8' }}>{formatDateBR(os.data_fim_prevista)}</span>
                <span style={{ color: '#22c55e', fontWeight: 600 }}>{formatBRL(os.valor)}</span>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 6,
                  background: `${statusRec.bgColor}20`, color: statusRec.color, fontWeight: 600,
                  justifySelf: 'start',
                  whiteSpace: 'nowrap',
                }}>{statusRec.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden', minWidth: 50 }}>
                    <div style={{ height: '100%', width: `${Math.min(os.percentual_execucao || 0, 100)}%`, background: '#3b82f6', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', minWidth: 30 }}>{os.percentual_execucao || 0}%</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
