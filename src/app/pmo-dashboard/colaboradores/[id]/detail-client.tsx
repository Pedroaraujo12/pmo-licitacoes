'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDateBR } from '@/lib/utils'
import {
  getColaborador, updateColaborador, deleteColaborador, toggleFavorito, isFavorito,
  vincularUsuario, desvincularUsuario, listProcessosColaborador, listUsersWithoutColaborador,
} from '@/lib/colaboradores'
import type { Colaborador } from '@/types/colaboradores'
import {
  SITUACAO_LABELS, SITUACAO_COLORS, REGIME_LABELS, SEXO_LABELS,
} from '@/types/colaboradores'
import RelatedNotes from '@/components/ui/notes/related-notes'
import {
  ArrowLeft, Star, Edit, Save, X, Trash2, Link, Unlink, User,
  Briefcase, Mail, MapPin, FileText,
} from 'lucide-react'

const baseInputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, fontSize: 13, background: 'rgba(30,41,59,0.5)', color: '#cbd5e1', outline: 'none',
}
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4,
}

function Field({ label, value, displayValue, formKey, editing, form, setForm }: {
  label: string
  value: string | null
  displayValue?: string | null
  formKey: string
  editing: boolean
  form: Record<string, string>
  setForm: (f: Record<string, string>) => void
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {editing ? (
        formKey === 'sexo' ? (
          <select value={form[formKey] || 'Nao_informado'} onChange={e => setForm({ ...form, [formKey]: e.target.value })} style={baseInputStyle}>
            <option value="Nao_informado">Não informado</option>
            <option value="M">Masculino</option>
            <option value="F">Feminino</option>
          </select>
        ) : formKey === 'regime' ? (
          <select value={form[formKey] || 'efetivo'} onChange={e => setForm({ ...form, [formKey]: e.target.value })} style={baseInputStyle}>
            {Object.entries(REGIME_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        ) : formKey === 'situacao' ? (
          <select value={form[formKey] || 'ativo'} onChange={e => setForm({ ...form, [formKey]: e.target.value })} style={baseInputStyle}>
            {Object.entries(SITUACAO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        ) : (
          <input value={form[formKey] || ''} onChange={e => setForm({ ...form, [formKey]: e.target.value })}
            placeholder={label} style={baseInputStyle} />
        )
      ) : (
        <span style={{ color: (displayValue || value) ? '#f1f5f9' : '#475569', fontSize: 13 }}>
          {(displayValue || value) || '—'}
        </span>
      )}
    </div>
  )
}

export default function ColaboradorDetailClient({ params }: { params: Promise<{ id: string }> }) {
  const paramsId = use(params).id
  const [id, setId] = useState(paramsId)
  const router = useRouter()
  const supabase = createClient()
  const [colaborador, setColaborador] = useState<Colaborador | null>(null)
  const [favoritado, setFavoritado] = useState(false)
  const [profile, setProfile] = useState<{ role: string } | null>(null)
  const [linkedUser, setLinkedUser] = useState<{ name: string; email: string } | null>(null)
  const [loading, setLoading] = useState(true)
  type ProcessoInfo = { id: string; id_processo: string | null; objeto_resumido: string | null; modalidades: { nome: string } | null; status_processo: { nome: string } | null }
  const [processos, setProcessos] = useState<ProcessoInfo[]>([])
  // Editing
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Vinculação
  const [showVincular, setShowVincular] = useState(false)
  const [usersDisponiveis, setUsersDisponiveis] = useState<{ id: string; name: string | null; email: string | null; role: string | null }[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')

  async function load() {
    let currentId = id
    if (currentId === 'placeholder') {
      const m = window.location.pathname.match(/\/colaboradores\/([a-f0-9-]+)/)
      if (m && m[1] !== 'placeholder') {
        currentId = m[1]
        setId(currentId)
        return
      }
    }
    const { data: colab } = await getColaborador(supabase, currentId)
    if (!colab) {
      setLoading(false)
      return
    }
    setColaborador(colab)
    const fav = await isFavorito(supabase, colab.id)
    setFavoritado(fav)
    const { processos: procs } = await listProcessosColaborador(supabase, colab.id)
    setProcessos((procs || []) as ProcessoInfo[])

    // Fetch linked user profile if user_id is set
    if (colab.user_id) {
      const { data: linked } = await supabase.from('profiles').select('name, email').eq('id', colab.user_id).maybeSingle()
      setLinkedUser(linked as { name: string; email: string } | null)
    } else {
      setLinkedUser(null)
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setProfile(p)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/set-state-in-effect,react-hooks/exhaustive-deps

  const canManage = profile?.role && ['admin', 'gestor'].includes(profile.role)
  const canViewSensitive = profile?.role && ['admin', 'gestor'].includes(profile.role)

  function startEditing() {
    if (!colaborador) return
    const fields: Record<string, string> = {}
    const keys = [
      'nome_completo', 'cpf', 'matricula', 'sexo', 'data_nascimento',
      'cargo', 'funcao', 'unidade', 'lotacao', 'regime', 'data_admissao', 'situacao',
      'email_institucional', 'telefone_institucional', 'ramal',
      'email_pessoal', 'celular', 'logradouro', 'numero', 'complemento',
      'bairro', 'cidade', 'uf', 'cep', 'observacoes',
    ]
    for (const k of keys) {
      fields[k] = (colaborador as unknown as Record<string, string>)[k] || ''
    }
    setForm(fields)
    setEditing(true)
  }

  async function saveEdit() {
    if (!form.nome_completo.trim()) return
    if (!form.data_nascimento) {
      setError('Data de nascimento é obrigatória')
      return
    }
    setSaving(true)
    setError('')
    try {
      const data: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(form)) {
        data[k] = v || null
      }
      if (data.cpf) data.cpf = (data.cpf as string).replace(/\D/g, '')
      await updateColaborador(supabase, id, data as Parameters<typeof updateColaborador>[2])
      setEditing(false)
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar alterações')
    }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!confirm('Excluir permanentemente este colaborador?')) return
    try {
      await deleteColaborador(supabase, id)
      router.push('/pmo-dashboard/colaboradores')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir colaborador')
    }
  }

  async function handleFavorito() {
    try {
      const added = await toggleFavorito(supabase, id)
      setFavoritado(added)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao alternar favorito')
    }
  }

  async function openVincular() {
    const users = await listUsersWithoutColaborador(supabase)
    setUsersDisponiveis(users)
    setSelectedUserId('')
    setShowVincular(true)
  }

  async function handleVincular() {
    if (!selectedUserId) return
    await vincularUsuario(supabase, id, selectedUserId)
    setShowVincular(false)
    load()
  }

  async function handleDesvincular() {
    await desvincularUsuario(supabase, id)
    load()
  }

  const cardStyle: React.CSSProperties = {
    background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
    borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', padding: 24, marginBottom: 16,
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><div className="loading-spinner" /></div>
  if (!colaborador) return <div style={{ padding: 60, textAlign: 'center', color: '#ef4444' }}>Colaborador não encontrado</div>

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/pmo-dashboard/colaboradores')}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
            <ArrowLeft size={20} />
          </button>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
            {colaborador.nome_completo.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              {editing ? <input value={form.nome_completo || ''} onChange={e => setForm({ ...form, nome_completo: e.target.value })} style={{ ...baseInputStyle, fontSize: 18, fontWeight: 700, color: '#f8fafc' }} /> : colaborador.nome_completo}
            </h1>
            <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: `${SITUACAO_COLORS[colaborador.situacao]}20`, color: SITUACAO_COLORS[colaborador.situacao], fontWeight: 600 }}>
                {SITUACAO_LABELS[colaborador.situacao]}
              </span>
              {colaborador.cargo && <span style={{ fontSize: 13, color: '#94a3b8' }}>{colaborador.cargo}</span>}
              {colaborador.unidade && <span style={{ fontSize: 13, color: '#94a3b8' }}>{colaborador.unidade}</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={handleFavorito}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}>
            <Star size={18} fill={favoritado ? '#f59e0b' : 'none'} color={favoritado ? '#f59e0b' : '#475569'} />
          </button>
          {canManage && !editing && (
            <>
              <button onClick={startEditing}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#334155', color: '#f1f5f9', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
                <Edit size={14} /> Editar
              </button>
              <button onClick={handleDelete}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
                <Trash2 size={14} />
              </button>
            </>
          )}
          {editing && (
            <>
              <button onClick={() => setEditing(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#334155', color: '#f1f5f9', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
                <X size={14} /> Cancelar
              </button>
              <button onClick={saveEdit} disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                <Save size={14} /> Salvar
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', borderRadius: 8, fontSize: 13, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Dados Funcionais */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Briefcase size={14} /> Dados Funcionais
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field editing={editing} form={form} setForm={setForm} label="Cargo" value={colaborador.cargo} formKey="cargo" />
            <Field editing={editing} form={form} setForm={setForm} label="Função" value={colaborador.funcao} formKey="funcao" />
            <Field editing={editing} form={form} setForm={setForm} label="Unidade/Coordenação" value={colaborador.unidade} formKey="unidade" />
            <Field editing={editing} form={form} setForm={setForm} label="Lotação" value={colaborador.lotacao} formKey="lotacao" />
            <Field editing={editing} form={form} setForm={setForm} label="Regime" value={REGIME_LABELS[colaborador.regime]} formKey="regime" />
            <Field editing={editing} form={form} setForm={setForm} label="Situação" value={SITUACAO_LABELS[colaborador.situacao]} formKey="situacao" />
            <Field editing={editing} form={form} setForm={setForm} label="Data de Admissão" value={colaborador.data_admissao || null} displayValue={formatDateBR(colaborador.data_admissao)} formKey="data_admissao" />
          </div>
        </div>
        {/* Identificação */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <User size={14} /> Identificação
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field editing={editing} form={form} setForm={setForm} label="CPF" value={canViewSensitive ? colaborador.cpf : (colaborador.cpf ? '*** oculto ***' : null)} formKey="cpf" />
            <Field editing={editing} form={form} setForm={setForm} label="Matrícula" value={colaborador.matricula} formKey="matricula" />
            <Field editing={editing} form={form} setForm={setForm} label="Sexo" value={SEXO_LABELS[colaborador.sexo]} formKey="sexo" />
            <Field editing={editing} form={form} setForm={setForm} label="Data de Nascimento" value={colaborador.data_nascimento} displayValue={formatDateBR(colaborador.data_nascimento)} formKey="data_nascimento" />
          </div>
        </div>
      </div>

      {/* Contatos Institucionais */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Mail size={14} /> Contatos Institucionais
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Field editing={editing} form={form} setForm={setForm} label="E-mail Institucional" value={colaborador.email_institucional} formKey="email_institucional" />
          <Field editing={editing} form={form} setForm={setForm} label="Telefone Institucional" value={colaborador.telefone_institucional} formKey="telefone_institucional" />
          <Field editing={editing} form={form} setForm={setForm} label="Ramal" value={colaborador.ramal} formKey="ramal" />
        </div>
      </div>

      {/* Contatos Pessoais (LGPD) */}
      {canViewSensitive && (
        <div style={{ ...cardStyle, border: '1px solid rgba(245,158,11,0.3)' }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={14} /> Dados Pessoais (restrito)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <Field editing={editing} form={form} setForm={setForm} label="E-mail Pessoal" value={colaborador.email_pessoal} formKey="email_pessoal" />
            <Field editing={editing} form={form} setForm={setForm} label="Celular" value={colaborador.celular} formKey="celular" />
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr', gap: 12 }}>
              <Field editing={editing} form={form} setForm={setForm} label="Logradouro" value={colaborador.logradouro} formKey="logradouro" />
              <Field editing={editing} form={form} setForm={setForm} label="Número" value={colaborador.numero} formKey="numero" />
              <Field editing={editing} form={form} setForm={setForm} label="Complemento" value={colaborador.complemento} formKey="complemento" />
              <Field editing={editing} form={form} setForm={setForm} label="Bairro" value={colaborador.bairro} formKey="bairro" />
              <Field editing={editing} form={form} setForm={setForm} label="Cidade" value={colaborador.cidade} formKey="cidade" />
              <Field editing={editing} form={form} setForm={setForm} label="UF" value={colaborador.uf} formKey="uf" />
              <Field editing={editing} form={form} setForm={setForm} label="CEP" value={colaborador.cep} formKey="cep" />
            </div>
          </div>
        </div>
      )}

      {/* Vinculação com Usuário */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Link size={14} /> Vinculação com Usuário
        </h3>
        {colaborador.user_id ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, color: '#f1f5f9' }}>
                Vinculado a: <strong>{linkedUser?.name || colaborador.user_id}</strong>
              </p>
              {linkedUser?.email && (
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>{linkedUser.email}</p>
              )}
            </div>
            {canManage && (
              <button onClick={handleDesvincular}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                <Unlink size={12} /> Desvincular
              </button>
            )}
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 12px' }}>Nenhum usuário vinculado</p>
            {canManage && (
              showVincular ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
                    style={{ ...baseInputStyle, flex: 1 }}>
                    <option value="">Selecione um usuário...</option>
                    {usersDisponiveis.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                  <button onClick={handleVincular} disabled={!selectedUserId}
                    style={{ padding: '8px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', opacity: selectedUserId ? 1 : 0.5 }}>
                    Vincular
                  </button>
                  <button onClick={() => setShowVincular(false)}
                    style={{ padding: '8px', background: 'transparent', color: '#94a3b8', border: 'none', cursor: 'pointer' }}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button onClick={openVincular}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#334155', color: '#f1f5f9', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                  <Link size={12} /> Vincular a Usuário
                </button>
              )
            )}
          </div>
        )}
      </div>

      {/* Processos Associados */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileText size={14} /> Processos Associados ({processos.length})
        </h3>
        {processos.length === 0 ? (
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Nenhum processo associado</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {processos.map(p => (
              <div key={p.id} onClick={() => router.push(`/pmo-dashboard/processos/${p.id}`)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: 'rgba(30,41,59,0.5)', borderRadius: 8, cursor: 'pointer',
                  border: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{p.id_processo || p.id.slice(0, 8)}</span>
                  {p.objeto_resumido && <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>{p.objeto_resumido}</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#64748b' }}>
                  {p.modalidades?.nome && <span>{p.modalidades.nome}</span>}
                  {p.status_processo?.nome && <span>{p.status_processo.nome}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Anotações Relacionadas */}
      <RelatedNotes colaboradorId={id} />
    </div>
  )
}
