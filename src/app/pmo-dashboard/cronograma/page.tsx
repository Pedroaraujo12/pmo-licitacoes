'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useDebounce } from '@/hooks/useDebounce'
import { fetchAllSeiLinks, formatDate } from '@/lib/utils'
import {
  listarCronogramaCompleto, calcularDistribuicaoEtapas, distribuicaoComModelo,
  modalidadesPresentes, SEM_CRONOGRAMA,
  type LinhaCronograma, type EtapaContagem,
} from '@/lib/cronograma-lista'
import { listModalidadesComModelo, listEtapasDeModelos, type EtapaModelo } from '@/lib/simulador-cronograma'

import {
  CheckCircle2, Clock, Circle, ArrowRight, Search,
  ChevronLeft, ChevronRight
} from 'lucide-react'

/** Status de `status_processo` que representam execução em curso. */
const STATUS_ANDAMENTO = ['Em andamento']

type CronogramaRow = LinhaCronograma & { total_count?: number }

function statusBadge(pa: string) {
  switch (pa) {
    case 'concluido': return { label: 'Concluído', color: '#059669', icon: CheckCircle2 }
    case 'em_andamento': return { label: 'Em Andamento', color: '#2563eb', icon: Clock }
    default: return { label: 'Não Iniciado', color: '#64748b', icon: Circle }
  }
}

export default function CronogramaPage() {
  const router = useRouter()
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
  const [semResultadoFiltrado, setSemResultadoFiltrado] = useState(false)
  const [todasLinhas, setTodasLinhas] = useState<LinhaCronograma[]>([])
  const [etapaFiltro, setEtapaFiltro] = useState<string | null>(null)
  const [modalidadeFiltro, setModalidadeFiltro] = useState<string | null>(null)
  const [etapasPorModalidade, setEtapasPorModalidade] = useState<Record<string, EtapaModelo[]>>({})

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
        const { linhas } = await listarCronogramaCompleto(supabase, {
          statusNomes: apenasAndamento ? STATUS_ANDAMENTO : null,
          busca: debouncedSearch || null,
        })

        if (cancelled) return

        setTodasLinhas(linhas)
        setSemResultadoFiltrado(apenasAndamento && linhas.length === 0)
      } catch (err) {
        console.warn('Erro ao carregar cronograma:', err)
        if (!cancelled) setTodasLinhas([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [debouncedSearch, apenasAndamento])

  // Ritos cadastrados, para exibir o cronograma completo da modalidade —
  // inclusive as etapas onde não há nenhum processo no momento.
  useEffect(() => {
    let cancelado = false

    async function carregarRitos() {
      const supabase = createClient()
      const mods = await listModalidadesComModelo(supabase)
      if (mods.length === 0 || cancelado) return

      const porModelo = await listEtapasDeModelos(supabase, mods.map(m => m.modelo_id))
      if (cancelado) return

      const porModalidade: Record<string, EtapaModelo[]> = {}
      for (const m of mods) {
        const etapas = porModelo[m.modelo_id]
        if (etapas?.length) porModalidade[m.modalidade_nome] = etapas
      }
      setEtapasPorModalidade(porModalidade)
    }

    carregarRitos()
    return () => { cancelado = true }
  }, [])

  const modalidades = useMemo(() => modalidadesPresentes(todasLinhas), [todasLinhas])

  const linhasDaModalidade = useMemo(
    () => modalidadeFiltro
      ? todasLinhas.filter(l => l.modalidade_nome === modalidadeFiltro)
      : todasLinhas,
    [todasLinhas, modalidadeFiltro])

  // Distribuição sobre o conjunto inteiro, não sobre a página exibida
  const distribuicao: EtapaContagem[] = useMemo(() => {
    const doRito = modalidadeFiltro ? etapasPorModalidade[modalidadeFiltro] : null
    return doRito
      ? distribuicaoComModelo(linhasDaModalidade, doRito)
      : calcularDistribuicaoEtapas(linhasDaModalidade)
  }, [linhasDaModalidade, modalidadeFiltro, etapasPorModalidade])

  const linhasFiltradas = useMemo(
    () => etapaFiltro
      ? linhasDaModalidade.filter(l => (l.etapa_atual ?? SEM_CRONOGRAMA) === etapaFiltro)
      : linhasDaModalidade,
    [linhasDaModalidade, etapaFiltro])


  useEffect(() => {
    const supabase = createClient()
    fetchAllSeiLinks(supabase).then(setSeiLinks)
  }, [])

  const totalCount = linhasFiltradas.length
  const totalPages = useMemo(() => Math.ceil(totalCount / perPage) || 1, [totalCount])

  const list = useMemo(
    () => linhasFiltradas.slice((page - 1) * perPage, page * perPage) as CronogramaRow[],
    [linhasFiltradas, page])

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

      {modalidades.length > 1 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: '#64748b', marginBottom: 8,
          }}>
            Modalidade
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[null, ...modalidades].map(m => {
              const ativo = modalidadeFiltro === m
              const qtd = m ? todasLinhas.filter(l => l.modalidade_nome === m).length : todasLinhas.length
              return (
                <button
                  key={m ?? 'todas'}
                  type="button"
                  onClick={() => { setModalidadeFiltro(m); setEtapaFiltro(null); setPage(1) }}
                  style={{
                    padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 999,
                    cursor: 'pointer',
                    background: ativo ? 'rgba(167,139,250,0.15)' : 'transparent',
                    color: ativo ? '#a78bfa' : '#94a3b8',
                    border: `1px solid ${ativo ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  }}
                >
                  {m ?? 'Todas'} <span style={{ opacity: 0.7 }}>· {qtd}</span>
                </button>
              )
            })}
          </div>
          {modalidadeFiltro && !etapasPorModalidade[modalidadeFiltro] && (
            <p style={{ fontSize: 11, color: '#fbbf24', margin: '6px 0 0' }}>
              Esta modalidade não tem modelo de cronograma cadastrado — as etapas
              abaixo vêm apenas dos processos existentes.
            </p>
          )}
        </div>
      )}

      {distribuicao.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: '#64748b', marginBottom: 8,
          }}>
            {modalidadeFiltro && etapasPorModalidade[modalidadeFiltro]
              ? `Etapas do rito · ${modalidadeFiltro}`
              : 'Em que etapa estão'}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => { setEtapaFiltro(null); setPage(1) }}
              style={{
                padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 999,
                cursor: 'pointer',
                background: etapaFiltro === null ? 'rgba(56,189,248,0.15)' : 'transparent',
                color: etapaFiltro === null ? '#38bdf8' : '#94a3b8',
                border: `1px solid ${etapaFiltro === null ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.1)'}`,
              }}
            >
              Todas · {linhasDaModalidade.length}
            </button>
            {distribuicao.map(d => {
              const ativo = etapaFiltro === d.etapa
              const vazio = d.total === 0
              return (
                <button
                  key={d.etapa}
                  type="button"
                  onClick={() => { if (!vazio) { setEtapaFiltro(ativo ? null : d.etapa); setPage(1) } }}
                  disabled={vazio}
                  title={vazio ? `${d.etapa} — nenhum processo nesta etapa` : d.etapa}
                  style={{
                    padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 999,
                    cursor: vazio ? 'default' : 'pointer', maxWidth: 340, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    opacity: vazio ? 0.4 : 1,
                    background: ativo ? 'rgba(56,189,248,0.15)' : 'rgba(30,41,59,0.6)',
                    color: ativo ? '#38bdf8' : (d.noModelo === false ? '#fbbf24' : '#cbd5e1'),
                    border: `1px solid ${ativo ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  {d.ordem < Number.MAX_SAFE_INTEGER ? `${d.ordem}. ` : ''}{d.etapa}
                  <span style={{ marginLeft: 6, opacity: 0.75 }}>· {d.total}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {semResultadoFiltrado && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: 10, padding: '10px 14px', marginBottom: 16,
          fontSize: 12, color: '#fbbf24',
        }}>
          Nenhum processo com status &quot;{STATUS_ANDAMENTO.join('&quot; ou &quot;')}&quot;.
          Confira o status cadastrado nos processos ou veja todos.
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
