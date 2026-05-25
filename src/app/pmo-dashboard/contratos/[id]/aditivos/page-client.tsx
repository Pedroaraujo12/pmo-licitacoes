'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getContrato } from '@/lib/contratos'
import { listAditivos, createAditivo } from '@/lib/contrato-aditivos'
import { formatDateBR, formatBRL } from '@/lib/utils'
import { ADITIVO_TIPO_RECORDS } from '@/types/contratos'
import type { Contrato, ContratoAditivo, AditivoTipo } from '@/types/contratos'
import { ArrowLeft, Plus, Save, X } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

const cardStyle: React.CSSProperties = {
  background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
  borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', padding: 24, marginBottom: 16,
}
const baseInput: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, fontSize: 13, background: 'rgba(30,41,59,0.5)', color: '#cbd5e1', outline: 'none',
}
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4,
}

export default function AditivosClient({ params }: { params: Promise<{ id: string }> }) {
  const paramsId = use(params).id
  const [id, setId] = useState(paramsId)
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()
  const [contrato, setContrato] = useState<Contrato | null>(null)
  const [aditivos, setAditivos] = useState<ContratoAditivo[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({
    numero_aditivo: '', tipo: 'aditivo_prazo', valor_anterior: '', valor_alteracao: '',
    valor_novo: '', data_assinatura: '', data_publicacao: '', justificativa: '',
    status: 'pendente',
  })

  useEffect(() => {
    async function load() {
      const currentId = id
      if (currentId === 'placeholder') {
        const m = window.location.pathname.match(/\/contratos\/([a-f0-9-]+)\/aditivos/)
        if (m && m[1] !== 'placeholder') {
          setId(m[1])
          return
        }
      }
      const [c, ad] = await Promise.all([
        getContrato(supabase, currentId),
        listAditivos(supabase, currentId),
      ])
      setContrato(c)
      setAditivos(ad)
      setLoading(false)
    }
    load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.numero_aditivo.trim()) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload = {
        contrato_id: id,
        numero_aditivo: form.numero_aditivo.trim(),
        tipo: form.tipo as AditivoTipo,
        valor_anterior: Number(form.valor_anterior) || 0,
        valor_alteracao: Number(form.valor_alteracao) || 0,
        valor_novo: Number(form.valor_novo) || 0,
        data_assinatura: form.data_assinatura || null,
        data_publicacao: form.data_publicacao || null,
        justificativa: form.justificativa || null,
        status: form.status,
        created_by: user?.id || null,
      } as Omit<ContratoAditivo, 'id' | 'created_at'>
      const ad = await createAditivo(supabase, payload)
      if (ad) setAditivos(prev => [ad, ...prev])
      setShowForm(false)
      setForm({ numero_aditivo: '', tipo: 'aditivo_prazo', valor_anterior: '', valor_alteracao: '', valor_novo: '', data_assinatura: '', data_publicacao: '', justificativa: '', status: 'pendente' })
      toast('Aditivo criado com sucesso', 'success')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Erro ao criar aditivo', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        {[1, 2].map(i => (
          <div key={i} style={cardStyle}>
            {[1, 2, 3].map(j => (
              <div key={j} style={{ height: 14, background: 'rgba(71,85,105,0.4)', borderRadius: 6, marginBottom: 10, width: `${40 + j * 15}%` }} />
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.push(`/pmo-dashboard/contratos/${id}`)}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>Aditivos</h1>
          {contrato && (
            <p style={{ color: '#94a3b8', fontSize: 13, margin: '4px 0 0' }}>
              Contrato: {contrato.numero_contrato} — {contrato.contratada_nome}
            </p>
          )}
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={14} /> Novo Aditivo
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: 0, textTransform: 'uppercase' }}>Novo Aditivo</h3>
            <button type="button" onClick={() => setShowForm(false)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Nº Aditivo *</label>
              <input value={form.numero_aditivo} onChange={e => setForm(f => ({ ...f, numero_aditivo: e.target.value }))} style={baseInput} />
            </div>
            <div>
              <label style={labelStyle}>Tipo</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} style={{ ...baseInput, cursor: 'pointer' }}>
                {Object.entries(ADITIVO_TIPO_RECORDS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Valor Anterior</label>
              <input type="number" value={form.valor_anterior} onChange={e => setForm(f => ({ ...f, valor_anterior: e.target.value }))} style={baseInput} />
            </div>
            <div>
              <label style={labelStyle}>Valor Alteração</label>
              <input type="number" value={form.valor_alteracao} onChange={e => setForm(f => ({ ...f, valor_alteracao: e.target.value }))} style={baseInput} />
            </div>
            <div>
              <label style={labelStyle}>Valor Novo</label>
              <input type="number" value={form.valor_novo} onChange={e => setForm(f => ({ ...f, valor_novo: e.target.value }))} style={baseInput} />
            </div>
            <div>
              <label style={labelStyle}>Data Assinatura</label>
              <input type="date" value={form.data_assinatura} onChange={e => setForm(f => ({ ...f, data_assinatura: e.target.value }))} style={baseInput} />
            </div>
            <div>
              <label style={labelStyle}>Data Publicação</label>
              <input type="date" value={form.data_publicacao} onChange={e => setForm(f => ({ ...f, data_publicacao: e.target.value }))} style={baseInput} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Justificativa</label>
            <textarea value={form.justificativa} onChange={e => setForm(f => ({ ...f, justificativa: e.target.value }))} rows={3} style={{ ...baseInput, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="submit" disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              <Save size={14} /> {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      )}

      {aditivos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748b', fontSize: 14 }}>
          Nenhum aditivo registrado
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '80px 1fr 120px 120px 120px 100px 100px 80px',
            gap: 8, padding: '8px 16px', fontSize: 11, fontWeight: 700, color: '#64748b',
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            <span>Nº</span>
            <span>Tipo</span>
            <span>Valor Anterior</span>
            <span>Alteração</span>
            <span>Valor Novo</span>
            <span>Assinatura</span>
            <span>Publicação</span>
            <span>Status</span>
          </div>
          {aditivos.map(ad => (
            <div key={ad.id}
              style={{
                display: 'grid', gridTemplateColumns: '80px 1fr 120px 120px 120px 100px 100px 80px',
                gap: 8, padding: '12px 16px', background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
                borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', fontSize: 13, alignItems: 'center',
              }}>
              <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{ad.numero_aditivo}</span>
              <span style={{ color: '#94a3b8' }}>{ADITIVO_TIPO_RECORDS[ad.tipo]?.label || ad.tipo}</span>
              <span style={{ color: '#22c55e', fontWeight: 600 }}>{formatBRL(ad.valor_anterior)}</span>
              <span style={{ color: ad.valor_alteracao >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{formatBRL(ad.valor_alteracao)}</span>
              <span style={{ color: '#22c55e', fontWeight: 600 }}>{formatBRL(ad.valor_novo)}</span>
              <span style={{ color: '#94a3b8' }}>{formatDateBR(ad.data_assinatura)}</span>
              <span style={{ color: '#94a3b8' }}>{formatDateBR(ad.data_publicacao)}</span>
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 6, justifySelf: 'start',
                background: 'rgba(100,116,139,0.2)', color: '#94a3b8', fontWeight: 600,
              }}>{ad.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
