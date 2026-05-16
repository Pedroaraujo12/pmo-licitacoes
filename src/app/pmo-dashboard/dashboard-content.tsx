'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { Processo, Modalidade, Responsavel } from '@/types/database'

const statusColors: Record<string, string> = {
  'Não recebido': '#f59e0b',
  'Em andamento': '#2563eb',
  'Concluído': '#22c55e',
  'Devolvido': '#ef4444',
  'Cancelado': '#6b7280',
}

interface Props {
  processos: Processo[]
  modalidades: Modalidade[]
  responsaveis: Responsavel[]
}

export default function DashboardContent({ processos, modalidades, responsaveis }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modalidadeFilter, setModalidadeFilter] = useState('')
  const [responsavelFilter, setResponsavelFilter] = useState('')

  const filtered = useMemo(() => {
    return processos.filter(p => {
      if (search && !p.id_processo?.toLowerCase().includes(search.toLowerCase()) &&
          !p.objeto_resumido?.toLowerCase().includes(search.toLowerCase()))
        return false
      if (statusFilter && p.status?.nome !== statusFilter) return false
      if (modalidadeFilter && p.modalidade?.nome !== modalidadeFilter) return false
      if (responsavelFilter && p.responsavel?.nome !== responsavelFilter) return false
      return true
    })
  }, [processos, search, statusFilter, modalidadeFilter, responsavelFilter])

  const kpis = useMemo(() => {
    const total = processos.length
    const estimado = processos.reduce((s, p) => s + (Number(p.valor_estimado) || 0), 0)
    const homologado = processos.reduce((s, p) => s + (Number(p.valor_homologado) || 0), 0)
    const economia = estimado - homologado
    const atrasados = processos.filter(p => {
      if (!p.data_entrega || !p.progresso) return false
      return new Date(p.data_entrega) < new Date() && (p.progresso || 0) < 100
    }).length
    return { total, estimado, homologado, economia, atrasados }
  }, [processos])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    processos.forEach(p => {
      const s = p.status?.nome || 'Sem status'
      counts[s] = (counts[s] || 0) + 1
    })
    return counts
  }, [processos])

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>
          Gestão de Projetos
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
          AgSUS CCS-RD • Licitações 2026
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KpiCard title="Processos Totais" value={kpis.total} />
        <KpiCard title="Valor Estimado" value={`R$ ${(kpis.estimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
        <KpiCard title="Valor Homologado" value={`R$ ${(kpis.homologado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
        <KpiCard title="Economia" value={`R$ ${(kpis.economia).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color={kpis.economia > 0 ? '#22c55e' : undefined} />
        <KpiCard title="Em Atraso" value={kpis.atrasados} color={kpis.atrasados > 0 ? '#ef4444' : undefined} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="Buscar por ID ou objeto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: 13,
            flex: 1,
            minWidth: 200,
          }}
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}>
          <option value="">Todos Status</option>
          {Object.keys(statusColors).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={modalidadeFilter} onChange={e => setModalidadeFilter(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}>
          <option value="">Todas Modalidades</option>
          {modalidades.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
        </select>
        <select value={responsavelFilter} onChange={e => setResponsavelFilter(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}>
          <option value="">Todos Responsáveis</option>
          {responsaveis.map(r => <option key={r.id} value={r.nome}>{r.nome}</option>)}
        </select>
        <button
          onClick={() => router.push('/pmo-dashboard/processos/novo')}
          style={{
            padding: '8px 16px',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Novo Processo
        </button>
      </div>

      {/* Status Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        {Object.entries(statusCounts).map(([status, count]) => (
          <div key={status} style={{
            background: '#fff',
            borderRadius: 10,
            padding: '12px 16px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: statusColors[status] || '#6b7280',
            }} />
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>{count}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{status}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        overflow: 'auto',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
              <Th>ID Processo</Th>
              <Th>Objeto/Serviço</Th>
              <Th>Atividade Atual</Th>
              <Th>Data Ativ.</Th>
              <Th>Progresso</Th>
              <Th>Status</Th>
              <Th>Responsável</Th>
              <Th>Estimado</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr
                key={p.id}
                onClick={() => router.push(`/pmo-dashboard/processos/${p.id}`)}
                style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <Td style={{ fontWeight: 600, color: '#2563eb' }}>{p.id_processo}</Td>
                <Td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.objeto_resumido}
                </Td>
                <Td>{p.atividade_atual}</Td>
                <Td>{p.data_atividade ? new Date(p.data_atividade).toLocaleDateString('pt-BR') : '-'}</Td>
                <Td>
                  <ProgressBar value={p.progresso || 0} />
                </Td>
                <Td>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 500,
                    background: statusColors[p.status?.nome || ''] + '20',
                    color: statusColors[p.status?.nome || ''] || '#6b7280',
                  }}>
                    {p.status?.nome || '-'}
                  </span>
                </Td>
                <Td>{p.responsavel?.nome || '-'}</Td>
                <Td style={{ textAlign: 'right', fontWeight: 500 }}>
                  {p.valor_estimado ? `R$ ${Number(p.valor_estimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                </Td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <Td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>
                  Nenhum processo encontrado
                </Td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KpiCard({ title, value, color }: { title: string; value: string | number; color?: string }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: '20px',
      border: '1px solid #e2e8f0',
    }}>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || '#0f172a' }}>
        {value}
      </div>
    </div>
  )
}

function ProgressBar({ value }: { value: number }) {
  const color = value >= 100 ? '#22c55e' : value >= 50 ? '#2563eb' : '#f59e0b'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color }}>{value.toFixed(1)}%</span>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>{children}</th>
}

function Td({ children, style, colSpan }: { children: React.ReactNode; style?: React.CSSProperties; colSpan?: number }) {
  return <td style={{ padding: '10px 12px', color: '#334155', ...style }} colSpan={colSpan}>{children}</td>
}
