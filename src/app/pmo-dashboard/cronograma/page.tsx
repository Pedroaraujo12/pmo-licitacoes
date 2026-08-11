'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useDebounce } from '@/hooks/useDebounce'
import { fetchAllSeiLinks, formatDate } from '@/lib/utils'

import {
  CheckCircle2, Clock, Circle, ArrowRight, Search,
  ChevronLeft, ChevronRight
} from 'lucide-react'

/** Status de `status_processo` que representam execução em curso. */
const STATUS_ANDAMENTO = ['Em andamento']

/** Teto do filtro feito no cliente, enquanto o banco não tem p_status. */
const FALLBACK_LIMIT = 500

interface CronogramaRow {
  id: string
  id_processo: string | null
  objeto_resumido: string | null
  data_entrada: string | null
  data_entrega: string | null
  modalidade_nome: string | null
  status_nome: string | null
  total_atividades: number
  concluidas: number
  atrasadas: number
  ultima_fase: string | null
  progresso: number
  processo_atrasado: boolean
  total_count: number
}

function statusBadge(pa: string) {
  switch (pa) {
    case 'concluido': return { label: 'Concluído', color: '#059669', icon: CheckCircle2 }
    case 'em_andamento': return { label: 'Em Andamento', color: '#2563eb', icon: Clock }
    default: return { label: 'Não Iniciado', color: '#64748b', icon: Circle }
  }
}

export default function CronogramaPage() {
  const router = useRouter()
  const [rows, setRows] = useState<CronogramaRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const perPage = 50
  const searchRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [seiLinks, setSeiLinks] = useState<Record<string, string>>({})
  const isMobile = useIsMobile()
  const debouncedSearch = useDebounce(search, 300)
  // A tela existe para acompanhar execução: só processos em andamento por
  // padrão. Concluídos, cancelados e devolvidos ficam atrás do filtro.
  const [apenasAndamento, setApenasAndamento] = useState(true)
  const [semFiltroBanco, setSemFiltroBanco] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function load() {
      setLoading(true)
      try {
        const offset = (page - 1) * perPage
        const timeoutPromise = new Promise<null>((resolve) => {
          window.setTimeout(() => resolve(null), 10000)
        })

        type RpcResult = { data?: CronogramaRow[]; error?: { message?: string } } | null

        const chamar = (comStatus: boolean) => supabase.rpc('get_cronograma_page', {
          p_search: debouncedSearch || null,
          p_limit: perPage,
          p_offset: offset,
          ...(comStatus ? { p_status: STATUS_ANDAMENTO } : {}),
        })

        const rpcResult = await Promise.race([chamar(apenasAndamento), timeoutPromise]) as RpcResult

        // Banco ainda sem o parâmetro p_status (migration não aplicada).
        // Em vez de desistir do filtro, busca a lista inteira e filtra pelos
        // ids dos processos em andamento, paginando no cliente. Funciona bem
        // nesta escala; a migration apenas devolve o trabalho ao banco.
        if (apenasAndamento && rpcResult?.error) {
          const [todos, emAndamento] = await Promise.all([
            supabase.rpc('get_cronograma_page', {
              p_search: debouncedSearch || null,
              p_limit: FALLBACK_LIMIT,
              p_offset: 0,
            }),
            supabase
              .from('processos')
              .select('id, status_processo!inner(nome)')
              .in('status_processo.nome', STATUS_ANDAMENTO)
              .limit(FALLBACK_LIMIT),
          ])

          if (cancelled) return

          const idsAndamento = new Set(
            (emAndamento.data ?? []).map(p => (p as { id: string }).id),
          )
          const filtrados = ((todos.data ?? []) as CronogramaRow[])
            .filter(r => idsAndamento.has(r.id))

          setSemFiltroBanco(true)
          setTotalCount(filtrados.length)
          setRows(filtrados.slice(offset, offset + perPage))
          return
        }

        const data = rpcResult?.data
        if (cancelled) return

        setSemFiltroBanco(false)
        if (data) {
          setRows(data as CronogramaRow[])
          setTotalCount(data[0]?.total_count ?? 0)
        } else {
          setRows([])
          setTotalCount(0)
        }
      } catch {
        if (!cancelled) { setRows([]); setTotalCount(0) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [debouncedSearch, page, apenasAndamento])

  useEffect(() => {
    const supabase = createClient()
    fetchAllSeiLinks(supabase).then(setSeiLinks)
  }, [])

  const totalPages = useMemo(() => Math.ceil(totalCount / perPage) || 1, [totalCount])

  const list = useMemo(() => rows, [rows])

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Carregando...</div>
  )

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: '#f1f5f9' }}>
        Cronograma de Processos
      </h1>
      <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 12 }}>
        {totalCount} processo{totalCount !== 1 ? 's' : ''}
        {apenasAndamento ? ' em andamento' : ''}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Em andamento', ativo: apenasAndamento, valor: true },
          { label: 'Todos os processos', ativo: !apenasAndamento, valor: false },
        ].map(opt => (
          <button
            key={opt.label}
            type="button"
            onClick={() => { setApenasAndamento(opt.valor); setPage(1) }}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 999,
              cursor: 'pointer',
              background: opt.ativo ? 'rgba(56,189,248,0.15)' : 'transparent',
              color: opt.ativo ? '#38bdf8' : '#94a3b8',
              border: `1px solid ${opt.ativo ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.1)'}`,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {semFiltroBanco && apenasAndamento && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.2)',
          borderRadius: 10, padding: '8px 12px', marginBottom: 16,
          fontSize: 11, color: '#94a3b8',
        }}>
          Filtro aplicado no navegador. Para que o banco faça esse trabalho,
          aplique a migration 20260811020000_cronograma_filtro_status.
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
        background: 'rgba(30,41,59,0.5)', borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.1)', padding: '0 12px',
      }}>
        <Search size={16} color="#64748b" />
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Buscar por ID ou objeto...  ⌘K"
          style={{
            flex: 1, padding: '10px 0', border: 'none', background: 'transparent',
            color: '#f1f5f9', fontSize: 14, outline: 'none', width: '100%',
          }}
        />
        {search && (
          <button onClick={() => { setSearch(''); setPage(1) }}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16 }}>
            ×
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
          {debouncedSearch ? 'Nenhum processo encontrado para esta busca.' : 'Nenhum processo encontrado.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.map(p => {
            const concluded = p.concluidas === p.total_atividades && p.total_atividades > 0
            const badge = statusBadge(concluded ? 'concluido' : (p.total_atividades > 0 ? 'em_andamento' : 'nao_iniciado'))
            const Icon = badge.icon
            return (
              <div
                key={p.id}
                onClick={() => router.push(`/pmo-dashboard/processos/detalhe?id=${p.id}`)}
                style={{
                  background: '#1e293b',
                  borderRadius: 12,
                  padding: isMobile ? 12 : 16,
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'stretch' : 'center',
                  gap: isMobile ? 8 : 16,
                  cursor: 'pointer',
                  border: p.processo_atrasado ? '1px solid #dc2626' : '1px solid #334155',
                }}
              >
                <Icon size={24} color={badge.color} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 14, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.objeto_resumido || 'Sem objeto'}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>
                    <a href={seiLinks[p.id] || '#'} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: seiLinks[p.id] ? 'underline' : 'none' }}>{p.id_processo || 'Sem ID'}</a>{p.modalidade_nome ? ` · ${p.modalidade_nome}` : ''}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 13 }}>
                    {p.data_entrada ? `Entrada: ${formatDate(p.data_entrada)}` : ''}
                    {p.total_atividades > 0 ? ` · ${p.concluidas}/${p.total_atividades} etapas` : ' · Sem cronograma'}
                    {p.progresso > 0 ? ` · ${p.progresso}%` : ''}
                    {p.atrasadas ? ` · ${p.atrasadas} atrasada(s)` : ''}
                  </div>
                  {p.ultima_fase && (
                    <div style={{ color: '#cbd5e1', fontSize: 13, marginTop: 4 }}>
                      Atual: {p.ultima_fase}
                    </div>
                  )}
                </div>

                {p.total_atividades > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      width: 80, height: 6, background: '#334155', borderRadius: 3, overflow: 'hidden', marginLeft: 'auto', marginBottom: 4,
                    }}>
                      <div style={{
                        width: `${p.progresso}%`,
                        height: '100%',
                        background: p.processo_atrasado ? '#dc2626' : '#22c55e',
                        borderRadius: 3,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                    <div style={{ color: '#64748b', fontSize: 12 }}>
                      {p.data_entrega ? `Previsão: ${formatDate(p.data_entrega)}` : ''}
                    </div>
                  </div>
                )}

                <ArrowRight size={16} color="#64748b" />
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 24 }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{
              background: 'rgba(30,41,59,0.8)', border: '1px solid #334155',
              color: page <= 1 ? '#475569' : '#f1f5f9', borderRadius: 8, padding: '6px 12px',
              cursor: page <= 1 ? 'not-allowed' : 'pointer', fontSize: 13,
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ color: '#94a3b8', fontSize: 13 }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{
              background: 'rgba(30,41,59,0.8)', border: '1px solid #334155',
              color: page >= totalPages ? '#475569' : '#f1f5f9', borderRadius: 8, padding: '6px 12px',
              cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontSize: 13,
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
