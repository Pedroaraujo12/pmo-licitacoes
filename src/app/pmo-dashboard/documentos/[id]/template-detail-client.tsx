'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Edit, Trash2, CheckCircle, AlertTriangle, Plus,
  Save, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getTemplate, listVersions, approveVersion, markVersionObsolete, deleteTemplate, createVersion, updateTemplate } from '@/lib/documentos'
import { formatDate } from '@/lib/utils'
import { TIPO_DOCUMENTO_LABELS, CATEGORIA_LABELS, TEMPLATE_STATUS_LABELS, TEMPLATE_STATUS_COLORS } from '@/types/documentos'
import type { DocumentTemplate, TemplateVersion } from '@/types/documentos'

export default function TemplateDetailClient({ params }: { params: Promise<{ id: string }> }) {
  const paramsId = use(params).id
  const [id, setId] = useState(paramsId)
  const router = useRouter()
  const supabase = createClient()
  const [template, setTemplate] = useState<DocumentTemplate | null>(null)
  const [versions, setVersions] = useState<TemplateVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [approvalObs, setApprovalObs] = useState('')
  const [showApproval, setShowApproval] = useState<string | null>(null)
  const [profile, setProfile] = useState<{ role: string } | null>(null)
  // Inline editing
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescricao, setEditDescricao] = useState('')
  const [editBaseLegal, setEditBaseLegal] = useState('')
  const [editSeiLink, setEditSeiLink] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editTipo, setEditTipo] = useState('')
  const [editCategoria, setEditCategoria] = useState('')
  const [saving, setSaving] = useState(false)
  // Inline new version
  const [novaVersao, setNovaVersao] = useState(false)
  const [nvConteudo, setNvConteudo] = useState('')
  const [nvResumo, setNvResumo] = useState('')
  const [nvSaving, setNvSaving] = useState(false)

  async function load() {
    const supabase = createClient()
    const [{ data: t }, { data: v }] = await Promise.all([
      getTemplate(supabase, id),
      listVersions(supabase, id),
    ])
    if (!t && typeof window !== 'undefined') {
      const m = window.location.pathname.match(/\/documentos\/([a-f0-9-]+)/)
      if (m && m[1] !== id) {
        setId(m[1])
        return
      }
    }
    if (t) setTemplate(t)
    if (v) setVersions(v)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setProfile(p)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/set-state-in-effect,react-hooks/exhaustive-deps

  const canManage = profile?.role && ['admin', 'gestor'].includes(profile.role)
  const canApprove = profile?.role && ['admin', 'gestor'].includes(profile.role)

  const [deleteError, setDeleteError] = useState('')

  function startEditing() {
    if (!template) return
    setEditTitle(template.title)
    setEditDescricao(template.descricao || '')
    setEditBaseLegal(template.base_legal || '')
    setEditSeiLink(template.sei_link || '')
    setEditTags((template.tags || []).join(', '))
    setEditTipo(template.tipo_documento)
    setEditCategoria(template.categoria)
    setEditing(true)
  }

  async function saveEdit() {
    if (!editTitle.trim()) return
    setSaving(true)
    try {
      await updateTemplate(supabase, id, {
        title: editTitle,
        tipo_documento: editTipo,
        categoria: editCategoria,
        base_legal: editBaseLegal || undefined,
        sei_link: editSeiLink || undefined,
        descricao: editDescricao || undefined,
        tags: editTags ? editTags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
      })
      setEditing(false)
      load()
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  async function handleApprove(versionId: string) {
    setApprovingId(versionId)
    try {
      await approveVersion(supabase, versionId, approvalObs)
      setShowApproval(null)
      setApprovalObs('')
      load()
    } catch (err) { console.error(err) }
    finally { setApprovingId(null) }
  }

  async function handleObsolete(versionId: string) {
    await markVersionObsolete(supabase, versionId)
    load()
  }

  async function handleDelete() {
    if (!confirm('Excluir este modelo? Todas as versões serão removidas.')) return
    try {
      await deleteTemplate(supabase, id)
      router.push('/pmo-dashboard/documentos')
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir modelo. Verifique se não há documentos gerados vinculados.')
    }
  }

  async function handleCreateVersion(e: React.FormEvent) {
    e.preventDefault()
    if (!nvConteudo.trim() || !nvResumo.trim()) return
    setNvSaving(true)
    try {
      await createVersion(supabase, id, { conteudo: nvConteudo, resumo_alteracao: nvResumo })
      setNovaVersao(false)
      setNvConteudo('')
      setNvResumo('')
      load()
    } catch (err) { console.error(err) }
    finally { setNvSaving(false) }
  }

  const baseInput = {
    width: '100%', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, fontSize: 13, background: 'rgba(30,41,59,0.5)', color: '#cbd5e1', outline: 'none',
  } as const

  const cardStyle: React.CSSProperties = {
    background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
    borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', padding: 24, marginBottom: 24,
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><div className="loading-spinner" /></div>
  if (!template) return <div style={{ padding: 60, textAlign: 'center', color: '#ef4444' }}>Modelo não encontrado</div>

  const activeVersion = versions.find(v => v.id === template.versao_vigente_id)

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/pmo-dashboard/documentos')}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              {editing ? <input value={editTitle} onChange={e => setEditTitle(e.target.value)} style={{ ...baseInput, fontSize: 18, fontWeight: 700, color: '#f8fafc', background: 'rgba(30,41,59,0.8)' }} /> : template.title}
            </h1>
            <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: `${TEMPLATE_STATUS_COLORS[template.status]}20`, color: TEMPLATE_STATUS_COLORS[template.status], fontWeight: 600 }}>
                {TEMPLATE_STATUS_LABELS[template.status]}
              </span>
              {editing ? (
                <select value={editTipo} onChange={e => setEditTipo(e.target.value)} style={{ ...baseInput, width: 'auto', fontSize: 11, padding: '2px 8px' }}>
                  {Object.entries(TIPO_DOCUMENTO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              ) : (
                <span style={{ fontSize: 12, color: '#64748b' }}>{TIPO_DOCUMENTO_LABELS[template.tipo_documento as keyof typeof TIPO_DOCUMENTO_LABELS]}</span>
              )}
              {editing ? (
                <select value={editCategoria} onChange={e => setEditCategoria(e.target.value)} style={{ ...baseInput, width: 'auto', fontSize: 11, padding: '2px 8px' }}>
                  {Object.entries(CATEGORIA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              ) : (
                <span style={{ fontSize: 12, color: '#64748b' }}>{CATEGORIA_LABELS[template.categoria as keyof typeof CATEGORIA_LABELS]}</span>
              )}
              {editing ? (
                <input value={editBaseLegal} onChange={e => setEditBaseLegal(e.target.value)} placeholder="Base legal" style={{ ...baseInput, width: 200, fontSize: 11, padding: '2px 8px' }} />
              ) : template.base_legal && <span style={{ fontSize: 12, color: '#60a5fa' }}>{template.base_legal}</span>}
              {editing ? (
                <input value={editSeiLink} onChange={e => setEditSeiLink(e.target.value)} placeholder="Link SEI" style={{ ...baseInput, width: 200, fontSize: 11, padding: '2px 8px' }} />
              ) : template.sei_link && <a href={template.sei_link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#60a5fa', textDecoration: 'underline' }}>Link SEI</a>}
            </div>
          </div>
        </div>
        {canManage && (
          <div style={{ display: 'flex', gap: 8 }}>
            {editing ? (
              <>
                <button onClick={() => setEditing(false)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#334155', color: '#f1f5f9', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
                  <X size={14} /> Cancelar
                </button>
                <button onClick={saveEdit} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                  <Save size={14} /> Salvar
                </button>
              </>
            ) : (
              <>
                <button onClick={startEditing} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#334155', color: '#f1f5f9', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <Edit size={14} /> Editar
                </button>
                {canApprove && (
                  <button onClick={handleDelete} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    <Trash2 size={14} /> Excluir
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {deleteError && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', borderRadius: 8, fontSize: 13, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError('')} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={cardStyle}>
          <h3 style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Descrição</h3>
          {editing ? (
            <textarea value={editDescricao} onChange={e => setEditDescricao(e.target.value)} rows={3} style={{ ...baseInput, resize: 'vertical' }} />
          ) : (
            <p style={{ fontSize: 13, color: '#cbd5e1', margin: 0 }}>{template.descricao || 'Sem descrição'}</p>
          )}
        </div>
        <div style={cardStyle}>
          <h3 style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tags</h3>
          {editing ? (
            <input value={editTags} onChange={e => setEditTags(e.target.value)} placeholder="tag1, tag2, tag3" style={baseInput} />
          ) : (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {template.tags?.length > 0 ? template.tags.map(t => (
                <span key={t} style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(37,99,235,0.2)', color: '#60a5fa', borderRadius: 10 }}>#{t}</span>
              )) : <span style={{ fontSize: 13, color: '#64748b' }}>Nenhuma tag</span>}
            </div>
          )}
        </div>
      </div>

      {/* Versão vigente */}
      <div style={{ ...cardStyle, borderLeft: activeVersion ? '4px solid #22c55e' : '4px solid #64748b' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {activeVersion ? `Versão Vigente: v${activeVersion.version_number}` : 'Nenhuma versão vigente'}
          </h3>
          {activeVersion?.status === 'aprovado' && <CheckCircle size={18} color="#22c55e" />}
        </div>
        {activeVersion && (
          <div>
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px' }}>
              Aprovado em {activeVersion.data_aprovacao ? formatDate(activeVersion.data_aprovacao) : '—'}
              {activeVersion.profiles_aprovador?.name ? ` por ${activeVersion.profiles_aprovador.name}` : ''}
            </p>
            {activeVersion.resumo_alteracao && <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>{activeVersion.resumo_alteracao}</p>}
          </div>
        )}
      </div>

      {/* Versões */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Versões ({versions.length})
          </h3>
          {canManage && !novaVersao && (
            <button onClick={() => { setNovaVersao(true); setNvConteudo(template.conteudo) }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
              <Plus size={14} /> Nova Versão
            </button>
          )}
        </div>

        {/* Inline new version form */}
        {novaVersao && (
          <form onSubmit={handleCreateVersion} style={{ marginBottom: 16, padding: 16, background: 'rgba(30,41,59,0.5)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', margin: '0 0 12px' }}>Nova Versão</h4>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>Resumo da Alteração *</label>
              <input value={nvResumo} onChange={e => setNvResumo(e.target.value)} placeholder="Ex: Atualização da base legal" style={baseInput} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>Conteúdo *</label>
              <textarea value={nvConteudo} onChange={e => setNvConteudo(e.target.value)} rows={12}
                style={{ ...baseInput, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setNovaVersao(false)} style={{ padding: '6px 14px', background: '#334155', color: '#f1f5f9', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
              <button type="submit" disabled={nvSaving || !nvConteudo.trim() || !nvResumo.trim()}
                style={{ padding: '6px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: nvSaving ? 0.6 : 1 }}>
                {nvSaving ? 'Salvando...' : 'Criar Versão'}
              </button>
            </div>
          </form>
        )}

        {versions.length === 0 ? (
          <p style={{ fontSize: 13, color: '#64748b' }}>Nenhuma versão cadastrada</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {versions.map(v => (
              <div key={v.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', background: 'rgba(30,41,59,0.5)', borderRadius: 10,
                border: `1px solid ${v.id === template.versao_vigente_id ? 'rgba(34,197,94,0.3)' : 'transparent'}`,
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#f1f5f9' }}>v{v.version_number}</span>
                    <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 8, background: `${TEMPLATE_STATUS_COLORS[v.status]}20`, color: TEMPLATE_STATUS_COLORS[v.status], fontWeight: 600 }}>
                      {TEMPLATE_STATUS_LABELS[v.status]}
                    </span>
                    {v.id === template.versao_vigente_id && (
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: 'rgba(34,197,94,0.2)', color: '#22c55e', fontWeight: 700 }}>VIGENTE</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    <span>{v.profiles?.name || '—'}</span>
                    <span>{v.created_at ? formatDate(v.created_at) : '—'}</span>
                    {v.resumo_alteracao && <span style={{ color: '#94a3b8' }}>{v.resumo_alteracao}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {canApprove && (v.status === 'rascunho' || v.status === 'em_revisao_juridica') && (
                    showApproval === v.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input value={approvalObs} onChange={e => setApprovalObs(e.target.value)}
                          placeholder="Observações..." style={{ width: 140, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', fontSize: 11, background: 'rgba(30,41,59,0.5)', color: '#cbd5e1', outline: 'none' }} />
                        <button onClick={() => handleApprove(v.id)} disabled={approvingId === v.id}
                          style={{ padding: '4px 10px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                          {approvingId === v.id ? '...' : 'Aprovar'}
                        </button>
                        <button onClick={() => setShowApproval(null)} style={{ padding: '4px 8px', background: 'transparent', color: '#94a3b8', border: 'none', fontSize: 11, cursor: 'pointer' }}>X</button>
                      </div>
                    ) : (
                      <button onClick={() => setShowApproval(v.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                        <CheckCircle size={12} /> Aprovar
                      </button>
                    )
                  )}
                  {(v.status === 'aprovado' || v.status === 'em_revisao_juridica') && canManage && v.id !== template.versao_vigente_id && (
                    <button onClick={() => handleObsolete(v.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                      <AlertTriangle size={12} /> Obsoleto
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Visualização do conteúdo (versão vigente) */}
      {activeVersion && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pré-visualização (v{activeVersion.version_number})
          </h3>
          <div style={{
            background: '#fff', color: '#1e293b', borderRadius: 10, padding: 24,
            fontSize: 13, lineHeight: 1.6, fontFamily: 'monospace', whiteSpace: 'pre-wrap', overflow: 'auto',
            maxHeight: 400,
          }}>
            {activeVersion.conteudo}
          </div>
        </div>
      )}
    </div>
  )
}
