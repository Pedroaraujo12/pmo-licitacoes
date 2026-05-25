'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getContrato } from '@/lib/contratos'
import { listMedicoes, createMedicao } from '@/lib/contrato-medicoes'
import { formatDateBR, formatBRL } from '@/lib/utils'
import { MEDICAO_STATUS_RECORDS } from '@/types/contratos'
import type { Contrato, ContratoMedicao, MedicaoStatus } from '@/types/contratos'
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

export default function MedicoesClient({ params }: { params: Promise<{ id: string }> }) {
  const paramsId = use(params).id
  const [id, setId] = useState(paramsId)
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()
  const [contrato, setContrato] = useState<Contrato | null>(null)
  const [medicoes, setMedicoes] = useState<ContratoMedicao[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({
    numero_medicao: '', competencia: '', periodo_inicio: '', periodo_fim: '',
    valor_medido: '', percentual_executado: '', status: 'em_elaboracao',
  })

  useEffect(() => {
    async function load() {
      const currentId = id
      if (currentId === 'placeholder') {
        const m = window.location.pathname.match(/\/contratos\/([a-f0-9-]+)\/medicoes/)
        if (m && m[1] !== 'placeholder') {
          setId(m[1])
          return
        }
      }
      const [c, med] = await Promise.all([
        getContrato(supabase, currentId),
        listMedicoes(supabase, { contrato_id: currentId }),
      ])
      setContrato(c)
      setMedicoes(med)
      setLoading(false)
    }
    load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.numero_medicao.trim()) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload = {
        contrato_id: id,
        ordem_servico_id: null,
        numero_medicao: form.numero_medicao.trim(),
        competencia: form.competencia || null,
        periodo_inicio: form.periodo_inicio || null,
        periodo_fim: form.periodo_fim || null,
        valor_medido: Number(form.valor_medido) || 0,
        percentual_executado: Number(form.percentual_executado) || 0,
        status: form.status as MedicaoStatus,
        fiscal_id: null,
        observacoes: null,
        created_by: user?.id || null,
      } as Omit<ContratoMedicao, 'id' | 'created_at'>
      const med = await createMedicao(supabase, payload)
      if (med) setMedicoes(prev => [med, ...prev])
      setShowForm(false)
      setForm({ numero_medicao: '', competencia: '', periodo_inicio: '', periodo_fim: '', valor_medido: '', percentual_executado: '', status: 'em_elaboracao' })
      toast('Medição criada com sucesso', 'success')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Erro ao criar medição', 'error')
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
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>Medições</h1>
          {contrato && (
            <p style={{ color: '#94a3b8', fontSize: 13, margin: '4px 0 0' }}>
              Contrato: {contrato.numero_contrato} — {contrato.contratada_nome}
            </p>
          )}
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={14} /> Nova Medição
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: 0, textTransform: 'uppercase' }}>Nova Medição</h3>
            <button type="button" onClick={() => setShowForm(false)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Nº Medição *</label>
              <input value={form.numero_medicao} onChange={e => setForm(f => ({ ...f, numero_medicao: e.target.value }))} style={baseInput} />
            </div>
            <div>
              <label style={labelStyle}>Competência</label>
              <input value={form.competencia} onChange={e => setForm(f => ({ ...f, competencia: e.target.value }))} placeholder="MM/AAAA" style={baseInput} />
            </div>
            <div>
              <label style={labelStyle}>Período Início</label>
              <input type="date" value={form.periodo_inicio} onChange={e => setForm(f => ({ ...f, periodo_inicio: e.target.value }))} style={baseInput} />
            </div>
            <div>
              <label style={labelStyle}>Período Fim</label>
              <input type="date" value={form.periodo_fim} onChange={e => setForm(f => ({ ...f, periodo_fim: e.target.value }))} style={baseInput} />
            </div>
            <div>
              <label style={labelStyle}>Valor Medido</label>
              <input type="number" value={form.valor_medido} onChange={e => setForm(f => ({ ...f, valor_medido: e.target.value }))} style={baseInput} />
            </div>
            <div>
              <label style={labelStyle}>% Executado</label>
              <input type="number" value={form.percentual_executado} onChange={e => setForm(f => ({ ...f, percentual_executado: e.target.value }))} style={baseInput} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={{ ...baseInput, cursor: 'pointer' }}>
                {Object.entries(MEDICAO_STATUS_RECORDS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="submit" disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              <Save size={14} /> {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      )}

      {medicoes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748b', fontSize: 14 }}>
          Nenhuma medição registrada
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '80px 100px 100px 100px 120px 80px 100px',
            gap: 8, padding: '8px 16px', fontSize: 11, fontWeight: 700, color: '#64748b',
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            <span>Nº</span>
            <span>Competência</span>
            <span>Período Início</span>
            <span>Período Fim</span>
            <span>Valor Medido</span>
            <span>%</span>
            <span>Status</span>
          </div>
          {medicoes.map(m => {
            const statusRec = MEDICAO_STATUS_RECORDS[m.status]
            return (
              <div key={m.id}
                style={{
                  display: 'grid', gridTemplateColumns: '80px 100px 100px 100px 120px 80px 100px',
                  gap: 8, padding: '12px 16px', background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
                  borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', fontSize: 13, alignItems: 'center',
                }}>
                <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{m.numero_medicao}</span>
                <span style={{ color: '#94a3b8' }}>{m.competencia || '-'}</span>
                <span style={{ color: '#94a3b8' }}>{formatDateBR(m.periodo_inicio)}</span>
                <span style={{ color: '#94a3b8' }}>{formatDateBR(m.periodo_fim)}</span>
                <span style={{ color: '#22c55e', fontWeight: 600 }}>{formatBRL(m.valor_medido)}</span>
                <span style={{ color: '#64748b', fontWeight: 600 }}>{m.percentual_executado}%</span>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 6, justifySelf: 'start',
                  background: `${statusRec.bgColor}20`, color: statusRec.color, fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}>{statusRec.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
