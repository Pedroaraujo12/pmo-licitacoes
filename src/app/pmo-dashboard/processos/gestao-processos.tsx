'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit, Trash2, ExternalLink, Save, UserPlus, X, Download, LayoutGrid, Table as TableIcon } from 'lucide-react'
import DeleteConfirmDialog from '@/components/ui/delete-confirm-dialog'
import Pagination from '@/components/ui/pagination'
import { useToast } from '@/components/ui/toast'
import { cleanNum, formatDate, getAging, formatBRL, exportCSV, fetchAllSeiLinks } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import type { Processo, Modalidade, Responsavel } from '@/types/database'

interface Props {
  processos: Processo[]
  setProcessos?: (p: Processo[]) => void
  modalidades: Modalidade[]
  responsaveis: Responsavel[]
  userRole?: string | null
  onDataChange?: () => void
}

export default function GestaoProcessos({ processos, setProcessos, responsaveis, userRole, onDataChange }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [statusFilter, setStatusFilter] = useState('')
  const [coordenacaoFilter, setCoordenacaoFilter] = useState('')
  const [modalidadeFilter, setModalidadeFilter] = useState('')
  const [responsavelFilter, setResponsavelFilter] = useState('')
  const [prioridadeFilter, setPrioridadeFilter] = useState('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [sortField, setSortField] = useState<string>('data_entrada')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [deleteTarget, setDeleteTarget] = useState<Processo | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [seiLinks, setSeiLinks] = useState<Record<string, string>>({})
  const [savingResp, setSavingResp] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const pageSize = 20

  const [showRespModal, setShowRespModal] = useState(false)
  const [respList, setRespList] = useState<Responsavel[]>(responsaveis)
  const [newRespNome, setNewRespNome] = useState('')
  const [editingResp, setEditingResp] = useState<string | null>(null)
  const [editRespNome, setEditRespNome] = useState('')
  const [respSaving, setRespSaving] = useState(false)
  const [deleteRespTarget, setDeleteRespTarget] = useState<Responsavel | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const canEdit = userRole && ['admin', 'gestor', 'consultor'].includes(userRole)
  const canDelete = userRole && ['admin', 'gestor'].includes(userRole)
  const canAssign = userRole && ['admin', 'gestor'].includes(userRole)
  const canManageResp = userRole && ['admin', 'gestor'].includes(userRole)

  function refreshResp() {
    if (onDataChange) onDataChange()
    supabase.from('responsaveis').select('*').then((r: { data: Responsavel[] | null }) => {
      if (r.data) setRespList(r.data)
    })
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteRespTarget) { setDeleteRespTarget(null); return }
        if (editingResp) { setEditingResp(null); return }
        if (showRespModal) { setShowRespModal(false); return }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showRespModal, editingResp, deleteRespTarget])

  useEffect(() => {
    fetchAllSeiLinks(supabase).then(setSeiLinks)
    supabase.from('cronograma_atividades').select('processo_id, status').then(({ data }: { data: { processo_id: string; status: string }[] | null }) => {
      if (!data) return
      const stats = new Map<string, { total: number; concluido: number }>()
      for (const a of data) {
        const s = stats.get(a.processo_id) || { total: 0, concluido: 0 }
        s.total++
        if (a.status === 'concluido') s.concluido++
        stats.set(a.processo_id, s)
      }
      const concluido: Record<string, boolean> = {}
      for (const [id, s] of stats) concluido[id] = s.total === s.concluido
      if (setProcessos) {
        setProcessos(processos.map(p => ({ ...p, processo_atrasado: concluido[p.id] ? false : p.processo_atrasado })))
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleDeleteProcess() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error: err1 } = await supabase.from('processos').delete().eq('id', deleteTarget.id)
      if (err1) {
        console.warn('Erro ao excluir:', err1)
        toast('Erro ao excluir processo', 'error')
        setDeleting(false)
        return
      }
      const deletedId = deleteTarget.id
      setDeleteTarget(null)
      if (setProcessos) {
        setProcessos(processos.filter(p => p.id !== deletedId))
      } else if (onDataChange) {
        onDataChange()
      }
      setDeleting(false)
    } catch (err) {
      console.warn('Erro inesperado ao excluir:', err)
      setDeleting(false)
    }
  }

  async function handleChangeResponsavel(processoId: string, newResponsavelId: string) {
    if (!canAssign) return
    const resp = respList.find(r => r.id === newResponsavelId)
    const prev = processos
    setProcessos?.(processos.map(p =>
      p.id === processoId ? { ...p, responsaveis: resp ? { nome: resp.nome } : null, responsavel_id: newResponsavelId || null } : p
    ))
    setSavingResp(processoId)
    try {
      const { error } = await supabase
        .from('processos')
        .update({ responsavel_id: newResponsavelId || null })
        .eq('id', processoId)
      if (error) {
        setProcessos?.(prev)
        toast('Erro ao alterar responsável', 'error')
      }
    } catch (err) {
      setProcessos?.(prev)
      console.warn('Erro inesperado:', err)
    } finally {
      setSavingResp(null)
    }
  }

  async function handleAddResponsavel() {
    if (!newRespNome.trim() || !canManageResp) return
    setRespSaving(true)
    try {
      const { error } = await supabase.from('responsaveis').insert({ nome: newRespNome.trim() })
      if (error) {
        toast('Erro ao adicionar', 'error')
      } else {
        setNewRespNome('')
        refreshResp()
      }
    } catch (err) {
      console.warn(err)
    } finally {
      setRespSaving(false)
    }
  }

  async function handleEditResponsavel(id: string) {
    if (!editRespNome.trim() || !canManageResp) return
    setRespSaving(true)
    try {
      const { error } = await supabase.from('responsaveis').update({ nome: editRespNome.trim() }).eq('id', id)
      if (error) {
        toast('Erro ao editar', 'error')
      } else {
        setEditingResp(null)
        refreshResp()
      }
    } catch (err) {
      console.warn(err)
    } finally {
      setRespSaving(false)
    }
  }

  async function handleDeleteResponsavel() {
    if (!deleteRespTarget || !canManageResp) return
    setRespSaving(true)
    try {
      const { error } = await supabase.from('responsaveis').delete().eq('id', deleteRespTarget.id)
      if (error) {
        toast('Erro ao excluir', 'error')
      } else {
        setDeleteRespTarget(null)
        refreshResp()
      }
    } catch (err) {
      console.warn(err)
    } finally {
      setRespSaving(false)
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

  const coordNames = useMemo(() => {
    const seen = new Set<string>()
    processos.forEach(p => { const n = p.coordenacoes?.nome; if (n) seen.add(n) })
    return [...seen].sort()
  }, [processos])

  const respNames = useMemo(() => {
    const seen = new Set<string>()
    processos.forEach(p => { const n = p.responsaveis?.nome; if (n) seen.add(n) })
    return [...seen].sort()
  }, [processos])

  const statusNames = useMemo(() => {
    const seen = new Set<string>()
    processos.forEach(p => { const n = p.status_processo?.nome; if (n) seen.add(n) })
    return [...seen].sort()
  }, [processos])

  const modalNames = useMemo(() => {
    const seen = new Set<string>()
    processos.forEach(p => { const n = p.modalidades?.nome; if (n) seen.add(n) })
    return [...seen].sort()
  }, [processos])

  const filtered = useMemo(() => {
    return processos.filter(p => {
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase()
        const match = `${p.id_processo || ''} ${p.objeto_resumido || ''} ${p.coordenacoes?.nome || ''} ${p.responsaveis?.nome || ''}`.toLowerCase()
        if (!match.includes(q)) return false
      }
      if (statusFilter && (p.status_processo?.nome || '') !== statusFilter) return false
      if (coordenacaoFilter && (p.coordenacoes?.nome || '') !== coordenacaoFilter) return false
      if (modalidadeFilter && (p.modalidades?.nome || 'N/I') !== modalidadeFilter) return false
      if (prioridadeFilter && (p.prioridade || '') !== prioridadeFilter) return false
      if (responsavelFilter && (p.responsaveis?.nome || 'N/I') !== responsavelFilter) return false
      if (dateStart && p.data_entrada && new Date(p.data_entrada) < new Date(dateStart)) return false
      if (dateEnd && p.data_entrada && new Date(p.data_entrada) > new Date(dateEnd + 'T23:59:59')) return false
      return true
    }).sort((a, b) => {
      let cmp = 0
      if (sortField === 'id_processo') cmp = (a.id_processo || '').localeCompare(b.id_processo || '')
      else if (sortField === 'objeto_resumido') cmp = (a.objeto_resumido || '').localeCompare(b.objeto_resumido || '')
      else if (sortField === 'status_processo') cmp = ((a.status_processo?.nome) || '').localeCompare((b.status_processo?.nome) || '')
      else if (sortField === 'coordenacoes') cmp = ((a.coordenacoes?.nome) || '').localeCompare((b.coordenacoes?.nome) || '')
      else if (sortField === 'responsaveis') cmp = ((a.responsaveis?.nome) || '').localeCompare((b.responsaveis?.nome) || '')
      else if (sortField === 'modalidades') cmp = ((a.modalidades?.nome) || '').localeCompare((b.modalidades?.nome) || '')
      else if (sortField === 'prioridade') cmp = (a.prioridade || '').localeCompare(b.prioridade || '')
      else if (sortField === 'data_entrada') cmp = ((a.data_entrada || '') > (b.data_entrada || '') ? 1 : -1)
      else if (sortField === 'valor_estimado') cmp = cleanNum(a.valor_estimado) - cleanNum(b.valor_estimado)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [processos, debouncedSearch, statusFilter, coordenacaoFilter, modalidadeFilter, prioridadeFilter, responsavelFilter, dateStart, dateEnd, sortField, sortDir])

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  const totalPages = Math.ceil(filtered.length / pageSize)
  const showingFrom = (page - 1) * pageSize + 1
  const showingTo = Math.min(page * pageSize, filtered.length)

  const prevLenRef = useRef(filtered.length)
  useEffect(() => {
    if (filtered.length < prevLenRef.current && page > 1) setPage(1)
    prevLenRef.current = filtered.length
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered.length])

  return (
    <div>
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight uppercase">Gestão de Processos</h1>
            <p className="text-[9px] text-slate-500 font-bold tracking-wider mt-0.5">
              {filtered.length} processo{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
          {/* View Toggle */}
          <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, overflow: 'hidden' }}>
            <button
              onClick={() => setViewMode('table')}
              style={{
                padding: '6px 10px', background: viewMode === 'table' ? 'rgba(139,92,246,0.15)' : 'transparent',
                border: 'none', color: viewMode === 'table' ? '#a78bfa' : '#64748b', cursor: 'pointer',
                fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <TableIcon size={13} /> Tabela
            </button>
            <button
              onClick={() => setViewMode('cards')}
              style={{
                padding: '6px 10px', background: viewMode === 'cards' ? 'rgba(139,92,246,0.15)' : 'transparent',
                border: 'none', color: viewMode === 'cards' ? '#a78bfa' : '#64748b', cursor: 'pointer',
                fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <LayoutGrid size={13} /> Cards
            </button>
          </div>
          {filtered.length > 0 && (
            <button
              onClick={() => exportCSV(filtered.map(p => ({
                'ID Processo': p.id_processo || '',
                'Objeto': p.objeto_resumido || '',
                'Status': p.status_processo?.nome || '',
                'Coordenação': p.coordenacoes?.nome || '',
                'Responsável': p.responsaveis?.nome || '',
                'Modalidade': p.modalidades?.nome || '',
                'Prioridade': p.prioridade || '',
                'Data Entrada': formatDate(p.data_entrada),
                'Valor Estimado': formatBRL(p.valor_estimado),
              })), 'processos')}
              className="bg-slate-800/50 text-slate-300 px-3 py-2 rounded-xl text-[10px] font-bold border border-slate-700 hover:bg-slate-700/50 transition cursor-pointer border-none flex items-center gap-1.5"
              title="Exportar CSV"
            >
              <Download size={12} /> CSV
            </button>
          )}
          {canManageResp && (
            <button
              onClick={() => { setRespList(responsaveis); setShowRespModal(true) }}
              className="bg-slate-800/50 text-slate-300 px-3 py-2 rounded-xl text-[10px] font-bold border border-slate-700 hover:bg-slate-700/50 transition cursor-pointer border-none flex items-center gap-1.5"
            >
              <UserPlus size={13} />
              Responsáveis
            </button>
          )}
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setCoordenacaoFilter(''); setModalidadeFilter(''); setPrioridadeFilter(''); setResponsavelFilter(''); setDateStart(''); setDateEnd(''); setPage(1) }}
            className="bg-slate-800/50 text-slate-300 px-3 py-2 rounded-xl text-[10px] font-bold border border-slate-700 hover:bg-slate-700/50 transition cursor-pointer border-none"
          >
            Resetar
          </button>
          {canEdit && (
            <button
              onClick={() => router.push('/pmo-dashboard/processos/novo')}
              className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl text-[10px] font-bold transition flex items-center gap-1.5 cursor-pointer border-none"
            >
              <Plus size={13} />
              Novo Processo
            </button>
          )}
        </div>
      </header>

      {/* Filter Bar */}
      <div className="filter-bar">
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Buscar por ID, objeto, coordenação...  ⌘K"
          className="filter-input"
          style={{ minWidth: 180 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>De</label>
          <input
            type="date"
            value={dateStart}
            onChange={e => { setDateStart(e.target.value); setPage(1) }}
            className="filter-input"
            style={{ width: 130, fontSize: 10 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Até</label>
          <input
            type="date"
            value={dateEnd}
            onChange={e => { setDateEnd(e.target.value); setPage(1) }}
            className="filter-input"
            style={{ width: 130, fontSize: 10 }}
          />
          <button onClick={() => { const d = new Date(); setDateStart(d.toISOString().split('T')[0]); setDateEnd(d.toISOString().split('T')[0]); setPage(1) }}
            className="period-btn">Hoje</button>
          <button onClick={() => { const d = new Date(); const s = new Date(d); s.setDate(d.getDate()-7); setDateStart(s.toISOString().split('T')[0]); setDateEnd(d.toISOString().split('T')[0]); setPage(1) }}
            className="period-btn">7d</button>
          <button onClick={() => { const d = new Date(); const s = new Date(d); s.setMonth(d.getMonth()-1); setDateStart(s.toISOString().split('T')[0]); setDateEnd(d.toISOString().split('T')[0]); setPage(1) }}
            className="period-btn">30d</button>
          <button onClick={() => { const d = new Date(); const s = new Date(d.getFullYear(),0,1); setDateStart(s.toISOString().split('T')[0]); setDateEnd(d.toISOString().split('T')[0]); setPage(1) }}
            className="period-btn">Ano</button>
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="filter-select">
          <option value="">Status</option>
          {statusNames.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={coordenacaoFilter} onChange={e => { setCoordenacaoFilter(e.target.value); setPage(1) }} className="filter-select">
          <option value="">Coordenação</option>
          {coordNames.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={modalidadeFilter} onChange={e => { setModalidadeFilter(e.target.value); setPage(1) }} className="filter-select">
          <option value="">Modalidade</option>
          {modalNames.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={prioridadeFilter} onChange={e => { setPrioridadeFilter(e.target.value); setPage(1) }} className="filter-select">
          <option value="">Prioridade</option>
          <option value="Baixa">Baixa</option>
          <option value="Média">Média</option>
          <option value="Alta">Alta</option>
          <option value="Urgente">Urgente</option>
        </select>
        <select value={responsavelFilter} onChange={e => { setResponsavelFilter(e.target.value); setPage(1) }} className="filter-select">
          <option value="">Responsável</option>
          {respNames.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left" style={{ minWidth: 1000 }}>
              <thead className="sticky top-0 bg-[#1e293b] z-10 shadow-sm">
                <tr className="text-[9px] font-black uppercase text-slate-500 border-b border-white/10 tracking-tighter">
                  <th scope="col" className="px-3 py-3 w-8 text-center">#</th>
                  <th scope="col" onClick={() => toggleSort('id_processo')} className="cursor-pointer hover:text-slate-300 transition select-none px-3 py-3" style={{ width: '12%' }}>
                    ID Processo {sortField === 'id_processo' && <span>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                  </th>
                  <th scope="col" onClick={() => toggleSort('objeto_resumido')} className="cursor-pointer hover:text-slate-300 transition select-none px-3 py-3" style={{ width: '20%' }}>
                    Objeto / Serviço {sortField === 'objeto_resumido' && <span>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                  </th>
                  <th scope="col" onClick={() => toggleSort('status_processo')} className="cursor-pointer hover:text-slate-300 transition select-none px-3 py-3" style={{ width: '10%' }}>
                    Status {sortField === 'status_processo' && <span>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                  </th>
                  <th scope="col" onClick={() => toggleSort('coordenacoes')} className="cursor-pointer hover:text-slate-300 transition select-none px-3 py-3" style={{ width: '9%' }}>
                    Coord. {sortField === 'coordenacoes' && <span>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                  </th>
                  <th scope="col" onClick={() => toggleSort('responsaveis')} className="cursor-pointer hover:text-slate-300 transition select-none px-3 py-3" style={{ width: '12%' }}>
                    Responsável {sortField === 'responsaveis' && <span>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                  </th>
                  <th scope="col" onClick={() => toggleSort('modalidades')} className="cursor-pointer hover:text-slate-300 transition select-none px-3 py-3" style={{ width: '9%' }}>
                    Modalidade {sortField === 'modalidades' && <span>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                  </th>
                  <th scope="col" onClick={() => toggleSort('prioridade')} className="cursor-pointer hover:text-slate-300 transition select-none px-3 py-3 text-center" style={{ width: '7%' }}>
                    Prior. {sortField === 'prioridade' && <span>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                  </th>
                  <th scope="col" onClick={() => toggleSort('data_entrada')} className="cursor-pointer hover:text-slate-300 transition select-none px-3 py-3 text-center" style={{ width: '8%' }}>
                    Data {sortField === 'data_entrada' && <span>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                  </th>
                  <th scope="col" className="px-3 py-3" style={{ width: '8%' }}>Drive</th>
                  <th scope="col" className="px-3 py-3 text-center" style={{ width: '8%' }}>Ações</th>
                </tr>
              </thead>
              <tbody className="text-[10px] divide-y divide-white/5">
                {paginated.map((p, idx) => {
                  const ag = getAging(p.data_entrega, p.processo_atrasado)
                  const currentRespId = p.responsavel_id || ''
                  return (
                    <tr key={p.id} className="hover:bg-white/5 transition">
                      <td className="px-3 py-3 text-center text-slate-600 font-bold">{(page - 1) * pageSize + idx + 1}</td>
                      <td className="px-3 py-3">
                        <div className="font-bold text-blue-400 truncate" style={{ cursor: 'pointer' }}
                          onClick={() => router.push(`/pmo-dashboard/processos/${p.id}`)}
                        ><a href={seiLinks[p.id] || '#'} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: seiLinks[p.id] ? 'underline' : 'none' }}>{p.id_processo || '-'}</a></div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-slate-100 font-bold truncate max-w-[220px]" title={p.objeto_resumido || ''}>
                          {p.objeto_resumido || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs font-bold" style={{
                          color: p.status_processo?.nome === 'Concluído' || p.status_processo?.nome === 'Homologado'
                            ? '#22c55e' : p.status_processo?.nome === 'Suspenso' || p.status_processo?.nome === 'Cancelado'
                            ? '#ef4444' : '#f59e0b'
                        }}>
                          {p.status_processo?.nome || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-300 truncate">{p.coordenacoes?.nome || '-'}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          {canAssign ? (
                            <select
                              value={currentRespId}
                              onChange={e => {
                                const val = e.target.value
                                if (val !== currentRespId) {
                                  handleChangeResponsavel(p.id, val)
                                }
                              }}
                              disabled={savingResp === p.id}
                              className="resp-select"
                            >
                              <option value="">N/I</option>
                              {respList.map(r => (
                                <option key={r.id} value={r.id}>{r.nome}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-slate-100 font-bold">{p.responsaveis?.nome || 'N/I'}</span>
                          )}
                          {savingResp === p.id && (
                            <Save size={10} className="text-blue-400 animate-pulse shrink-0" />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-300 truncate">{p.modalidades?.nome || '-'}</td>
                      <td className="px-3 py-3 text-center">
                        {p.prioridade ? (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                            background: p.prioridade === 'Urgente' ? 'rgba(239,68,68,0.2)' :
                              p.prioridade === 'Alta' ? 'rgba(249,115,22,0.2)' :
                              p.prioridade === 'Média' ? 'rgba(234,179,8,0.2)' : 'rgba(34,197,94,0.2)',
                            color: p.prioridade === 'Urgente' ? '#fca5a5' :
                              p.prioridade === 'Alta' ? '#fdba74' :
                              p.prioridade === 'Média' ? '#fde047' : '#86efac',
                          }}>{p.prioridade}</span>
                        ) : <span style={{ color: '#475569' }}>—</span>}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${ag.class}`}>
                          {formatDate(p.data_entrada)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {(() => {
                          const linkUrl = p.drive || seiLinks[p.id]
                          return linkUrl ? (
                            <a href={linkUrl} target="_blank" rel="noopener noreferrer"
                              style={{ color: '#60a5fa', fontSize: 11, textDecoration: 'none' }}
                              onClick={e => e.stopPropagation()}
                            >Abrir</a>
                          ) : <span style={{ color: '#475569' }}>—</span>
                        })()}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => router.push(`/pmo-dashboard/processos/${p.id}`)}
                            className="p-1.5 rounded-md text-blue-400 hover:bg-blue-500/20 transition cursor-pointer border-none bg-transparent"
                            title="Ver detalhes"
                            aria-label="Ver detalhes do processo"
                          >
                            <ExternalLink size={13} />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => router.push(`/pmo-dashboard/processos/editar?id=${p.id}`)}
                              className="p-1.5 rounded-md text-amber-400 hover:bg-amber-500/20 transition cursor-pointer border-none bg-transparent"
                              title="Editar"
                              aria-label="Editar processo"
                            >
                              <Edit size={13} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setDeleteTarget(p)}
                              className="p-1.5 rounded-md text-red-400 hover:bg-red-500/20 transition cursor-pointer border-none bg-transparent"
                              title="Excluir"
                              aria-label="Excluir processo"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-10 text-center opacity-30 uppercase font-black tracking-widest text-[10px]">
                      Nenhum processo encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {filtered.length > 0 && (
              <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end', gap: 24 }}>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  Valor estimado total: <strong style={{ color: '#f1f5f9' }}>{formatBRL(filtered.reduce((s, p) => s + cleanNum(p.valor_estimado), 0))}</strong>
                </span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  Economia total: <strong style={{ color: '#22c55e' }}>{formatBRL(filtered.reduce((s, p) => {
                    const st = p.status_processo?.nome
                    if (st !== 'Concluído' && st !== 'Homologado') return s
                    return s + cleanNum(p.valor_estimado) - cleanNum(p.valor_homologado)
                  }, 0))}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Pagination */}
          <Pagination
            page={page}
            totalPages={totalPages}
            total={filtered.length}
            showingFrom={showingFrom}
            showingTo={showingTo}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Cards View */}
      {viewMode === 'cards' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 14,
        }}>
          {paginated.map(p => {
            const total = p.total_etapas || 17
            const concluidas = p.etapas_concluidas || 0
            const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0
            return (
              <div
                key={p.id}
                onClick={() => router.push(`/pmo-dashboard/processos/${p.id}`)}
                style={{
                  background: 'rgba(30,41,59,0.7)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 16,
                  padding: 16,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <a href={seiLinks[p.id] || '#'} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}><span style={{ fontFamily: 'monospace', fontSize: 11, color: '#60a5fa', fontWeight: 600 }}>{p.id_processo || '-'}</span></a>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                    background: p.status_processo?.nome === 'Concluído' ? 'rgba(34,197,94,0.15)' :
                      p.status_processo?.nome === 'Cancelado' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                    color: p.status_processo?.nome === 'Concluído' ? '#4ade80' :
                      p.status_processo?.nome === 'Cancelado' ? '#fca5a5' : '#fde047',
                  }}>
                    {p.status_processo?.nome || '-'}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500, marginBottom: 8, lineHeight: 1.4 }}>
                  {p.objeto_resumido || '-'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8, fontSize: 11, color: '#64748b' }}>
                  <span><strong style={{ color: '#94a3b8' }}>Resp:</strong> {p.responsaveis?.nome || 'N/I'}</span>
                  <span><strong style={{ color: '#94a3b8' }}>Modal:</strong> {p.modalidades?.nome || '-'}</span>
                  {p.prioridade && (
                    <span style={{
                      fontWeight: 700,
                      color: p.prioridade === 'Urgente' ? '#fca5a5' :
                        p.prioridade === 'Alta' ? '#fdba74' :
                        p.prioridade === 'Média' ? '#fde047' : '#86efac',
                    }}>• {p.prioridade}</span>
                  )}
                  <span><strong style={{ color: '#94a3b8' }}>Atual:</strong> {p.atividade_atual || '-'}</span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    width: `${pct}%`,
                    background: pct === 100 ? '#22c55e' : p.processo_atrasado ? '#ef4444' : '#3b82f6',
                    transition: 'width 0.3s',
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                    {formatBRL(p.valor_estimado)}
                  </span>
                  <span style={{ fontSize: 10, color: '#64748b' }}>
                    {concluidas}/{total} etapas
                  </span>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: '#64748b', fontSize: 12 }}>
              Nenhum processo encontrado
            </div>
          )}
        </div>
      )}

      {/* Pagination for cards mode */}
      <Pagination
        page={page}
        totalPages={totalPages}
        total={filtered.length}
        showingFrom={showingFrom}
        showingTo={showingTo}
        onPageChange={setPage}
        compact
      />

      {/* Responsaveis Management Modal */}
      {showRespModal && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4"
          onClick={() => setShowRespModal(false)}
        >
          <div
            className="glass-card w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center shrink-0">
              <h2 className="text-sm font-extrabold text-slate-100 uppercase tracking-tight">Gerenciar Responsáveis</h2>
              <button
                onClick={() => setShowRespModal(false)}
                className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/10 transition cursor-pointer border-none bg-transparent"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {/* Add new */}
              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={newRespNome}
                  onChange={e => setNewRespNome(e.target.value)}
                  placeholder="Nome do responsável..."
                  className="flex-1 bg-slate-800/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-violet-500/50"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddResponsavel() } }}
                />
                <button
                  onClick={handleAddResponsavel}
                  disabled={respSaving || !newRespNome.trim()}
                  className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-[10px] font-bold transition cursor-pointer border-none flex items-center gap-1.5"
                >
                  <Plus size={12} />
                  Adicionar
                </button>
              </div>

              {/* List */}
              <div className="space-y-2">
                {respList.map(r => (
                  <div key={r.id} className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3 border border-white/5">
                    {editingResp === r.id ? (
                      <div className="flex items-center gap-2 flex-1 mr-2">
                        <input
                          type="text"
                          value={editRespNome}
                          onChange={e => setEditRespNome(e.target.value)}
                          className="flex-1 bg-slate-800/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-violet-500/50"
                          onKeyDown={e => { if (e.key === 'Enter') handleEditResponsavel(r.id); if (e.key === 'Escape') setEditingResp(null) }}
                          autoFocus
                        />
                        <button
                          onClick={() => handleEditResponsavel(r.id)}
                          disabled={respSaving}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-[9px] font-bold transition cursor-pointer border-none"
                        >
                          OK
                        </button>
                        <button
                          onClick={() => setEditingResp(null)}
                          className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg text-[9px] font-bold transition cursor-pointer border-none"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-bold text-slate-100">{r.nome}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => { setEditingResp(r.id); setEditRespNome(r.nome) }}
                            className="p-1.5 rounded-md text-amber-400 hover:bg-amber-500/20 transition cursor-pointer border-none bg-transparent"
                            title="Editar nome"
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            onClick={() => setDeleteRespTarget(r)}
                            className="p-1.5 rounded-md text-red-400 hover:bg-red-500/20 transition cursor-pointer border-none bg-transparent"
                            title="Excluir"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {respList.length === 0 && (
                  <p className="text-center text-slate-500 text-xs py-8">Nenhum responsável cadastrado</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Responsavel Confirm */}
      {deleteRespTarget && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-sm p-6 text-center">
            <p className="text-sm font-bold text-slate-100 mb-2">Excluir Responsável</p>
            <p className="text-xs text-slate-400 mb-6">
              Tem certeza que deseja excluir <strong className="text-slate-200">{deleteRespTarget.nome}</strong>?
              Processos atribuídos a ele ficarão sem responsável.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setDeleteRespTarget(null)}
                className="bg-slate-700 hover:bg-slate-600 text-white px-5 py-2 rounded-lg text-xs font-bold transition cursor-pointer border-none"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteResponsavel}
                disabled={respSaving}
                className="bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white px-5 py-2 rounded-lg text-xs font-bold transition cursor-pointer border-none"
              >
                {respSaving ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onClose={() => { setDeleteTarget(null); setDeleting(false) }}
        onConfirm={handleDeleteProcess}
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
          min-width: 160px;
          outline: none;
        }
        .filter-input:focus {
          border-color: rgba(139, 92, 246, 0.5);
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
          border-color: rgba(139, 92, 246, 0.5);
        }
        .resp-select {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 4px;
          padding: 2px 4px;
          font-size: 10px;
          color: #cbd5e1;
          max-width: 130px;
          cursor: pointer;
          outline: none;
        }
        .resp-select:hover {
          border-color: rgba(139, 92, 246, 0.4);
        }
        .resp-select:focus {
          border-color: rgba(139, 92, 246, 0.6);
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
