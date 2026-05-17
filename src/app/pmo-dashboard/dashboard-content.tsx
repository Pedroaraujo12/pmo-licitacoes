'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'
import { Plus, Edit, Trash2, ExternalLink } from 'lucide-react'
import DeleteConfirmDialog from '@/components/ui/delete-confirm-dialog'
import type { Processo, Modalidade, Responsavel } from '@/types/database'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement)

function cleanNum(v: unknown): number {
  if (!v) return 0
  if (typeof v === 'number') return v
  const s = String(v).replace('R$', '').trim()
  if (s.includes(',') && !s.includes('e')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
  }
  return parseFloat(s) || 0
}

function formatBRL(v: unknown) {
  return cleanNum(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(d: string | null | undefined) {
  if (!d || d === 'None') return '-'
  const date = new Date(d)
  if (isNaN(date.getTime())) return d
  return date.toLocaleDateString('pt-BR')
}

function getAging(dateStr: string | null | undefined, processo_atrasado?: boolean) {
  if (dateStr && dateStr !== 'None') {
    const target = new Date(dateStr)
    if (!isNaN(target.getTime())) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const diff = Math.ceil((target.getTime() - today.getTime()) / 86400000)
      if (diff < 0) return { label: `Atrasado ${Math.abs(diff)}d`, class: 'aging-red' }
      if (diff <= 2) return { label: `Vence em ${diff}d`, class: 'aging-yellow' }
      return { label: `No Prazo (${diff}d)`, class: 'aging-green' }
    }
  }
  if (processo_atrasado === true) return { label: 'Atrasado', class: 'aging-red' }
  return { label: 'N/A', class: '' }
}

const chartColors = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899']

interface Props {
  processos: Processo[]
  modalidades: Modalidade[]
  responsaveis: Responsavel[]
  userRole?: string | null
  statusCronograma?: Record<string, unknown>
}

export default function DashboardContent({ processos, modalidades, responsaveis, userRole }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modalidadeFilter, setModalidadeFilter] = useState('')
  const [responsavelFilter, setResponsavelFilter] = useState('')
  const [chartFilter, setChartFilter] = useState<{ type: string; value: string } | null>(null)
  const [modalProcesso, setModalProcesso] = useState<Processo | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Processo | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [sortField, setSortField] = useState<string>('data_entrega')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const modalRef = useRef<HTMLDivElement>(null)

  const canEdit = userRole && ['admin', 'gestor', 'consultor'].includes(userRole)
  const canDelete = userRole && ['admin', 'gestor'].includes(userRole)

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('licitacoes').delete().eq('id', deleteTarget.id)
    if (!error) {
      setDeleteTarget(null)
      setModalProcesso(null)
      window.location.reload()
    } else {
      console.error('Erro ao excluir:', error)
      setDeleting(false)
    }
  }

  function toggleSort(field: string) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setModalProcesso(null)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (modalRef.current) {
      modalRef.current.scrollTop = 0
    }
  }, [modalProcesso])

  const filtered = useMemo(() => {
    return processos.filter(p => {
      if (search && !`${p.id_processo} ${p.objeto_resumido}`.toLowerCase().includes(search.toLowerCase())) return false
      if (chartFilter) {
        if (chartFilter.type === 'responsavel') {
          const resp = p.responsavel?.nome || 'N/I'
          if (resp !== chartFilter.value) return false
        }
        if (chartFilter.type === 'modalidade') {
          const mod = p.modalidade?.nome || 'N/I'
          if (mod !== chartFilter.value) return false
        }
      }
      if (statusFilter) {
        const ag = getAging(p.data_entrega, p.processo_atrasado)
        if (statusFilter === 'Atrasados' && ag.class !== 'aging-red') return false
        if (statusFilter === 'No Prazo' && ag.class === 'aging-red') return false
      }
      if (modalidadeFilter && (p.modalidade?.nome || 'N/I') !== modalidadeFilter) return false
      if (responsavelFilter && (p.responsavel?.nome || 'N/I') !== responsavelFilter) return false
      return true
    }).sort((a, b) => {
      let cmp = 0
      if (sortField === 'id_processo') cmp = (a.id_processo || '').localeCompare(b.id_processo || '')
      else if (sortField === 'objeto_resumido') cmp = (a.objeto_resumido || '').localeCompare(b.objeto_resumido || '')
      else if (sortField === 'atividade_atual') cmp = (a.atividade_atual || '').localeCompare(b.atividade_atual || '')
      else if (sortField === 'data_entrega') cmp = ((a.data_entrega || '') > (b.data_entrega || '') ? 1 : -1)
      else if (sortField === 'valor_estimado') cmp = cleanNum(a.valor_estimado) - cleanNum(b.valor_estimado)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [processos, search, chartFilter, statusFilter, modalidadeFilter, responsavelFilter, sortField, sortDir])

  const kpis = useMemo(() => {
    const total = filtered.length
    const estimado = filtered.reduce((s, p) => s + cleanNum(p.valor_estimado), 0)
    const homologado = filtered.reduce((s, p) => s + cleanNum(p.valor_homologado), 0)
    const economia = filtered.reduce((s, p) => {
      const hom = cleanNum(p.valor_homologado)
      if (hom > 0) return s + cleanNum(p.valor_estimado) - hom
      return s
    }, 0)
    const atrasados = filtered.filter(p => getAging(p.data_entrega, p.processo_atrasado).class === 'aging-red').length
    return { total, estimado, economia, atrasados }
  }, [filtered])

  const chartData = useMemo(() => {
    const countBy = (key: string) => {
      const counts: Record<string, number> = {}
      filtered.forEach(p => {
        let v: string
        if (key === 'responsavel') v = p.responsavel?.nome || 'N/I'
        else if (key === 'modalidade') v = p.modalidade?.nome || 'N/I'
        else return
        if (!v.trim()) v = 'N/I'
        counts[v] = (counts[v] || 0) + 1
      })
      return counts
    }

    const resp = countBy('responsavel')
    const mod = countBy('modalidade')

    const health = filtered.reduce(
      (a, p) => {
        const c = getAging(p.data_entrega, p.processo_atrasado).class
        if (c === 'aging-green') a.g++
        else if (c === 'aging-yellow') a.y++
        else if (c === 'aging-red') a.r++
        return a
      },
      { g: 0, y: 0, r: 0 }
    )

    return { resp, mod, health }
  }, [filtered])

  const uniqueStatuses = useMemo(() => {
    const set = new Set<string>()
    processos.forEach(p => {
      const resp = p.responsavel?.nome
      if (resp) set.add(resp)
    })
    return [...set].sort()
  }, [processos])

  const uniqueModalidades = useMemo(() => {
    const set = new Set<string>()
    processos.forEach(p => {
      const mod = p.modalidade?.nome
      if (mod) set.add(mod)
    })
    return [...set].sort()
  }, [processos])

  function handleChartFilter(type: string, value: string) {
    if (chartFilter?.type === type && chartFilter?.value === value) {
      setChartFilter(null)
    } else {
      setChartFilter({ type, value })
    }
  }

  return (
    <div>
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-center gap-6 mb-10">
        <div className="flex items-center gap-5">
          <div className="h-14 w-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight uppercase">Gestão de Processo</h1>
          </div>
        </div>
        <div className="flex gap-3">
          {canEdit && (
            <button
              onClick={() => router.push('/pmo-dashboard/processos/novo')}
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border-none"
            >
              <Plus size={14} />
              Novo Processo
            </button>
          )}
          <button onClick={() => setChartFilter(null)}
            className="bg-slate-800/50 text-slate-300 px-5 py-2.5 rounded-xl text-xs font-bold border border-slate-700 hover:bg-slate-700/50 transition cursor-pointer">
            Resetar
          </button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="kpi-card">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Processos Totais</p>
          <h3 className="text-4xl font-extrabold">{kpis.total}</h3>
        </div>
        <div className="kpi-card">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Valor Estimado</p>
          <h3 className="text-2xl font-extrabold text-slate-100">{formatBRL(kpis.estimado)}</h3>
        </div>
        <div className="kpi-card border-l-4 border-l-emerald-500">
          <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Economia</p>
          <h3 className="text-2xl font-extrabold text-emerald-400">{formatBRL(kpis.economia)}</h3>
        </div>
        <div className="kpi-card border-l-4 border-l-red-500">
          <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">Em Atraso</p>
          <h3 className="text-4xl font-extrabold text-red-100">{kpis.atrasados}</h3>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar..."
          className="filter-input"
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="filter-select">
          <option value="">Prazo</option>
          <option value="Atrasados">Atrasados</option>
          <option value="No Prazo">No Prazo</option>
        </select>
        <select value={modalidadeFilter} onChange={e => setModalidadeFilter(e.target.value)} className="filter-select">
          <option value="">Modal.</option>
          {uniqueModalidades.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={responsavelFilter} onChange={e => setResponsavelFilter(e.target.value)} className="filter-select">
          <option value="">Resp.</option>
          {uniqueStatuses.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button onClick={() => { setSearch(''); setStatusFilter(''); setModalidadeFilter(''); setResponsavelFilter(''); setChartFilter(null) }}
          className="bg-slate-700 text-white rounded-lg px-3 py-1.5 text-[10px] font-bold hover:bg-slate-600 transition">
          Limpar
        </button>
      </div>

      {/* Main Grid: Table + Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Table */}
        <div className="lg:col-span-2 glass-card overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center">
            <h2 className="text-xs font-bold uppercase text-slate-400">Fluxo de Execução</h2>
            <span className="text-[9px] font-bold bg-slate-800 px-2 py-0.5 rounded-full text-slate-500">
              {filtered.length} processos
            </span>
          </div>
          <div className="overflow-x-hidden overflow-y-auto max-h-[600px]">
            <table className="w-full text-left table-fixed">
              <thead className="sticky top-0 bg-[#1e293b] z-10 shadow-sm">
                <tr className="text-[9px] font-black uppercase text-slate-500 border-b border-white/10 tracking-tighter">
                  {(['id_processo', 'objeto_resumido', 'atividade_atual', 'data_entrega', 'valor_estimado'] as const).map(field => (
                    <th
                      key={field}
                      onClick={() => toggleSort(field)}
                      className="cursor-pointer hover:text-slate-300 transition select-none"
                      style={{
                        width: field === 'id_processo' ? '15%' : field === 'objeto_resumido' ? '25%' : field === 'atividade_atual' ? '20%' : field === 'data_entrega' ? '12%' : '13%',
                        padding: '12px 8px',
                        textAlign: field === 'valor_estimado' ? 'right' : field === 'data_entrega' ? 'center' : 'left',
                      }}
                    >
                      {field === 'id_processo' ? 'ID Processo' : field === 'objeto_resumido' ? 'Objeto / Serviço' : field === 'atividade_atual' ? 'Atividade Atual' : field === 'data_entrega' ? 'Data' : 'Estimado'}
                      {sortField === field && (
                        <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </th>
                  ))}
                  {canEdit && <th className="w-[15%] px-2 py-3 text-center">Ações</th>}
                </tr>
              </thead>
              <tbody className="text-[10px] divide-y divide-white/5">
                  {filtered.map(p => {
                  const ag = getAging(p.data_entrega, p.processo_atrasado)
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setModalProcesso(p)}
                      className="hover:bg-white/5 transition cursor-pointer"
                    >
                      <td className="px-2 py-3 font-bold text-blue-400 truncate">
                        {p.id_processo || '-'}
                      </td>
                      <td className="px-2 py-3">
                        <div className="font-bold text-slate-100 truncate">{p.objeto_resumido || '-'}</div>
                      </td>
                      <td className="px-2 py-3">
                        <div className="text-slate-300 truncate">{p.atividade_atual || '-'}</div>
                      </td>
                      <td className="px-2 py-3 text-center">
                        <span className={`aging-badge ${ag.class}`}>{formatDate(p.data_entrega)}</span>
                      </td>
                      <td className="px-2 py-3 text-right font-bold text-slate-100">
                        {formatBRL(p.valor_estimado)}
                      </td>
                      {canEdit && (
                        <td className="px-2 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => router.push(`/pmo-dashboard/processos/${p.id}`)}
                              className="p-1.5 rounded-md text-blue-400 hover:bg-blue-500/20 transition cursor-pointer border-none bg-transparent"
                              title="Ver detalhes"
                            >
                              <ExternalLink size={14} />
                            </button>
                            <button
                              onClick={() => router.push(`/pmo-dashboard/processos/${p.id}/edit`)}
                              className="p-1.5 rounded-md text-amber-400 hover:bg-amber-500/20 transition cursor-pointer border-none bg-transparent"
                              title="Editar"
                            >
                              <Edit size={14} />
                            </button>
                            {canDelete && (
                              <button
                                onClick={() => setDeleteTarget(p)}
                                className="p-1.5 rounded-md text-red-400 hover:bg-red-500/20 transition cursor-pointer border-none bg-transparent"
                                title="Excluir"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={canEdit ? 6 : 5} className="p-10 text-center opacity-30 uppercase font-black tracking-widest text-[10px]">
                      Sem dados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Charts */}
        <div className="space-y-6">
          {/* Responsáveis */}
          <div className="glass-card p-6">
            <h2 className="text-[10px] font-bold uppercase text-indigo-400 mb-4 tracking-wider">Responsáveis</h2>
            <div className="h-[220px]">
              <Bar
                data={{
                  labels: Object.keys(chartData.resp).sort((a, b) => {
                    if (a === 'N/I') return 1
                    if (b === 'N/I') return -1
                    return chartData.resp[b] - chartData.resp[a]
                  }),
                  datasets: [{
                    data: Object.keys(chartData.resp).sort((a, b) => {
                      if (a === 'N/I') return 1
                      if (b === 'N/I') return -1
                      return chartData.resp[b] - chartData.resp[a]
                    }).map(l => chartData.resp[l]),
                    backgroundColor: chartColors,
                    borderRadius: 5,
                  }]
                }}
                options={{
                  indexAxis: 'y',
                  maintainAspectRatio: false,
                  onClick: (_e, activeEls) => {
                    if (activeEls.length > 0) {
                      const labels = Object.keys(chartData.resp).sort((a, b) => {
                        if (a === 'N/I') return 1; if (b === 'N/I') return -1
                        return chartData.resp[b] - chartData.resp[a]
                      })
                      handleChartFilter('responsavel', labels[activeEls[0].index])
                    }
                  },
                  plugins: {
                    legend: { display: false },
                  },
                  scales: {
                    x: { grid: { display: false }, ticks: { color: '#475569', font: { size: 8 } } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#475569', font: { size: 8 } } },
                  },
                }}
              />
            </div>
          </div>

          {/* Modalidades */}
          <div className="glass-card p-6">
            <h2 className="text-[10px] font-bold uppercase text-blue-400 mb-4 tracking-wider">Modalidades</h2>
            <div className="h-[220px] flex items-center justify-center">
              <Doughnut
                data={{
                  labels: Object.keys(chartData.mod),
                  datasets: [{
                    data: Object.values(chartData.mod),
                    backgroundColor: chartColors,
                    borderRadius: 5,
                  }]
                }}
                options={{
                  maintainAspectRatio: false,
                  onClick: (_e, activeEls) => {
                    if (activeEls.length > 0) {
                      handleChartFilter('modalidade', Object.keys(chartData.mod)[activeEls[0].index])
                    }
                  },
                  plugins: {
                    legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 9 } } },
                  },
                }}
              />
            </div>
          </div>

          {/* Saúde dos Prazos */}
          <div className="glass-card p-6">
            <h2 className="text-[10px] font-bold uppercase text-emerald-400 mb-4 tracking-wider">Saúde dos Prazos</h2>
            <div className="h-[220px]">
              <Bar
                data={{
                  labels: ['No Prazo', 'Alerta', 'Atrasado'],
                  datasets: [{
                    data: [chartData.health.g, chartData.health.y, chartData.health.r],
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                    borderRadius: 5,
                  }]
                }}
                options={{
                  indexAxis: 'y',
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { grid: { display: false }, ticks: { color: '#475569', font: { size: 8 } } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', font: { size: 9, weight: 'bold' } } },
                  },
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modalProcesso && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4"
          onClick={() => setModalProcesso(null)}
        >
          <div
            className="glass-card w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto" ref={modalRef}>
              <div className="col-span-2 p-4 glass-card-inner">
                <p className="text-[9px] font-bold text-blue-400 uppercase mb-1">Objeto</p>
                <p className="text-sm font-bold text-slate-100">{modalProcesso.objeto_resumido || '-'}</p>
              </div>
              <div className="p-4 glass-card-inner">
                <p className="text-[9px] font-bold text-slate-500 mb-1">ID</p>
                <p className="text-base font-black text-white">{modalProcesso.id_processo || '-'}</p>
              </div>
              <div className="p-4 glass-card-inner">
                <p className="text-[9px] font-bold text-slate-500 mb-1">Status</p>
                <p className="text-base font-black text-amber-500">{modalProcesso.status?.nome || '-'}</p>
              </div>
              <div className="p-4 glass-card-inner">
                <p className="text-[9px] font-bold text-slate-500 mb-1">Coordenação</p>
                <p className="text-sm font-bold text-slate-100">{modalProcesso.coordenacao?.nome || '-'}</p>
              </div>
              <div className="p-4 glass-card-inner">
                <p className="text-[9px] font-bold text-slate-500 mb-1">Responsável</p>
                <p className="text-sm font-bold text-slate-100">{modalProcesso.responsavel?.nome || '-'}</p>
              </div>
              <div className="p-4 glass-card-inner">
                <p className="text-[9px] font-bold text-slate-500 mb-1">Modalidade</p>
                <p className="text-sm font-bold text-slate-100">{modalProcesso.modalidade?.nome || '-'}</p>
              </div>
              <div className="p-4 glass-card-inner">
                <p className="text-[9px] font-bold text-slate-500 mb-1">Estimado</p>
                <p className="text-sm font-bold text-slate-100">{formatBRL(modalProcesso.valor_estimado)}</p>
              </div>
              <div className="p-4 glass-card-inner">
                <p className="text-[9px] font-bold text-emerald-500 mb-1">Homologado</p>
                <p className="text-sm font-bold text-emerald-400">{formatBRL(modalProcesso.valor_homologado)}</p>
              </div>
              <div className="p-4 glass-card-inner">
                <p className="text-[9px] font-bold text-slate-500 mb-1">Atividade Atual</p>
                <p className="text-sm font-bold text-slate-100">{modalProcesso.atividade_atual || '-'}</p>
              </div>
              <div className="p-4 glass-card-inner">
                <p className="text-[9px] font-bold text-slate-500 mb-1">Progresso</p>
                <p className="text-sm font-bold text-slate-100">
                  {modalProcesso.total_etapas ? `${modalProcesso.etapas_concluidas}/${modalProcesso.total_etapas} etapas` : modalProcesso.progresso != null ? `${modalProcesso.progresso}%` : '-'}
                </p>
              </div>
              {modalProcesso.observacoes && (
                <div className="col-span-2 p-4 glass-card-inner">
                  <p className="text-[9px] font-bold text-slate-500 mb-1">Observações</p>
                  <p className="text-xs text-slate-300">{modalProcesso.observacoes}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => router.push(`/pmo-dashboard/processos/${modalProcesso.id}`)}
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-[10px] font-bold transition cursor-pointer border-none flex items-center gap-1.5"
              >
                <ExternalLink size={12} />
                Ver Detalhes
              </button>
              {canEdit && (
                <button
                  onClick={() => router.push(`/pmo-dashboard/processos/${modalProcesso.id}/edit`)}
                  className="bg-amber-600 hover:bg-amber-500 text-white px-5 py-2 rounded-lg text-[10px] font-bold transition cursor-pointer border-none flex items-center gap-1.5"
                >
                  <Edit size={12} />
                  Editar
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => { setDeleteTarget(modalProcesso); setModalProcesso(null) }}
                  className="bg-red-600 hover:bg-red-500 text-white px-5 py-2 rounded-lg text-[10px] font-bold transition cursor-pointer border-none flex items-center gap-1.5"
                >
                  <Trash2 size={12} />
                  Excluir
                </button>
              )}
              <button onClick={() => setModalProcesso(null)}
                className="bg-slate-700 hover:bg-slate-600 text-white px-5 py-2 rounded-lg text-[10px] font-bold transition cursor-pointer border-none">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onClose={() => { setDeleteTarget(null); setDeleting(false) }}
        onConfirm={handleDelete}
        loading={deleting}
        titulo="Excluir Processo"
        mensagem={`Tem certeza que deseja excluir o processo "${deleteTarget?.id_processo}"? Esta ação é irreversível.`}
      />

      <style jsx>{`
        .glass-card {
          background: rgba(30, 41, 59, 0.7);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1.25rem;
        }
        .glass-card-inner {
          background: rgba(30, 41, 59, 0.5);
          border-radius: 0.75rem;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
        .kpi-card {
          background: rgba(30, 41, 59, 0.7);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1.25rem;
          padding: 1.5rem;
          transition: transform 0.2s;
        }
        .kpi-card:hover {
          transform: translateY(-4px);
        }
        .filter-bar {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          background: rgba(30, 41, 59, 0.7);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1rem;
          padding: 1rem;
          margin-bottom: 2rem;
          align-items: center;
        }
        .filter-input {
          background: rgba(30, 41, 59, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          padding: 0.375rem 0.5rem;
          font-size: 10px;
          color: #cbd5e1;
          flex: 1;
          min-width: 120px;
          outline: none;
        }
        .filter-input:focus {
          border-color: rgba(59, 130, 246, 0.5);
        }
        .filter-select {
          background: rgba(30, 41, 59, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          padding: 0.375rem 0.5rem;
          font-size: 10px;
          color: #cbd5e1;
          outline: none;
        }
        .filter-select:focus {
          border-color: rgba(59, 130, 246, 0.5);
        }
        .aging-badge {
          font-size: 8px;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 900;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .aging-red {
          background-color: #ef4444;
          color: white;
        }
        .aging-yellow {
          background-color: #eab308;
          color: black;
        }
        .aging-green {
          background-color: #22c55e;
          color: white;
        }
      `}</style>
    </div>
  )
}
