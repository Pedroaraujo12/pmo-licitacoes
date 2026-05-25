'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getContrato, updateContrato } from '@/lib/contratos'
import { CONTRATO_STATUS_RECORDS } from '@/types/contratos'
import type { Contrato } from '@/types/contratos'
import { ArrowLeft, Save } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

const baseInput: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, fontSize: 13, background: 'rgba(30,41,59,0.5)', color: '#cbd5e1', outline: 'none',
}
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4,
}
const cardStyle: React.CSSProperties = {
  background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
  borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', padding: 24, marginBottom: 16,
}

export default function EditContratoClient({ params }: { params: Promise<{ id: string }> }) {
  const paramsId = use(params).id
  const [id, setId] = useState(paramsId)
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()
  const [contrato, setContrato] = useState<Contrato | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      const currentId = id
      if (currentId === 'placeholder') {
        const m = window.location.pathname.match(/\/contratos\/([a-f0-9-]+)\/editar/)
        if (m && m[1] !== 'placeholder') {
          setId(m[1])
          return
        }
      }
      const data = await getContrato(supabase, currentId)
      if (data) {
        setContrato(data)
        const f: Record<string, string> = {}
        for (const [key, value] of Object.entries(data)) {
          f[key] = value === null || value === undefined ? '' : String(value)
        }
        setForm(f)
      }
      setLoading(false)
    }
    load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload: Record<string, unknown> = {}
      const skipFields = ['id', 'created_at', 'updated_at', 'created_by', 'processos', 'gestor', 'fiscal_tecnico', 'fiscal_administrativo', 'coordenacoes']
      for (const [key, value] of Object.entries(form)) {
        if (skipFields.includes(key)) continue
        if (value === '') {
          payload[key] = null
          continue
        }
        if (['valor_inicial', 'valor_atual', 'valor_executado', 'valor_pago', 'ano'].includes(key)) {
          payload[key] = Number(value)
        } else if (key === 'permite_renovacao' || key === 'permite_aditivo' || key === 'tem_garantia' || key === 'tem_ordem_servico' || key === 'execucao_continua' || key === 'emergencial') {
          payload[key] = value === 'true'
        } else {
          payload[key] = value
        }
      }
      await updateContrato(supabase, id, payload as Partial<Contrato>)
      toast('Contrato atualizado com sucesso', 'success')
      router.push(`/pmo-dashboard/contratos/${id}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar contrato'
      setError(msg)
      toast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ ...cardStyle }}>
            {[1, 2, 3, 4].map(j => (
              <div key={j} style={{ height: 14, background: 'rgba(71,85,105,0.4)', borderRadius: 6, marginBottom: 10, width: `${40 + j * 15}%` }} />
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (!contrato) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', textAlign: 'center', paddingTop: 60 }}>
        <p style={{ color: '#fca5a5', fontSize: 16 }}>Carregando...</p>
      </div>
    )
  }

  function renderField(label: string, formKey: string, type = 'text', options?: { value: string; label: string }[]) {
    return (
      <div>
        <label style={labelStyle}>{label}</label>
        {options ? (
          <select value={form[formKey] || ''} onChange={e => setForm(f => ({ ...f, [formKey]: e.target.value }))} style={{ ...baseInput, cursor: 'pointer' }}>
            <option value="">Selecione...</option>
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : type === 'textarea' ? (
          <textarea value={form[formKey] || ''} onChange={e => setForm(f => ({ ...f, [formKey]: e.target.value }))} rows={3} style={{ ...baseInput, resize: 'vertical' }} />
        ) : type === 'checkbox' ? (
          <select value={form[formKey] || 'false'} onChange={e => setForm(f => ({ ...f, [formKey]: e.target.value }))} style={{ ...baseInput, cursor: 'pointer' }}>
            <option value="false">Não</option>
            <option value="true">Sim</option>
          </select>
        ) : (
          <input type={type} value={form[formKey] || ''} onChange={e => setForm(f => ({ ...f, [formKey]: e.target.value }))} style={baseInput} />
        )}
      </div>
    )
  }

  const statusOptions = Object.entries(CONTRATO_STATUS_RECORDS).map(([k, v]) => ({ value: k, label: v.label }))

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.push(`/pmo-dashboard/contratos/${id}`)}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>
          Editar Contrato — {contrato.numero_contrato}
        </h1>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={cardStyle}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase' }}>Informações Básicas</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {renderField('Nº Contrato', 'numero_contrato')}
            {renderField('Ano', 'ano', 'number')}
            {renderField('Status', 'status', 'text', statusOptions)}
            {renderField('Contratada', 'contratada_nome')}
            {renderField('CNPJ', 'contratada_cnpj')}
            {renderField('Representante', 'contratada_representante')}
            {renderField('E-mail Contratada', 'contratada_email', 'email')}
            {renderField('Telefone', 'contratada_telefone')}
            {renderField('Categoria', 'categoria')}
            {renderField('Tipo Contratação', 'tipo_contratacao')}
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase' }}>Objeto</h3>
          {renderField('Objeto', 'objeto', 'textarea')}
        </div>

        <div style={cardStyle}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase' }}>Valores</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {renderField('Valor Inicial', 'valor_inicial', 'number')}
            {renderField('Valor Atual', 'valor_atual', 'number')}
            {renderField('Valor Executado', 'valor_executado', 'number')}
            {renderField('Valor Pago', 'valor_pago', 'number')}
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase' }}>Datas</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {renderField('Data Assinatura', 'data_assinatura', 'date')}
            {renderField('Data Publicação', 'data_publicacao', 'date')}
            {renderField('Início Vigência', 'data_inicio_vigencia', 'date')}
            {renderField('Fim Vigência', 'data_fim_vigencia', 'date')}
            {renderField('Limite Renovação', 'data_limite_renovacao', 'date')}
            {renderField('Data Encerramento', 'data_encerramento', 'date')}
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase' }}>Configurações</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {renderField('Permite Renovação', 'permite_renovacao', 'checkbox')}
            {renderField('Permite Aditivo', 'permite_aditivo', 'checkbox')}
            {renderField('Tem Garantia', 'tem_garantia', 'checkbox')}
            {renderField('Tem Ordem de Serviço', 'tem_ordem_servico', 'checkbox')}
            {renderField('Execução Contínua', 'execucao_continua', 'checkbox')}
            {renderField('Emergencial', 'emergencial', 'checkbox')}
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase' }}>Links</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {renderField('Link SEI', 'link_sei')}
            {renderField('Link Drive', 'link_drive')}
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase' }}>Observações</h3>
          {renderField('Observações', 'observacoes', 'textarea')}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => router.push(`/pmo-dashboard/contratos/${id}`)}
            style={{ padding: '10px 20px', background: '#334155', color: '#f1f5f9', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button type="submit" disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            <Save size={14} /> {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  )
}
