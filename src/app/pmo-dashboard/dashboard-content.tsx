'use client'

import { useState, useMemo, useEffect, useRef, useCallback, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Edit, Trash2, ExternalLink, AlertTriangle, Download } from 'lucide-react'
import DeleteConfirmDialog from '@/components/ui/delete-confirm-dialog'
import { formatBRL, formatDate, getAging, exportCSV, fetchAllSeiLinks } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import { useToast } from '@/components/ui/toast'
import Pagination from '@/components/ui/pagination'
import AniversariantesWidget from '@/components/ui/colaboradores/aniversariantes-widget'
import NotesWidget from '@/components/ui/notes/notes-widget'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import ContratosWidget from '@/components/ui/contratos/contratos-widget'

const DashboardCharts = dynamic(() => import('@/components/dashboard/DashboardCharts'), {
  ssr: false,
  loading: () => (
    <div className="space-y-6">
      {[1, 2, 3].map(i => (
        <div key={i} className="glass-card p-6">
          <div className="h-[220px] flex items-center justify-center">
            <div className="animate-pulse space-y-3 w-full">
              <div className="h-3 bg-gray-700 rounded w-1/3 mx-auto" />
              <div className="h-3 bg-gray-700 rounded w-1/2 mx-auto" />
              <div className="h-3 bg-gray-700 rounded w-2/3 mx-auto" />
            </div>
          </div>
        </div>
      ))}
    </div>
  ),
})

interface DashboardSummary {
  total_processos: number
  processos_atrasados: number
  processos_vencendo_7_dias: number
  valor_estimado_total: number
  valor_homologado_total: number
  economia_total: number
  por_status: { status: string | null; total: number }[]
  por_modalidade: { modalidade: string | null; total: number }[]
  etapa_distribuicao: { fase: string | null; qtd: number }[]
  aniversariantes_15_dias: { id: string; nome: string; dia: number; mes: number; unidade: string | null }[]
}

interface ProcessoRow {
  id: string
  id_processo: string
  objeto_resumido: string
  data_entrada: string
  data_entrega: string
  valor_estimado: number
  valor_homologado: number
  prioridade: string
  status_nome: string
  modalidade_nome: string
  responsavel_nome: string
  coordenacao_nome: string
  demandante_nome: string
  total_count: number
}

const PAGE_SIZE = 5

export default function DashboardContent({ userRole }: { userRole?: string | null }) {
  const { toast } = useToast()
  const router = useRouter()

  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [rows, setRows] = useState<ProcessoRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [loadingRows, setLoadingRows] = useState(true)
  const [porResponsavel, setPorResponsavel] = useState<[string | null, number][]>([])

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [modalidadeFilter, setModalidadeFilter] = useState('')
  const [prioridadeFilter, setPrioridadeFilter] = useState('')
  const [responsavelFilter, setResponsavelFilter] = useState<string | null>(null)
  const [modalidadeChartFilter, setModalidadeChartFilter] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [seiLinks, setSeiLinks] = useState<Record<string, string>>({})

  const [modalProcesso, setModalProcesso] = useState<ProcessoRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProcessoRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const canEdit = userRole && ['admin', 'gestor', 'consultor'].includes(userRole)
  const canDelete = userRole && ['admin', 'gestor'].includes(userRole)

  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const getSupabase = useCallback(() => {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }, [])

  // Load dashboard summary (KPIs + chart data) — 1 chamada
  useEffect(() => {
    let cancelled = false
    const watchdog = window.setTimeout(() => {
      if (!cancelled) {
        setLoadingSummary(false)
        if (!summary) {
          setSummary({
            total_processos: 0,
            processos_atrasados: 0,
            processos_vencendo_7_dias: 0,
            valor_estimado_total: 0,
            valor_homologado_total: 0,
            economia_total: 0,
            por_status: [],
            por_modalidade: [],
            etapa_distribuicao: [],
            aniversariantes_15_dias: [],
          })
        }
      }
    }, 12000)
    getSupabase().rpc('get_dashboard_summary').then(
      ({ data }: { data: DashboardSummary | null }) => {
        if (!cancelled && data) setSummary(data)
        if (!cancelled) setLoadingSummary(false)
      },
      () => { if (!cancelled) setLoadingSummary(false) },
    )
    return () => { cancelled = true; window.clearTimeout(watchdog) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load paginated processos — 1 chamada
  useEffect(() => {
    let cancelled = false
    setLoadingRows(true) /* eslint-disable-line react-hooks/set-state-in-effect */
    const supabase = getSupabase()

    if (responsavelFilter || modalidadeChartFilter) {
      const params: Record<string, unknown> = { p_limit: 1000, p_offset: 0 }
      if (debouncedSearch) params.p_search = debouncedSearch
      if (modalidadeFilter) params.p_modalidade_id = modalidadeFilter
      if (prioridadeFilter) params.p_prioridade = prioridadeFilter

      supabase.rpc('search_processos', params).then(
        ({ data }: { data: ProcessoRow[] | null }) => {
          if (cancelled) return
          const filtered = (data || []).filter((p) => {
            if (responsavelFilter) {
              const matchesResp = (p.responsavel_nome || 'Sem responsável').trim() === responsavelFilter
              const matchesStatus = (p.status_nome || '').trim() === 'Em andamento'
              if (!matchesResp || !matchesStatus) return false
            }
            if (modalidadeChartFilter) {
              const matchesModalidade = (p.modalidade_nome || 'Sem modalidade').trim() === modalidadeChartFilter
              if (!matchesModalidade) return false
            }
            return true
          })
          const total = filtered.length
          const offset = (page - 1) * PAGE_SIZE
          setRows(filtered.slice(offset, offset + PAGE_SIZE))
          setTotalCount(total)
          setLoadingRows(false)
        },
        () => { if (!cancelled) setLoadingRows(false) },
      )
    } else {
      const offset = (page - 1) * PAGE_SIZE
      const params: Record<string, unknown> = { p_limit: PAGE_SIZE, p_offset: offset }
      if (debouncedSearch) params.p_search = debouncedSearch
      if (modalidadeFilter) params.p_modalidade_id = modalidadeFilter
      if (prioridadeFilter) params.p_prioridade = prioridadeFilter

      supabase.rpc('search_processos', params).then(
        ({ data }: { data: ProcessoRow[] | null }) => {
          if (cancelled) return
          if (data && data.length > 0) {
            setRows(data)
            setTotalCount(data[0].total_count)
          } else {
            setRows([])
            setTotalCount(0)
          }
          setLoadingRows(false)
        },
        () => { if (!cancelled) setLoadingRows(false) },
      )
    }
    return () => { cancelled = true }
  }, [page, debouncedSearch, modalidadeFilter, prioridadeFilter, responsavelFilter, modalidadeChartFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchAllSeiLinks(getSupabase()).then(setSeiLinks).catch(() => setSeiLinks({}))
  }, [getSupabase])

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

  const kpis = useMemo(() => {
    if (loadingSummary && !summary) return { total: 0, estimado: 0, economia: 0, atrasados: 0, concluidos: 0 }
    if (!summary) return { total: 0, estimado: 0, economia: 0, atrasados: 0, concluidos: 0 }
    return {
      total: summary.total_processos,
      estimado: summary.valor_estimado_total,
      economia: summary.economia_total,
      atrasados: summary.processos_atrasados,
      concluidos: summary.por_status.find(s => s.status === 'Concluído')?.total || 0,
    }
  }, [loadingSummary, summary])

  const chartData = useMemo(() => {
    if (!summary) return { resp: [] as [string | null, number][], mod: [] as [string | null, number][] }
    return {
      resp: porResponsavel,
      mod: summary.por_modalidade.map(m => [m.modalidade, m.total] as [string | null, number]),
    }
  }, [summary, porResponsavel])

  // Carrega distribuição de processos em andamento por responsável.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = getSupabase()
      const { data } = await supabase.rpc('search_processos', {
        p_search: null,
        p_status_id: null,
        p_modalidade_id: null,
        p_responsavel_id: null,
        p_coordenacao_id: null,
        p_data_inicio: null,
        p_data_fim: null,
        p_prioridade: null,
        p_limit: 1000,
        p_offset: 0,
      })
      if (cancelled) return
      const bucket = new Map<string, number>()
      for (const row of (data as ProcessoRow[] | null) || []) {
        if ((row.status_nome || '').trim() !== 'Em andamento') continue
        const key = (row.responsavel_nome || 'Sem responsável').trim() || 'Sem responsável'
        bucket.set(key, (bucket.get(key) || 0) + 1)
      }
      const series = Array.from(bucket.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => [name, count] as [string, number])
      setPorResponsavel(series)
    })()
    return () => { cancelled = true }
  }, [getSupabase])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error: err1 } = await getSupabase().from('processos').delete().eq('id', deleteTarget.id)
      if (err1) {
        console.warn('Erro ao excluir:', err1)
        setDeleting(false)
        return
      }
      toast('Processo excluído com sucesso', 'success')
      setRows(prev => prev.filter(p => p.id !== deleteTarget.id))
      setTotalCount(prev => prev - 1)
      setDeleteTarget(null)
      setDeleting(false)
    } catch (err) {
      console.warn('Erro inesperado ao excluir:', err)
      setDeleting(false)
    }
  }

  const showingFrom = (page - 1) * PAGE_SIZE + 1
  const showingTo = Math.min(page * PAGE_SIZE, totalCount)
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

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
            onClick={() => router.push('/pmo-dashboard/processos?atrasados=1')}
            style={{ marginLeft: 'auto', color: '#60a5fa', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
          >Ver processos →</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="kpi-card" style={{ borderLeft: '4px solid #22c55e' }}>
          <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Economia</p>
          <h3 className="text-2xl font-extrabold text-emerald-400">{formatBRL(kpis.economia)}</h3>
          <p className="kpi-sub">↑ sobre valor estimado · {kpis.concluidos} processos concluídos</p>
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

      {/* Widgets extra */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <ErrorBoundary><ContratosWidget /></ErrorBoundary>
        <ErrorBoundary><AniversariantesWidget /></ErrorBoundary>
        <ErrorBoundary><NotesWidget /></ErrorBoundary>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Buscar por ID ou objeto...  ⌘K"
          className="filter-input"
        />
        <select value={modalidadeFilter} onChange={e => { setModalidadeFilter(e.target.value); setPage(1) }} className="filter-select">
          <option value="">Modalidade</option>
          {summary?.por_modalidade.filter(m => m.modalidade).map(m => (
            <option key={m.modalidade} value={m.modalidade || ''}>{m.modalidade}</option>
          ))}
        </select>
        <select value={prioridadeFilter} onChange={e => { setPrioridadeFilter(e.target.value); setPage(1) }} className="filter-select">
          <option value="">Prioridade</option>
          {uniquePrioridades.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button onClick={() => { setSearch(''); setModalidadeFilter(''); setPrioridadeFilter(''); setResponsavelFilter(null); setModalidadeChartFilter(null); setPage(1) }}
          className="bg-slate-700 text-white rounded-lg px-3 py-1.5 text-[10px] font-bold hover:bg-slate-600 transition">
          Limpar
        </button>
        {responsavelFilter && (
          <span className="text-[10px] text-blue-300 font-bold">
            Responsável: {responsavelFilter}
          </span>
        )}
        {modalidadeChartFilter && (
          <span className="text-[10px] text-cyan-300 font-bold">
            Modalidade: {modalidadeChartFilter}
          </span>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Table */}
        <div className="lg:col-span-2 glass-card overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center">
            <h2 className="text-xs font-bold uppercase text-slate-400">Fluxo de Execução</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="text-[9px] font-bold bg-slate-800 px-2 py-0.5 rounded-full text-slate-500">
                {totalCount} processos
              </span>
              {rows.length > 0 && (
                <button
                  onClick={() => exportCSV(rows.map(p => ({
                    'ID Processo': p.id_processo || '',
                    'Objeto': p.objeto_resumido || '',
                    'Valor Estimado': p.valor_estimado,
                    'Status': p.status_nome || '',
                    'Responsável': p.responsavel_nome || '',
                    'Data': p.data_entrega,
                  })), 'processos_dashboard')}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded text-[9px] font-bold transition cursor-pointer border-none flex items-center gap-1"
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
                  <th scope="col" style={{ width: '15%', padding: '12px 8px' }}>ID Processo</th>
                  <th scope="col" style={{ width: '22%', padding: '12px 8px' }}>Objeto / Serviço</th>
                  <th scope="col" style={{ width: '18%', padding: '12px 8px' }}>Status</th>
                  <th scope="col" style={{ width: '10%', padding: '12px 8px', textAlign: 'center' }}>Prior.</th>
                  <th scope="col" style={{ width: '12%', padding: '12px 8px', textAlign: 'center' }}>Responsável</th>
                  <th scope="col" style={{ width: '10%', padding: '12px 8px', textAlign: 'center' }}>Data</th>
                  <th scope="col" style={{ width: '13%', padding: '12px 8px', textAlign: 'right' }}>Estimado</th>
                  {canEdit && <th scope="col" style={{ width: '15%', padding: '12px 8px', textAlign: 'center' }}>Ações</th>}
                </tr>
              </thead>
              <tbody className="text-[10px] divide-y divide-white/5">
                {loadingRows ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-2 py-3"><div className="h-3 bg-gray-700 rounded w-16" /></td>
                      <td className="px-2 py-3"><div className="h-3 bg-gray-700 rounded w-32" /></td>
                      <td className="px-2 py-3"><div className="h-3 bg-gray-700 rounded w-20" /></td>
                      <td className="px-2 py-3"><div className="h-3 bg-gray-700 rounded w-12 mx-auto" /></td>
                      <td className="px-2 py-3"><div className="h-3 bg-gray-700 rounded w-16 mx-auto" /></td>
                      <td className="px-2 py-3"><div className="h-3 bg-gray-700 rounded w-14 mx-auto" /></td>
                      <td className="px-2 py-3"><div className="h-3 bg-gray-700 rounded w-16 ml-auto" /></td>
                      {canEdit && <td className="px-2 py-3"><div className="h-3 bg-gray-700 rounded w-12 mx-auto" /></td>}
                    </tr>
                  ))
                ) : rows.map(p => {
                  const ag = getAging(p.data_entrega)
                  return (
                    <tr key={p.id} onClick={() => setModalProcesso(p)} className="hover:bg-white/5 transition cursor-pointer">
                      <td className="px-2 py-3 font-bold text-blue-400 truncate">
                        <a
                          href={seiLinks[p.id] || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!seiLinks[p.id]) e.preventDefault()
                          }}
                          className="cursor-pointer text-blue-400 hover:text-blue-300 underline-offset-2 hover:underline bg-transparent border-none p-0 font-inherit text-inherit"
                          title={seiLinks[p.id] ? 'Abrir no SEI' : 'Link SEI não cadastrado'}
                        >
                          {p.id_processo || '-'}
                        </a>
                      </td>
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setModalProcesso(p)
                          }}
                          className="font-bold text-slate-100 truncate cursor-pointer hover:text-white text-left bg-transparent border-none p-0"
                          title={p.objeto_resumido || '-'}
                        >
                          {p.objeto_resumido || '-'}
                        </button>
                      </td>
                      <td className="px-2 py-3">
                        <div className="text-slate-300 truncate">{p.status_nome || '-'}</div>
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
                        <span style={{ color: '#94a3b8', fontSize: 10 }}>{p.responsavel_nome || '-'}</span>
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
                            <button onClick={() => setModalProcesso(p)}
                              className="p-1.5 rounded-md text-blue-400 hover:bg-blue-500/20 transition cursor-pointer border-none bg-transparent" title="Ver detalhes">
                              <ExternalLink size={14} />
                            </button>
                            <button onClick={() => router.push(`/pmo-dashboard/processos/editar?id=${p.id}`)}
                              className="p-1.5 rounded-md text-amber-400 hover:bg-amber-500/20 transition cursor-pointer border-none bg-transparent" title="Editar">
                              <Edit size={14} />
                            </button>
                            {canDelete && (
                              <button onClick={() => setDeleteTarget(p)}
                                className="p-1.5 rounded-md text-red-400 hover:bg-red-500/20 transition cursor-pointer border-none bg-transparent" title="Excluir">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
                {!loadingRows && rows.length === 0 && (
                  <tr>
                    <td colSpan={canEdit ? 8 : 7} className="p-10 text-center opacity-30 uppercase font-black tracking-widest text-[10px]">Sem dados</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={totalCount}
            showingFrom={showingFrom}
            showingTo={showingTo}
            onPageChange={setPage}
            compact
          />
        </div>

        {/* Charts (carregado sob demanda) */}
        <ErrorBoundary>
        <Suspense fallback={<div className="glass-card p-6 text-center text-slate-500 text-xs">Carregando gráficos...</div>}>
          <DashboardCharts
            porResponsavel={chartData.resp}
            porModalidade={chartData.mod}
            selectedResponsavel={responsavelFilter}
            onResponsavelSelect={(responsavel) => {
              setResponsavelFilter(responsavel)
              setPage(1)
            }}
            selectedModalidade={modalidadeChartFilter}
            onModalidadeSelect={(modalidade) => {
              setModalidadeChartFilter(modalidade)
              setPage(1)
            }}
          />
        </Suspense>
        </ErrorBoundary>
      </div>

      {/* Modal */}
      {modalProcesso && (
        <div role="dialog" aria-modal="true" aria-label="Detalhes do Processo"
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4"
          onClick={() => setModalProcesso(null)}>
          <div className="glass-card w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto">
              <div className="sm:col-span-2 p-4 glass-card-inner">
                <p className="text-[9px] font-bold text-blue-400 uppercase mb-1">Objeto</p>
                <p className="text-sm font-bold text-slate-100">{modalProcesso.objeto_resumido || '-'}</p>
              </div>
              <div className="p-4 glass-card-inner">
                <p className="text-[9px] font-bold text-slate-500 mb-1">ID</p>
                <p className="text-base font-black text-slate-100">{modalProcesso.id_processo || '-'}</p>
              </div>
              <div className="p-4 glass-card-inner">
                <p className="text-[9px] font-bold text-slate-500 mb-1">Status</p>
                <p className="text-base font-black text-amber-500">{modalProcesso.status_nome || '-'}</p>
              </div>
              <div className="p-4 glass-card-inner">
                <p className="text-[9px] font-bold text-slate-500 mb-1">Coordenação</p>
                <p className="text-sm font-bold text-slate-100">{modalProcesso.coordenacao_nome || '-'}</p>
              </div>
              <div className="p-4 glass-card-inner">
                <p className="text-[9px] font-bold text-slate-500 mb-1">Responsável</p>
                <p className="text-sm font-bold text-slate-100">{modalProcesso.responsavel_nome || '-'}</p>
              </div>
              <div className="p-4 glass-card-inner">
                <p className="text-[9px] font-bold text-slate-500 mb-1">Modalidade</p>
                <p className="text-sm font-bold text-slate-100">{modalProcesso.modalidade_nome || '-'}</p>
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
                <p className="text-[9px] font-bold text-slate-500 mb-1">Demandante</p>
                <p className="text-sm font-bold text-slate-100">{modalProcesso.demandante_nome || '-'}</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3 shrink-0">
              <button onClick={() => router.push(`/pmo-dashboard/processos/detalhe?id=${modalProcesso.id}`)}
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-[10px] font-bold transition cursor-pointer border-none flex items-center gap-1.5">
                <ExternalLink size={12} /> Ver Detalhes
              </button>
              {canEdit && (
                <button onClick={() => router.push(`/pmo-dashboard/processos/editar?id=${modalProcesso.id}`)}
                  className="bg-amber-600 hover:bg-amber-500 text-white px-5 py-2 rounded-lg text-[10px] font-bold transition cursor-pointer border-none flex items-center gap-1.5">
                  <Edit size={12} /> Editar
                </button>
              )}
              {canDelete && (
                <button onClick={() => { setDeleteTarget(modalProcesso); setModalProcesso(null) }}
                  className="bg-red-600 hover:bg-red-500 text-white px-5 py-2 rounded-lg text-[10px] font-bold transition cursor-pointer border-none flex items-center gap-1.5">
                  <Trash2 size={12} /> Excluir
                </button>
              )}
              <button onClick={() => setModalProcesso(null)}
                className="bg-slate-700 hover:bg-slate-600 text-white px-5 py-2 rounded-lg text-[10px] font-bold transition cursor-pointer border-none">Fechar</button>
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
        .kpi-card:hover { transform: translateY(-4px); }
        .filter-bar {
          display: flex; gap: 0.5rem; flex-wrap: wrap;
          background: rgba(30, 41, 59, 0.7);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1rem; padding: 1rem; margin-bottom: 2rem; align-items: center;
        }
        .filter-input {
          background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem; padding: 0.375rem 0.5rem; font-size: 10px;
          color: #cbd5e1; flex: 1; min-width: 120px; outline: none;
        }
        .filter-input:focus { border-color: rgba(59, 130, 246, 0.5); }
        .filter-select {
          background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem; padding: 0.375rem 0.5rem; font-size: 10px;
          color: #cbd5e1; outline: none;
        }
        .filter-select:focus { border-color: rgba(59, 130, 246, 0.5); }
        .aging-badge { font-size: 8px; padding: 2px 6px; border-radius: 4px; font-weight: 900; text-transform: uppercase; white-space: nowrap; }
        .aging-red { background-color: #ef4444; color: white; }
        .aging-yellow { background-color: #eab308; color: black; }
        .aging-green { background-color: #22c55e; color: white; }
        .aging-gray { background-color: #475569; color: #cbd5e1; }
      `}</style>
    </div>
  )
}
