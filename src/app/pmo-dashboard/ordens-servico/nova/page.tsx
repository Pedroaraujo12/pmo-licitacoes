'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { listContratos } from '@/lib/contratos'
import { createOrdemServico } from '@/lib/ordens-servico'
import { cleanNum } from '@/lib/utils'
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

export default function NovaOrdemServicoPage() {
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [colaboradores, setColaboradores] = useState<{ id: string; nome: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<Record<string, string>>({
    contrato_id: '',
    numero_os: '',
    objeto: '',
    descricao: '',
    data_emissao: '',
    data_inicio: '',
    data_fim_prevista: '',
    valor: '',
    fiscal_id: '',
    contratada_responsavel: '',
    local_execucao: '',
    observacoes: '',
    percentual_execucao: '0',
    valor_medido: '0',
    valor_pago: '0',
    status: 'rascunho',
  })

  useEffect(() => {
    async function load() {
      const [contratosData, colabsData] = await Promise.all([
        listContratos(supabase, { status: 'vigente', limit: 50 }),
        supabase.from('colaboradores').select('id, nome_completo').order('nome_completo'),
      ])
      setContratos(contratosData)
      if (colabsData.data) {
        setColaboradores(colabsData.data.map((c: { id: string; nome_completo: string }) => ({ id: c.id, nome: c.nome_completo })))
      }
    }
    load()
  }, []) /* eslint-disable-line react-hooks/exhaustive-deps */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.numero_os.trim() || !form.contrato_id) {
      setError('Número da OS e Contrato são obrigatórios')
      return
    }
    setSaving(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload: Record<string, unknown> = {
        contrato_id: form.contrato_id,
        numero_os: form.numero_os.trim(),
        objeto: form.objeto || null,
        descricao: form.descricao || null,
        data_emissao: form.data_emissao || null,
        data_inicio: form.data_inicio || null,
        data_fim_prevista: form.data_fim_prevista || null,
        valor: cleanNum(form.valor),
        valor_medido: cleanNum(form.valor_medido),
        valor_pago: cleanNum(form.valor_pago),
        fiscal_id: form.fiscal_id || null,
        contratada_responsavel: form.contratada_responsavel || null,
        local_execucao: form.local_execucao || null,
        observacoes: form.observacoes || null,
        percentual_execucao: Number(form.percentual_execucao) || 0,
        status: form.status || 'rascunho',
        created_by: user?.id || null,
      }
      const os = await createOrdemServico(supabase, payload as Parameters<typeof createOrdemServico>[1])
      toast('Ordem de serviço criada com sucesso', 'success')
      router.push(`/pmo-dashboard/ordens-servico/detalhe?id=${os!.id}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar ordem de serviço'
      setError(msg)
      toast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  function renderField(label: string, formKey: string, type = 'text') {
    return (
      <div>
        <label style={labelStyle}>{label}</label>
        {type === 'textarea' ? (
          <textarea value={form[formKey] || ''} onChange={e => setForm(f => ({ ...f, [formKey]: e.target.value }))} rows={3} style={{ ...baseInput, resize: 'vertical' }} />
        ) : (
          <input type={type} value={form[formKey] || ''} onChange={e => setForm(f => ({ ...f, [formKey]: e.target.value }))} style={baseInput} />
        )}
      </div>
    )
  }

  const cardStyle: React.CSSProperties = {
    background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
    borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', padding: 24, marginBottom: 16,
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.push('/pmo-dashboard/ordens-servico')}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>Nova Ordem de Serviço</h1>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={cardStyle}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase' }}>Vinculação</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Contrato *</label>
              <select value={form.contrato_id} onChange={e => setForm(f => ({ ...f, contrato_id: e.target.value }))} style={{ ...baseInput, cursor: 'pointer' }}>
                <option value="">Selecione um contrato vigente...</option>
                {contratos.map(c => (
                  <option key={c.id} value={c.id}>{c.numero_contrato} — {c.contratada_nome}</option>
                ))}
              </select>
            </div>
            {renderField('Nº OS *', 'numero_os')}
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase' }}>Descrição</h3>
          {renderField('Objeto', 'objeto', 'textarea')}
          <div style={{ marginTop: 12 }}>
            {renderField('Descrição', 'descricao', 'textarea')}
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase' }}>Datas</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {renderField('Data de Emissão', 'data_emissao', 'date')}
            {renderField('Data de Início', 'data_inicio', 'date')}
            {renderField('Data Prevista de Conclusão', 'data_fim_prevista', 'date')}
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase' }}>Valores</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {renderField('Valor', 'valor')}
            {renderField('% Execução', 'percentual_execucao', 'number')}
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase' }}>Responsáveis</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Fiscal Responsável</label>
              <select value={form.fiscal_id} onChange={e => setForm(f => ({ ...f, fiscal_id: e.target.value }))} style={{ ...baseInput, cursor: 'pointer' }}>
                <option value="">Selecione...</option>
                {colaboradores.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            {renderField('Contratada Responsável', 'contratada_responsavel')}
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase' }}>Local e Observações</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {renderField('Local de Execução', 'local_execucao')}
          </div>
          <div style={{ marginTop: 12 }}>
            {renderField('Observações', 'observacoes', 'textarea')}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => router.push('/pmo-dashboard/ordens-servico')}
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
