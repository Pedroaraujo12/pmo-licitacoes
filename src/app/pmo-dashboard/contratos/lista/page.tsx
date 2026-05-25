'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { listContratos } from '@/lib/contratos'
import { formatDateBR, formatBRL } from '@/lib/utils'
import type { Contrato, ContratoFilters } from '@/types/contratos'
import { CONTRATO_STATUS_RECORDS } from '@/types/contratos'
import { useIsMobile } from '@/hooks/useIsMobile'
import { Search, Plus, FileText, ArrowLeft, X } from 'lucide-react'

const baseInput: React.CSSProperties = {
  padding: '8px 10px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
  fontSize: 13, background: 'rgba(30,41,59,0.5)', color: '#cbd5e1', outline: 'none',
}

export default function ContratosListPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const isMobile = useIsMobile()

  const [contratos, setContratos] = useState<Contrato[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [semFiscal, setSemFiscal] = useState(false)
  const [vigenciaFilter, setVigenciaFilter] = useState<string>(
    () => searchParams?.get('vigencia') || ''
  )

  useEffect(() => {
    async function load() {
      setLoading(true)
      const filters: ContratoFilters = {}
      if (search.trim()) filters.search = search.trim()
      if (statusFilter) filters.status = statusFilter as ContratoFilters['status']
      if (semFiscal) filters.sem_fiscal = true
      if (vigenciaFilter) filters.vigencia = vigenciaFilter as 'vence_30d' | 'vencidos'
      const data = await listContratos(supabase, filters)
      setContratos(data)
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, semFiscal, vigenciaFilter])

  function getStatusBadge(status: keyof typeof CONTRATO_STATUS_RECORDS) {
    const rec = CONTRATO_STATUS_RECORDS[status]
    if (!rec) return null
    return (
      <span style={{
        fontSize: 11, padding: '2px 8px', borderRadius: 8,
        background: `${rec.color}20`, color: rec.color, fontWeight: 600,
        whiteSpace: 'nowrap',
      }}>
        {rec.label}
      </span>
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center',
        marginBottom: 20, gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/pmo-dashboard/contratos')}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>Contratos</h1>
            <p style={{ color: '#64748b', fontSize: 14, margin: '4px 0 0' }}>{contratos.length} contrato{contratos.length !== 1 ? 's' : ''} encontrado{contratos.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/pmo-dashboard/contratos/novo"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', background: '#2563eb', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', textDecoration: 'none',
            }}>
            <Plus size={14} /> Novo Contrato
          </Link>
          <Link href="/pmo-dashboard/processos"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', background: '#334155', color: '#f1f5f9',
              border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', textDecoration: 'none',
            }}>
            <FileText size={14} /> Criar a partir de Processo
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#64748b' }} />
          <input placeholder="Buscar por nº contrato, contratada, objeto..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...baseInput, paddingLeft: 32, width: '100%' }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...baseInput, minWidth: 150 }}>
          <option value="">Todos os status</option>
          {Object.entries(CONTRATO_STATUS_RECORDS).map(([key, rec]) => (
            <option key={key} value={key}>{rec.label}</option>
          ))}
        </select>
        <select value={vigenciaFilter} onChange={e => setVigenciaFilter(e.target.value)} style={{ ...baseInput, minWidth: 130 }}>
          <option value="">Todas vigências</option>
          <option value="vence_30d">Vence em 30 dias</option>
          <option value="vencidos">Vencidos</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={semFiscal} onChange={e => setSemFiscal(e.target.checked)}
            style={{ accentColor: '#f59e0b' }} />
          Sem fiscal
        </label>
        {(search || statusFilter || vigenciaFilter || semFiscal) && (
          <button onClick={() => { setSearch(''); setStatusFilter(''); setVigenciaFilter(''); setSemFiscal(false) }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11, cursor: 'pointer' }}>
            <X size={12} /> Limpar
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{
              height: 52, background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
              borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
            }} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && contratos.length === 0 && (
        <div style={{
          textAlign: 'center', padding: 60, color: '#64748b',
          background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
          borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <FileText size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ fontSize: 14, margin: '0 0 4px', fontWeight: 500 }}>Nenhum contrato encontrado</p>
          <p style={{ fontSize: 12, margin: 0 }}>Tente ajustar os filtros ou crie um novo contrato.</p>
        </div>
      )}

      {/* Mobile card view */}
      {!loading && contratos.length > 0 && isMobile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {contratos.map(c => (
            <div key={c.id} onClick={() => router.push(`/pmo-dashboard/contratos/${c.id}`)}
              style={{
                padding: '14px 16px', background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
                borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: '#f1f5f9' }}>{c.numero_contrato}</span>
                {getStatusBadge(c.status)}
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{c.contratada_nome}</div>
              {c.objeto && <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, lineHeight: 1.4 }}>{c.objeto}</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}>
                <span>Vig: {formatDateBR(c.data_inicio_vigencia)} - {formatDateBR(c.data_fim_vigencia)}</span>
                <span>{formatBRL(c.valor_atual)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table view */}
      {!loading && contratos.length > 0 && !isMobile && (
        <div style={{
          background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
          borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {['Nº Contrato', 'Contratada', 'Objeto', 'Vigência', 'Valor', 'Executado', 'Status'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '12px 16px', color: '#64748b',
                    fontWeight: 600, fontSize: 11, textTransform: 'uppercase',
                    letterSpacing: '0.05em', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contratos.map(c => (
                <tr key={c.id} onClick={() => router.push(`/pmo-dashboard/contratos/${c.id}`)}
                  style={{
                    cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#f1f5f9' }}>{c.numero_contrato}</td>
                  <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>{c.contratada_nome}</td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.objeto || '-'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8', whiteSpace: 'nowrap', fontSize: 12 }}>
                    {formatDateBR(c.data_inicio_vigencia)} - {formatDateBR(c.data_fim_vigencia)}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#22c55e', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {formatBRL(c.valor_atual)}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#60a5fa', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {formatBRL(c.valor_executado)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {getStatusBadge(c.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
