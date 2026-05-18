'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit, Trash2, ExternalLink, Save } from 'lucide-react'
import DeleteConfirmDialog from '@/components/ui/delete-confirm-dialog'
import type { Processo, Modalidade, Responsavel } from '@/types/database'

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

interface Props {
  processos: Processo[]
  modalidades: Modalidade[]
  responsaveis: Responsavel[]
  userRole?: string | null
}

export default function GestaoProcessos({ processos, modalidades, responsaveis, userRole }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [coordenacaoFilter, setCoordenacaoFilter] = useState('')
  const [modalidadeFilter, setModalidadeFilter] = useState('')
  const [responsavelFilter, setResponsavelFilter] = useState('')
  const [sortField, setSortField] = useState<string>('data_entrada')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [deleteTarget, setDeleteTarget] = useState<Processo | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [savingResp, setSavingResp] = useState<string | null>(null)

  const canEdit = userRole && ['admin', 'gestor', 'consultor'].includes(userRole)
  const canDelete = userRole && ['admin', 'gestor'].includes(userRole)
  const canAssign = userRole && ['admin', 'gestor'].includes(userRole)
  const isAdmin = userRole === 'admin'

  const supabase = createClient()

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error: err1 } = await supabase.from('processos').delete().eq('id', deleteTarget.id)
      const { error: err2 } = await supabase.from('licitacoes').delete().eq('id', deleteTarget.id)
      if (err1 || err2) {
        console.error('Erro ao excluir:', err1 || err2)
        setDeleting(false)
        return
      }
      window.location.reload()
    } catch (err) {
      console.error('Erro inesperado ao excluir:', err)
      setDeleting(false)
    }
  }

  async function handleChangeResponsavel(processoId: string, newResponsavelId: string) {
    if (!newResponsavelId || !canAssign) return
    setSavingResp(processoId)
    try {
      const { error } = await supabase
        .from('processos')
        .update({ responsavel_id: newResponsavelId === 'null' ? null : newResponsavelId })
        .eq('id', processoId)
      if (error) {
        console.error('Erro ao atualizar responsável:', error)
        alert('Erro ao alterar responsável.')
      } else {
        window.location.reload()
      }
    } catch (err) {
      console.error('Erro inesperado:', err)
    } finally {
      setSavingResp(null)
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
    processos.forEach(p => {
      const n = p.coordenacoes?.nome
      if (n) seen.add(n)
    })
    return [...seen].sort()
  }, [processos])

  const respNames = useMemo(() => {
    const seen = new Set<string>()
    processos.forEach(p => {
      const n = p.responsaveis?.nome
      if (n) seen.add(n)
    })
    return [...seen].sort()
  }, [processos])

  const statusNames = useMemo(() => {
    const seen = new Set<string>()
    processos.forEach(p => {
      const n = p.status_processo?.nome
      if (n) seen.add(n)
    })
    return [...seen].sort()
  }, [processos])

  const modalNames = useMemo(() => {
    const seen = new Set<string>()
    processos.forEach(p => {
      const n = p.modalidades?.nome
      if (n) seen.add(n)
    })
    return [...seen].sort()
  }, [processos])

  const filtered = useMemo(() => {
    return processos.filter(p => {
      if (search) {
        const q = search.toLowerCase()
        const match = `${p.id_processo || ''} ${p.objeto_resumido || ''} ${p.coordenacoes?.nome || ''} ${p.responsaveis?.nome || ''}`.toLowerCase()
        if (!match.includes(q)) return false
      }
      if (statusFilter && (p.status_processo?.nome || '') !== statusFilter) return false
      if (coordenacaoFilter && (p.coordenacoes?.nome || '') !== coordenacaoFilter) return false
      if (modalidadeFilter && (p.modalidades?.nome || 'N/I') !== modalidadeFilter) return false
      if (responsavelFilter && (p.responsaveis?.nome || 'N/I') !== responsavelFilter) return false
      return true
    }).sort((a, b) => {
      let cmp = 0
      if (sortField === 'id_processo') cmp = (a.id_processo || '').localeCompare(b.id_processo || '')
      else if (sortField === 'objeto_resumido') cmp = (a.objeto_resumido || '').localeCompare(b.objeto_resumido || '')
      else if (sortField === 'status_processo') cmp = ((a.status_processo?.nome) || '').localeCompare((b.status_processo?.nome) || '')
      else if (sortField === 'coordenacoes') cmp = ((a.coordenacoes?.nome) || '').localeCompare((b.coordenacoes?.nome) || '')
      else if (sortField === 'responsaveis') cmp = ((a.responsaveis?.nome) || '').localeCompare((b.responsaveis?.nome) || '')
      else if (sortField === 'modalidades') cmp = ((a.modalidades?.nome) || '').localeCompare((b.modalidades?.nome) || '')
      else if (sortField === 'data_entrada') cmp = ((a.data_entrada || '') > (b.data_entrada || '') ? 1 : -1)
      else if (sortField === 'valor_estimado') cmp = cleanNum(a.valor_estimado) - cleanNum(b.valor_estimado)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [processos, search, statusFilter, coordenacaoFilter, modalidadeFilter, responsavelFilter, sortField, sortDir])

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
        <div className="flex gap-3">
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setCoordenacaoFilter(''); setModalidadeFilter(''); setResponsavelFilter('') }}
            className="bg-slate-800/50 text-slate-300 px-4 py-2.5 rounded-xl text-[10px] font-bold border border-slate-700 hover:bg-slate-700/50 transition cursor-pointer border-none"
          >
            Resetar
          </button>
          {canEdit && (
            <button
              onClick={() => router.push('/pmo-dashboard/processos/novo')}
              className="bg-violet-600 hover:bg-violet-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border-none"
            >
              <Plus size={14} />
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
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por ID, objeto, coordenação..."
          className="filter-input"
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="filter-select">
          <option value="">Status</option>
          {statusNames.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={coordenacaoFilter} onChange={e => setCoordenacaoFilter(e.target.value)} className="filter-select">
          <option value="">Coordenação</option>
          {coordNames.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={modalidadeFilter} onChange={e => setModalidadeFilter(e.target.value)} className="filter-select">
          <option value="">Modalidade</option>
          {modalNames.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={responsavelFilter} onChange={e => setResponsavelFilter(e.target.value)} className="filter-select">
          <option value="">Responsável</option>
          {respNames.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ minWidth: 900 }}>
            <thead className="sticky top-0 bg-[#1e293b] z-10 shadow-sm">
              <tr className="text-[9px] font-black uppercase text-slate-500 border-b border-white/10 tracking-tighter">
                <th className="px-3 py-3 w-8 text-center">#</th>
                <th onClick={() => toggleSort('id_processo')} className="cursor-pointer hover:text-slate-300 transition select-none px-3 py-3" style={{ width: '13%' }}>
                  ID Processo {sortField === 'id_processo' && <span>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th onClick={() => toggleSort('objeto_resumido')} className="cursor-pointer hover:text-slate-300 transition select-none px-3 py-3" style={{ width: '22%' }}>
                  Objeto / Serviço {sortField === 'objeto_resumido' && <span>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th onClick={() => toggleSort('status_processo')} className="cursor-pointer hover:text-slate-300 transition select-none px-3 py-3" style={{ width: '12%' }}>
                  Status {sortField === 'status_processo' && <span>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th onClick={() => toggleSort('coordenacoes')} className="cursor-pointer hover:text-slate-300 transition select-none px-3 py-3" style={{ width: '12%' }}>
                  Coordenação {sortField === 'coordenacoes' && <span>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th onClick={() => toggleSort('responsaveis')} className="cursor-pointer hover:text-slate-300 transition select-none px-3 py-3" style={{ width: '14%' }}>
                  Responsável {sortField === 'responsaveis' && <span>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th onClick={() => toggleSort('modalidades')} className="cursor-pointer hover:text-slate-300 transition select-none px-3 py-3" style={{ width: '10%' }}>
                  Modalidade {sortField === 'modalidades' && <span>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th onClick={() => toggleSort('data_entrada')} className="cursor-pointer hover:text-slate-300 transition select-none px-3 py-3 text-center" style={{ width: '10%' }}>
                  Data {sortField === 'data_entrada' && <span>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th className="px-3 py-3 text-center" style={{ width: '8%' }}>Ações</th>
              </tr>
            </thead>
            <tbody className="text-[10px] divide-y divide-white/5">
              {filtered.map((p, idx) => {
                const ag = getAging(p.data_entrega, p.processo_atrasado)
                const currentRespId = p.responsavel_id || ''
                return (
                  <tr key={p.id} className="hover:bg-white/5 transition">
                    <td className="px-3 py-3 text-center text-slate-600 font-bold">{idx + 1}</td>
                    <td className="px-3 py-3">
                      <div className="font-bold text-blue-400 truncate">{p.id_processo || '-'}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-slate-100 font-bold truncate max-w-[250px]" title={p.objeto_resumido || ''}>
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
                        <div className="min-w-0 flex-1">
                          {canAssign ? (
                            <select
                              value={currentRespId}
                              onChange={e => {
                                const val = e.target.value
                                if (val !== currentRespId) {
                                  if (confirm('Alterar responsável do processo ' + (p.id_processo || '') + '?')) {
                                    handleChangeResponsavel(p.id, val)
                                  } else {
                                    e.target.value = currentRespId
                                  }
                                }
                              }}
                              disabled={savingResp === p.id}
                              className="resp-select"
                            >
                              <option value="">N/I</option>
                              {responsaveis.map(r => (
                                <option key={r.id} value={r.id}>{r.nome}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-slate-100 font-bold">{p.responsaveis?.nome || 'N/I'}</span>
                          )}
                        </div>
                        {savingResp === p.id && (
                          <Save size={10} className="text-blue-400 animate-pulse shrink-0" />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-300 truncate">{p.modalidades?.nome || '-'}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${ag.class}`}>
                        {formatDate(p.data_entrada)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => router.push(`/pmo-dashboard/processos/${p.id}`)}
                          className="p-1.5 rounded-md text-blue-400 hover:bg-blue-500/20 transition cursor-pointer border-none bg-transparent"
                          title="Ver detalhes"
                        >
                          <ExternalLink size={14} />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => router.push(`/pmo-dashboard/processos/${p.id}/edit`)}
                            className="p-1.5 rounded-md text-amber-400 hover:bg-amber-500/20 transition cursor-pointer border-none bg-transparent"
                            title="Editar"
                          >
                            <Edit size={14} />
                          </button>
                        )}
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
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-10 text-center opacity-30 uppercase font-black tracking-widest text-[10px]">
                    Nenhum processo encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
      `}</style>
    </div>
  )
}
