'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  listFavoritos, toggleFavorito, listUnidades, listCargos, getMetricas,
} from '@/lib/colaboradores'
import type { Colaborador } from '@/types/colaboradores'
import {
  SITUACAO_LABELS, SITUACAO_COLORS, REGIME_LABELS,
} from '@/types/colaboradores'
import { Plus, Star, Search, Phone, Mail, ChevronLeft, ChevronRight } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'

const PAGE_SIZE = 50

export default function ColaboradoresListPage() {
  const router = useRouter()
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const getSupabase = useCallback(() => {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }, [])

  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [favoritoIds, setFavoritoIds] = useState<Set<string>>(new Set())
  const [unidades, setUnidades] = useState<string[]>([])
  const [cargos, setCargos] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [filtroUnidade, setFiltroUnidade] = useState('')
  const [filtroCargo, setFiltroCargo] = useState('')
  const [filtroSituacao, setFiltroSituacao] = useState('')
  const [profile, setProfile] = useState<{ role: string } | null>(null)
  const [metricas, setMetricas] = useState<{
    ativos: number; afastados: number; desligados: number; total: number
    unidades_distintas: number
  } | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Fetch profile + static data once
  useEffect(() => {
    let cancelled = false
    const supabase = getSupabase()
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (cancelled || !user) return
      const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (p && !cancelled) setProfile(p as { role: string })
      const [u, c, m] = await Promise.all([
        listUnidades(supabase),
        listCargos(supabase),
        getMetricas(supabase),
      ])
      if (!cancelled) { setUnidades(u); setCargos(c); setMetricas(m) }
    }
    load()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch list + favoritos on filter/page change
  useEffect(() => {
    let cancelled = false
    const supabase = getSupabase()
    async function load() {
      setLoadingList(true)
      setLoadError(null)
      try {
        const from = (page - 1) * PAGE_SIZE
        const to = from + PAGE_SIZE - 1
        const searchTerm = debouncedSearch.trim().replace(/[,%()]/g, ' ')

        let query = supabase
          .from('colaboradores')
          .select('*', { count: 'exact', head: false })
        if (filtroUnidade) query = query.eq('unidade', filtroUnidade)
        if (filtroCargo) query = query.eq('cargo', filtroCargo)
        if (filtroSituacao) query = query.eq('situacao', filtroSituacao)
        if (searchTerm) {
          query = query.or(`nome_completo.ilike.%${searchTerm}%,unidade.ilike.%${searchTerm}%,cargo.ilike.%${searchTerm}%,email_institucional.ilike.%${searchTerm}%`)
        }

        const [result, favs] = await Promise.all([
          query.order('nome_completo', { ascending: true }).range(from, to) as unknown as { data: Colaborador[] | null; count: number | null; error: { message?: string } | null },
          listFavoritos(supabase),
        ])
        if (cancelled) return
        if (result.error) throw new Error(result.error.message || 'Erro ao carregar colaboradores')
        setColaboradores(result.data || [])
        setTotalCount(result.count ?? 0)
        setFavoritoIds(new Set(favs.map(f => f.colaborador_id)))
      } catch (err) {
        if (cancelled) return
        setColaboradores([])
        setTotalCount(0)
        setLoadError(err instanceof Error ? err.message : 'Erro ao carregar colaboradores')
      } finally {
        if (!cancelled) setLoadingList(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [debouncedSearch, filtroUnidade, filtroCargo, filtroSituacao, page]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFavorito(colaboradorId: string, e: React.MouseEvent) {
    e.stopPropagation()
    const added = await toggleFavorito(getSupabase(), colaboradorId)
    setFavoritoIds(prev => {
      const next = new Set(prev)
      if (added) next.add(colaboradorId)
      else next.delete(colaboradorId)
      return next
    })
  }

  const canEdit = profile?.role && ['admin', 'gestor'].includes(profile.role)
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const baseInput: React.CSSProperties = {
    padding: '8px 10px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
    fontSize: 13, background: 'rgba(30,41,59,0.5)', color: '#cbd5e1', outline: 'none',
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>Colaboradores</h1>
          {metricas && (
            <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12, color: '#64748b' }}>
              <span><span style={{ color: '#22c55e', fontWeight: 600 }}>{metricas.ativos}</span> ativos</span>
              {metricas.afastados > 0 && <span><span style={{ color: '#f59e0b', fontWeight: 600 }}>{metricas.afastados}</span> afastados</span>}
              <span><span style={{ color: '#64748b', fontWeight: 600 }}>{metricas.unidades_distintas}</span> unidades</span>
              <span><span style={{ color: '#64748b', fontWeight: 600 }}>{metricas.total}</span> total</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push('/pmo-dashboard/colaboradores/aniversariantes')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#334155', color: '#f1f5f9', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            🎂 Aniversariantes
          </button>
          {canEdit && (
            <Link href="/pmo-dashboard/colaboradores/novo"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>
              <Plus size={14} /> Novo Colaborador
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#64748b' }} />
          <input placeholder="Buscar por nome, unidade, cargo..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            style={{ ...baseInput, paddingLeft: 32, width: '100%' }} />
        </div>
        <select value={filtroUnidade} onChange={e => { setFiltroUnidade(e.target.value); setPage(1) }} style={{ ...baseInput, minWidth: 150 }}>
          <option value="">Todas unidades</option>
          {unidades.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={filtroCargo} onChange={e => { setFiltroCargo(e.target.value); setPage(1) }} style={{ ...baseInput, minWidth: 150 }}>
          <option value="">Todos cargos</option>
          {cargos.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filtroSituacao} onChange={e => { setFiltroSituacao(e.target.value); setPage(1) }} style={{ ...baseInput, minWidth: 130 }}>
          <option value="">Todas situações</option>
          <option value="ativo">Ativo</option>
          <option value="afastado">Afastado</option>
          <option value="desligado">Desligado</option>
        </select>
        <span style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center' }}>
          {totalCount} registros
        </span>
      </div>

      {/* Lista */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {loadingList ? (
          [1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{
              height: 66, padding: '12px 16px', background: 'rgba(30,41,59,0.7)',
              borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div style={{ height: 14, width: '55%', background: 'rgba(71,85,105,0.45)', borderRadius: 7, marginBottom: 10 }} />
              <div style={{ height: 10, width: '38%', background: 'rgba(71,85,105,0.35)', borderRadius: 5 }} />
            </div>
          ))
        ) : loadError ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#fca5a5', fontSize: 14 }}>
            {loadError}
          </div>
        ) : colaboradores.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#64748b', fontSize: 14 }}>
            Nenhum colaborador encontrado
          </div>
        ) : (
          colaboradores.map(c => (
            <div key={c.id} onClick={() => router.push(`/pmo-dashboard/colaboradores/detalhe?id=${c.id}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
                borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(30,41,59,0.9)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(30,41,59,0.7)')}>
              <button onClick={e => handleFavorito(c.id, e)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
                <Star size={16} fill={favoritoIds.has(c.id) ? '#f59e0b' : 'none'}
                  color={favoritoIds.has(c.id) ? '#f59e0b' : '#475569'} />
              </button>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: 16, flexShrink: 0,
              }}>
                {c.nome_completo.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#f1f5f9' }}>{c.nome_completo}</span>
                  <span style={{
                    fontSize: 10, padding: '1px 7px', borderRadius: 6,
                    background: `${SITUACAO_COLORS[c.situacao]}20`,
                    color: SITUACAO_COLORS[c.situacao], fontWeight: 600,
                  }}>{SITUACAO_LABELS[c.situacao]}</span>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                  {c.cargo && <span>{c.cargo}</span>}
                  {c.unidade && <span>{c.unidade}</span>}
                  {c.regime && <span>{REGIME_LABELS[c.regime]}</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 12, color: '#64748b', flexShrink: 0 }}>
                {c.email_institucional && <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                  <Mail size={11} /> {c.email_institucional}
                </div>}
                {c.telefone_institucional && <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 2 }}>
                  <Phone size={11} /> {c.telefone_institucional}{c.ramal ? ` (${c.ramal})` : ''}
                </div>}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 20 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            style={{ background: '#334155', color: '#cbd5e1', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.5 : 1, fontSize: 12 }}>
            <ChevronLeft size={14} />
          </button>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{page} de {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            style={{ background: '#334155', color: '#cbd5e1', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: page >= totalPages ? 'default' : 'pointer', opacity: page >= totalPages ? 0.5 : 1, fontSize: 12 }}>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
