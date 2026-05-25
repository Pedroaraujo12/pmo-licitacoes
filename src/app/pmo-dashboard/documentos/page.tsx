'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Star, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { listTemplates, listFavorites, toggleFavorite } from '@/lib/documentos'
import { TIPO_DOCUMENTO_LABELS, CATEGORIA_LABELS, TEMPLATE_STATUS_LABELS, TEMPLATE_STATUS_COLORS } from '@/types/documentos'
import { PT_BR } from '@/lib/pt-br'
import type { DocumentTemplate } from '@/types/documentos'

export default function DocumentosListPage() {
  const router = useRouter()
  const supabase = createClient()
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [favorites, setFavorites] = useState<Set<string>>(new Set())

  async function load() {
    setLoading(true)
    const [{ data: favs }, { data }] = await Promise.all([
      listFavorites(supabase),
      listTemplates(supabase, {
        tipo: filtroTipo || undefined,
        categoria: filtroCategoria || undefined,
        status: filtroStatus || undefined,
        search: search || undefined,
      }),
    ])
    if (favs) setFavorites(new Set(favs.map(f => f.template_id)))
    if (data) setTemplates(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [filtroTipo, filtroCategoria, filtroStatus]) // eslint-disable-line react-hooks/set-state-in-effect,react-hooks/exhaustive-deps

  function handleSearch() { load() }

  async function handleToggleFavorite(id: string) {
    await toggleFavorite(supabase, id)
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const baseInput = {
    padding: '8px 10px',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    fontSize: 13,
    background: 'rgba(30,41,59,0.5)',
    color: '#cbd5e1',
    outline: 'none',
  } as const

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>Modelos de Documentos</h1>
        <button onClick={() => router.push('/pmo-dashboard/documentos/novo')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={16} /> Novo Modelo
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#64748b' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Buscar modelos..." style={{ ...baseInput, paddingLeft: 32, width: '100%' }} />
        </div>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ ...baseInput, cursor: 'pointer', minWidth: 160 }}>
          <option value="">Todos os tipos</option>
          {Object.entries(TIPO_DOCUMENTO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} style={{ ...baseInput, cursor: 'pointer', minWidth: 160 }}>
          <option value="">Todas categorias</option>
          {Object.entries(CATEGORIA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ ...baseInput, cursor: 'pointer', minWidth: 140 }}>
          <option value="">{PT_BR.filters.allStatus}</option>
          {Object.entries(TEMPLATE_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={handleSearch}
          style={{ padding: '8px 16px', background: '#334155', color: '#f1f5f9', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
          Buscar
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
          <div className="loading-spinner" />
        </div>
      ) : templates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>
          <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <p style={{ fontSize: 14 }}>Nenhum modelo encontrado</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {templates.map(t => (
            <div key={t.id} onClick={() => router.push(`/pmo-dashboard/documentos/${t.id}`)}
              style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', background: 'rgba(30,41,59,0.7)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}>
              <button onClick={e => { e.stopPropagation(); handleToggleFavorite(t.id) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
                <Star size={16} fill={favorites.has(t.id) ? '#eab308' : 'none'} color={favorites.has(t.id) ? '#eab308' : '#64748b'} />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#f1f5f9' }}>{t.title}</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: `${TEMPLATE_STATUS_COLORS[t.status]}20`, color: TEMPLATE_STATUS_COLORS[t.status], fontWeight: 600 }}>
                    {TEMPLATE_STATUS_LABELS[t.status]}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#64748b' }}>
                  <span>{TIPO_DOCUMENTO_LABELS[t.tipo_documento as keyof typeof TIPO_DOCUMENTO_LABELS]}</span>
                  <span>{CATEGORIA_LABELS[t.categoria as keyof typeof CATEGORIA_LABELS]}</span>
                  {t.base_legal && <span>{t.base_legal}</span>}
                  {t.tags?.length > 0 && <span>#{t.tags.join(' #')}</span>}
                </div>
                {t.descricao && <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.descricao}</p>}
              </div>
              <span style={{ fontSize: 11, color: '#475569', whiteSpace: 'nowrap' }}>{t.profiles?.name || '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
