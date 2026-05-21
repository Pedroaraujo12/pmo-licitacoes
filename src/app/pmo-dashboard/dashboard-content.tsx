'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { Edit, Trash2, ExternalLink, AlertTriangle, Download } from 'lucide-react'
import DeleteConfirmDialog from '@/components/ui/delete-confirm-dialog'
import { cleanNum, formatBRL, formatDate, getAging, exportCSV, fetchAllSeiLinks } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import { useToast } from '@/components/ui/toast'
import Pagination from '@/components/ui/pagination'
import type { Processo } from '@/types/database'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement)

interface Props {
  processos: Processo[]
  userRole?: string | null
}

export default function DashboardContent({ processos: initialProcessos, userRole }: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const [processos, setProcessos] = useState<Processo[]>(initialProcessos)
  const [etapaData, setEtapaData] = useState<{ fase: string; qtd: number }[]>([])
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [modalidadeFilter, setModalidadeFilter] = useState('')
  const [responsavelFilter, setResponsavelFilter] = useState('')
  const [prioridadeFilter, setPrioridadeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [faseFilter, setFaseFilter] = useState('')
  const [modalProcesso, setModalProcesso] = useState<Processo | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Processo | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [sortField, setSortField] = useState<string>('data_entrega')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [seiLinks, setSeiLinks] = useState<Record<string, string>>({})
  const [page, setPage] = useState(1)
  const pageSize = 5
  const modalRef = useRef<HTMLDivElement>(null)

  const canEdit = userRole && ['admin', 'gestor', 'consultor'].includes(userRole)
  const canDelete = userRole && ['admin', 'gestor'].includes(userRole)

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error: err1 } = await supabase.from('processos').delete().eq('id', deleteTarget.id)
      if (err1) {
        console.warn('Erro ao excluir:', err1)
        setDeleting(false)
        return
      }
      const deletedId = deleteTarget.id
      toast('Processo excluído com sucesso', 'success')
      setProcessos((prev: Processo[]) => prev.filter(p => p.id !== deletedId))
      setDeleteTarget(null)
      setDeleting(false)
    } catch (err) {
      console.warn('Erro inesperado ao excluir:', err)
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

  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setModalProcesso(null)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    fetchAllSeiLinks(supabase).then(data => { if (!cancelled) setSeiLinks(data) })
    supabase.rpc('get_etapa_distribuicao').then(({ data }: { data: { fase: string; qtd: number }[] | null }) => {
      if (!cancelled && data) setEtapaData(data)
    }).catch(() => {
      if (cancelled) return
      // Fallback: query directly
      supabase.from('cronograma_atividades').select('fase, ordem, processo_id, status')
        .then(({ data }: { data: { fase: string; ordem: number; processo_id: string; status: string }[] | null }) => {
          if (cancelled || !data) return
          const firstNonConcluido = new Map<string, string>()
          const ordered = (data as { fase: string; ordem: number; processo_id: string; status: string }[]).sort((a, b) => a.ordem - b.ordem)
          for (const row of ordered) {
            if (!firstNonConcluido.has(row.processo_id) && row.status !== 'concluido') {
              firstNonConcluido.set(row.processo_id, row.fase)
            }
          }
          const counts: Record<string, number> = {}
          for (const fase of firstNonConcluido.values()) {
            counts[fase] = (counts[fase] || 0) + 1
          }
          if (!cancelled) setEtapaData(Object.entries(counts).map(([fase, qtd]) => ({ fase, qtd })))
        })
    })
    // Fetch cronograma completion status — if all are concluido, clear alertas
    supabase.from('cronograma_atividades').select('processo_id, status').then(({ data }: { data: { processo_id: string; status: string }[] | null }) => {
      if (cancelled || !data) return
      const stats = new Map<string, { total: number; concluido: number }>()
      for (const a of data) {
        const s = stats.get(a.processo_id) || { total: 0, concluido: 0 }
        s.total++
        if (a.status === 'concluido') s.concluido++
        stats.set(a.processo_id, s)
      }
      const concluido: Record<string, boolean> = {}
      for (const [id, s] of stats) concluido[id] = s.total === s.concluido
      if (!cancelled) setProcessos(prev => prev.map(p => ({
        ...p,
        processo_atrasado: concluido[p.id] ? false : (p as Processo).processo_atrasado,
      })))
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!modalProcesso) return
    const el = document.querySelector<HTMLElement>('[role="dialog"]')
    el?.focus()
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const focusable = el?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      if (!focusable || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [modalProcesso])

  const filtered = useMemo(() => {
    return processos.filter(p => {
      if (debouncedSearch && !`${p.id_processo} ${p.objeto_resumido}`.toLowerCase().includes(debouncedSearch.toLowerCase())) return false
      if (modalidadeFilter && (p.modalidades?.nome || 'N/I') !== modalidadeFilter) return false
      if (responsavelFilter && (p.responsaveis?.nome || 'N/I') !== responsavelFilter) return false
      if (statusFilter && (p.status_processo?.nome || '') !== statusFilter) return false
      if (prioridadeFilter && (p.prioridade || 'N/I') !== prioridadeFilter) return false
      if (faseFilter && (p.atividade_atual || '') !== faseFilter) return false
      return true
    }).sort((a, b) => {
      let cmp = 0
      if (sortField === 'id_processo') cmp = (a.id_processo || '').localeCompare(b.id_processo || '')
      else if (sortField === 'objeto_resumido') cmp = (a.objeto_resumido || '').localeCompare(b.objeto_resumido || '')
      else if (sortField === 'atividade_atual') cmp = (a.atividade_atual || '').localeCompare(b.atividade_atual || '')
      else if (sortField === 'prioridade') cmp = (a.prioridade || '').localeCompare(b.prioridade || '')
      else if (sortField === 'data_entrega') cmp = ((a.data_entrega || '') > (b.data_entrega || '') ? 1 : -1)
      else if (sortField === 'valor_estimado') cmp = cleanNum(a.valor_estimado) - cleanNum(b.valor_estimado)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [processos, debouncedSearch, modalidadeFilter, responsavelFilter, statusFilter, prioridadeFilter, faseFilter, sortField, sortDir])

  const totalPages = Math.ceil(filtered.length / pageSize)
  const showingFrom = (page - 1) * pageSize + 1
  const showingTo = Math.min(page * pageSize, filtered.length)

  const prevLenRef = useRef(filtered.length)
  useEffect(() => {
    if (filtered.length < prevLenRef.current && page > 1) setPage(1)
    prevLenRef.current = filtered.length
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered.length, page])

  const kpis = useMemo(() => {
    const total = filtered.length
    const estimado = filtered.reduce((s, p) => s + cleanNum(p.valor_estimado), 0)
    const economia = filtered.reduce((s, p) => {
      const st = p.status_processo?.nome
      if (st !== 'Concluído' && st !== 'Homologado') return s
      const est = cleanNum(p.valor_estimado)
      const hom = cleanNum(p.valor_homologado)
      return s + est - hom
    }, 0)
    const atrasados = filtered.filter(p => getAging(p.data_entrega, p.processo_atrasado).class === 'aging-red').length
    return { total, estimado, economia, atrasados }
  }, [filtered])

  const chartData = useMemo(() => {
    const countBy = (key: string) => {
      const counts: Record<string, number> = {}
      filtered.forEach(p => {
        let v: string
        if (key === 'responsavel') v = p.responsaveis?.nome || 'N/I'
        else if (key === 'modalidade') v = p.modalidades?.nome || 'N/I'
        else return
        if (!v.trim()) v = 'N/I'
        counts[v] = (counts[v] || 0) + 1
      })
      return counts
    }

    const respRaw: Record<string, number> = {}
    filtered
      .filter(p => p.status_processo?.nome === 'Em andamento')
      .forEach(p => {
        const v = p.responsaveis?.nome || 'N/I'
        respRaw[v] = (respRaw[v] || 0) + 1
      })
    const resp = Object.entries(respRaw).sort((a, b) => {
      if (a[0] === 'N/I') return 1
      if (b[0] === 'N/I') return -1
      return b[1] - a[1]
    })
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

  const uniqueResponsaveis = useMemo(() => {
    const set = new Set<string>()
    processos.forEach(p => {
      const resp = p.responsaveis?.nome
      if (resp) set.add(resp)
    })
    return [...set].sort()
  }, [processos])

  const uniqueModalidades = useMemo(() => {
    const set = new Set<string>()
    processos.forEach(p => {
      const mod = p.modalidades?.nome
      if (mod) set.add(mod)
    })
    return [...set].sort()
  }, [processos])

  const uniquePrioridades = ['Baixa', 'Média', 'Alta', 'Urgente']

  return (
    <div>
      {/* Alert Banner */}
      {kpis.atrasados > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px', borderRadius: 12, marginBottom: 20,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
        }}>
          <AlertTriangle size={18} style={{ color: '#fca5a5', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: '#fca5a5' }}>
            <strong>{kpis.atrasados} processo{kpis.atrasados !== 1 ? 's' : ''} em atraso</strong> — verifique os prazos no gráfico abaixo
          </span>
          <span
            onClick={() => router.push('/pmo-dashboard/processos')}
            style={{ marginLeft: 'auto', color: '#60a5fa', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
          >Ver processos →</span>
        </div>
      )}

      {/* KPI Cards — Economia first */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="kpi-card" style={{ borderLeft: '4px solid #22c55e' }}>
          <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Economia</p>
          <h3 className="text-2xl font-extrabold text-emerald-400">{formatBRL(kpis.economia)}</h3>
          <p className="kpi-sub">↑ sobre valor estimado · {filtered.filter(p => p.status_processo?.nome === 'Concluído').length} processos concluídos</p>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">Em Atraso</p>
          <h3 className="text-4xl font-extrabold text-red-100">{kpis.atrasados}</h3>
          <p className="kpi-sub">de {kpis.total} processos</p>
        </div>
        <div className="kpi-card">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Valor Estimado</p>
          <h3 className="text-2xl font-extrabold text-slate-100">{formatBRL(kpis.estimado)}</h3>
          <p className="kpi-sub">Total da carteira</p>
        </div>
        <div className="kpi-card">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Processos Totais</p>
          <h3 className="text-4xl font-extrabold">{kpis.total}</h3>
          <p className="kpi-sub">
            {kpis.total - kpis.atrasados} no prazo · {kpis.atrasados} atrasados
          </p>
        </div>
      </div>

      {/* Filter Bar — simplified for executive view */}
      <div className="filter-bar">
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por ID ou objeto...  ⌘K"
          className="filter-input"
        />
        <select value={modalidadeFilter} onChange={e => setModalidadeFilter(e.target.value)} className="filter-select">
          <option value="">Modalidade</option>
          {uniqueModalidades.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={responsavelFilter} onChange={e => setResponsavelFilter(e.target.value)} className="filter-select">
          <option value="">Responsável</option>
          {uniqueResponsaveis.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={prioridadeFilter} onChange={e => setPrioridadeFilter(e.target.value)} className="filter-select">
          <option value="">Prioridade</option>
          {uniquePrioridades.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button onClick={() => { setSearch(''); setModalidadeFilter(''); setResponsavelFilter(''); setPrioridadeFilter(''); setStatusFilter(''); setFaseFilter('') }}
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
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="text-[9px] font-bold bg-slate-800 px-2 py-0.5 rounded-full text-slate-500">
                {filtered.length} processos
              </span>
              {filtered.length > 0 && (
                <button
                  onClick={() => exportCSV(filtered.map(p => ({
                    'ID Processo': p.id_processo || '',
                    'Objeto': p.objeto_resumido || '',
                    'Atividade Atual': p.atividade_atual || '',
                    'Valor Estimado': p.valor_estimado,
                    'Status': p.status_processo?.nome || '',
                    'Responsável': p.responsaveis?.nome || '',
                    'Data': p.data_entrega,
                  })), 'processos_dashboard')}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded text-[9px] font-bold transition cursor-pointer border-none flex items-center gap-1"
                  title="Exportar CSV"
                >
                  <Download size={10} /> CSV
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left table-fixed">
              <thead className="sticky top-0 bg-[#1e293b] z-10 shadow-sm">
                <tr className="text-[9px] font-black uppercase text-slate-500 border-b border-white/10 tracking-tighter">
                  {(['id_processo', 'objeto_resumido', 'atividade_atual', 'prioridade', 'data_entrega', 'valor_estimado'] as const).map(field => (
                    <th
                      key={field}
                      scope="col"
                      onClick={() => toggleSort(field)}
                      className="cursor-pointer hover:text-slate-300 transition select-none"
                      style={{
                        width: field === 'id_processo' ? '15%' : field === 'objeto_resumido' ? '22%' : field === 'atividade_atual' ? '18%' : field === 'prioridade' ? '8%' : field === 'data_entrega' ? '10%' : '12%',
                        padding: '12px 8px',
                        textAlign: field === 'valor_estimado' ? 'right' : field === 'data_entrega' || field === 'prioridade' ? 'center' : 'left',
                      }}
                    >
                      {field === 'id_processo' ? 'ID Processo' : field === 'objeto_resumido' ? 'Objeto / Serviço' : field === 'atividade_atual' ? 'Atividade Atual' : field === 'prioridade' ? 'Prior.' : field === 'data_entrega' ? 'Data' : 'Estimado'}
                      {sortField === field && (
                        <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </th>
                  ))}
                  {canEdit && <th scope="col" className="w-[15%] px-2 py-3 text-center">Ações</th>}
                </tr>
              </thead>
              <tbody className="text-[10px] divide-y divide-white/5">
                  {filtered.slice((page - 1) * pageSize, page * pageSize).map(p => {
                  const ag = getAging(p.data_entrega, p.processo_atrasado)
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setModalProcesso(p)}
                      className="hover:bg-white/5 transition cursor-pointer"
                    >
                      <td className="px-2 py-3 font-bold text-blue-400 truncate">
                        <a href={seiLinks[p.id] || '#'} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: seiLinks[p.id] ? 'underline' : 'none' }}>{p.id_processo || '-'}</a>
                      </td>
                      <td className="px-2 py-3">
                        <div className="font-bold text-slate-100 truncate">{p.objeto_resumido || '-'}</div>
                      </td>
                      <td className="px-2 py-3">
                        <div className="text-slate-300 truncate">{p.atividade_atual || '-'}</div>
                      </td>
                      <td className="px-2 py-3 text-center">
                        {p.prioridade ? (
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
                            background: p.prioridade === 'Urgente' ? 'rgba(239,68,68,0.2)' :
                              p.prioridade === 'Alta' ? 'rgba(249,115,22,0.2)' :
                              p.prioridade === 'Média' ? 'rgba(234,179,8,0.2)' : 'rgba(34,197,94,0.2)',
                            color: p.prioridade === 'Urgente' ? '#fca5a5' :
                              p.prioridade === 'Alta' ? '#fdba74' :
                              p.prioridade === 'Média' ? '#fde047' : '#86efac',
                          }}>{p.prioridade}</span>
                        ) : <span style={{ color: '#475569' }}>—</span>}
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
                              aria-label="Ver detalhes do processo"
                            >
                              <ExternalLink size={14} />
                            </button>
                            <button
                              onClick={() => router.push(`/pmo-dashboard/processos/editar?id=${p.id}`)}
                              className="p-1.5 rounded-md text-amber-400 hover:bg-amber-500/20 transition cursor-pointer border-none bg-transparent"
                              title="Editar"
                              aria-label="Editar processo"
                            >
                              <Edit size={14} />
                            </button>
                            {canDelete && (
                              <button
                                onClick={() => setDeleteTarget(p)}
                                className="p-1.5 rounded-md text-red-400 hover:bg-red-500/20 transition cursor-pointer border-none bg-transparent"
                                title="Excluir"
                                aria-label="Excluir processo"
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
                    <td colSpan={canEdit ? 7 : 6} className="p-10 text-center opacity-30 uppercase font-black tracking-widest text-[10px]">
                      Sem dados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={filtered.length}
            showingFrom={showingFrom}
            showingTo={showingTo}
            onPageChange={setPage}
            compact
          />
        </div>

        {/* Charts */}
        <div className="space-y-6">
          {/* Distribuição por Responsável */}
          <div className="glass-card p-6">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 className="text-[10px] font-bold uppercase text-cyan-400 tracking-wider">Distribuição por Responsável</h2>
              {responsavelFilter && (
                <span
                  onClick={() => { setResponsavelFilter(''); setStatusFilter(''); setFaseFilter('') }}
                  style={{ color: '#60a5fa', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
                >Limpar filtro ✕</span>
              )}
            </div>
            <div className="h-[220px]">
              {chartData.resp.length > 0 ? (
                <Bar
                  data={{
                    labels: chartData.resp.map(([name]) => name.toUpperCase()),
                    datasets: [{
                      data: chartData.resp.map(([, count]) => count),
                      backgroundColor: chartData.resp.map(([name], i) => {
                        const colors = ['#06b6d4', '#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e', '#ec4899', '#f97316', '#14b8a6', '#a855f7', '#eab308']
                        const base = colors[i % colors.length]
                        if (!responsavelFilter) return base
                        return name === responsavelFilter ? base : 'rgba(100,116,139,0.25)'
                      }),
                      borderRadius: 5,
                    }]
                  }}
                  options={{
                    indexAxis: 'y',
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { grid: { display: false }, ticks: { color: '#475569', font: { size: 8 } } },
                      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', font: { size: 8 } } },
                    },
                    onClick: (_: unknown, elements: { index: number }[]) => {
                      if (elements.length > 0) {
                        const idx = elements[0].index
                        const name = chartData.resp[idx][0]
                        setStatusFilter('Em andamento')
                        setResponsavelFilter(prev => prev === name ? '' : name)
                      }
                    },
                  }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', fontSize: 12 }}>
                  Nenhum dado disponível
                </div>
              )}
            </div>
          </div>

          {/* Distribuição por Etapa do Cronograma */}
          <div className="glass-card p-6">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 className="text-[10px] font-bold uppercase text-indigo-400 tracking-wider">Distribuição por Etapa</h2>
              {faseFilter && (
                <span
                  onClick={() => setFaseFilter('')}
                  style={{ color: '#60a5fa', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
                >Limpar filtro ✕</span>
              )}
            </div>
            <div className="h-[220px]">
              {etapaData.length > 0 ? (
                <Bar
                  data={{
                    labels: etapaData.map(e => e.fase.toUpperCase()),
                    datasets: [{
                      data: etapaData.map(e => e.qtd),
                      backgroundColor: etapaData.map(e => {
                        const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#6366f1', '#22c55e', '#ec4899']
                        const idx = etapaData.indexOf(e)
                        if (!faseFilter) return colors[idx % colors.length]
                        return e.fase === faseFilter ? colors[idx % colors.length] : 'rgba(100,116,139,0.25)'
                      }),
                      borderRadius: 5,
                    }]
                  }}
                  options={{
                    indexAxis: 'y',
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { grid: { display: false }, ticks: { color: '#475569', font: { size: 8 } } },
                      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', font: { size: 8 } } },
                    },
                    onClick: (_: unknown, elements: { index: number }[]) => {
                      if (elements.length > 0) {
                        const idx = elements[0].index
                        const fase = etapaData[idx].fase
                        setFaseFilter(prev => prev === fase ? '' : fase)
                      }
                    },
                  }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', fontSize: 12 }}>
                  Nenhum dado disponível
                </div>
              )}
            </div>
          </div>

          {/* Saúde dos Prazos */}
          <div className="glass-card p-6">
            <h2 className="text-[10px] font-bold uppercase text-emerald-400 mb-4 tracking-wider">Saúde dos Prazos</h2>
            <div className="h-[220px]">
              {chartData.health.g + chartData.health.y + chartData.health.r > 0 ? (
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
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', fontSize: 12 }}>
                  Nenhum dado disponível
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modalProcesso && (
        <div
          role="dialog" aria-modal="true" aria-label="Detalhes do Processo" aria-describedby="modal-desc"
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4"
          onClick={() => setModalProcesso(null)}
        >
          <div
            className="glass-card w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto" ref={modalRef}>
              <div className="col-span-2 p-4 glass-card-inner" id="modal-desc">
                <p className="text-[9px] font-bold text-blue-400 uppercase mb-1">Objeto</p>
                <p className="text-sm font-bold text-slate-100">{modalProcesso.objeto_resumido || '-'}</p>
              </div>
              <div className="p-4 glass-card-inner">
                <p className="text-[9px] font-bold text-slate-500 mb-1">ID</p>
                <a href={seiLinks[modalProcesso.id] || '#'} target="_blank" rel="noopener noreferrer" style={{ color: '#f8fafc', textDecoration: seiLinks[modalProcesso.id] ? 'underline' : 'none' }}><p className="text-base font-black">{modalProcesso.id_processo || '-'}</p></a>
              </div>
              <div className="p-4 glass-card-inner">
                <p className="text-[9px] font-bold text-slate-500 mb-1">Status</p>
                <p className="text-base font-black text-amber-500">{modalProcesso.status_processo?.nome || '-'}</p>
              </div>
              <div className="p-4 glass-card-inner">
                <p className="text-[9px] font-bold text-slate-500 mb-1">Coordenação</p>
                <p className="text-sm font-bold text-slate-100">{modalProcesso.coordenacoes?.nome || '-'}</p>
              </div>
              <div className="p-4 glass-card-inner">
                <p className="text-[9px] font-bold text-slate-500 mb-1">Responsável</p>
                <p className="text-sm font-bold text-slate-100">{modalProcesso.responsaveis?.nome || '-'}</p>
              </div>
              <div className="p-4 glass-card-inner">
                <p className="text-[9px] font-bold text-slate-500 mb-1">Modalidade</p>
                <p className="text-sm font-bold text-slate-100">{modalProcesso.modalidades?.nome || '-'}</p>
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
                  onClick={() => router.push(`/pmo-dashboard/processos/editar?id=${modalProcesso.id}`)}
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
        .aging-gray {
          background-color: #475569;
          color: #cbd5e1;
        }
      `}</style>
    </div>
  )
}
