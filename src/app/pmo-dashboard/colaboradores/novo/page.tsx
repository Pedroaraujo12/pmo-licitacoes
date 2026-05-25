'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type React from 'react'
import { createClient } from '@/lib/supabase/client'
import { createColaborador } from '@/lib/colaboradores'
import { ArrowLeft, Save } from 'lucide-react'
import { REGIME_LABELS, SITUACAO_LABELS } from '@/types/colaboradores'

const baseInput: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, fontSize: 13, background: 'rgba(30,41,59,0.5)', color: '#cbd5e1', outline: 'none',
}
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4,
}

function Field({ label, formKey, type = 'text', required, form, setForm }: {
  label: string; formKey: string; type?: string; required?: boolean;
  form: Record<string, string>; setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>
}) {
  return (
    <div>
      <label style={labelStyle}>{label}{required && ' *'}</label>
      {type === 'select' ? (
        <select value={form[formKey]} onChange={e => setForm(prev => ({ ...prev, [formKey]: e.target.value }))} style={baseInput}>
          {Object.entries(REGIME_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      ) : type === 'select-situacao' ? (
        <select value={form[formKey]} onChange={e => setForm(prev => ({ ...prev, [formKey]: e.target.value }))} style={baseInput}>
          {Object.entries(SITUACAO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      ) : type === 'select-sexo' ? (
        <select value={form[formKey]} onChange={e => setForm(prev => ({ ...prev, [formKey]: e.target.value }))} style={baseInput}>
          <option value="Nao_informado">Não informado</option>
          <option value="M">Masculino</option>
          <option value="F">Feminino</option>
        </select>
      ) : (
        <input type={type} value={form[formKey]} onChange={e => setForm(prev => ({ ...prev, [formKey]: e.target.value }))}
          placeholder={label} style={baseInput} />
      )}
    </div>
  )
}

export default function NovoColaboradorPage() {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<Record<string, string>>({
    nome_completo: '', cpf: '', matricula: '', sexo: 'Nao_informado', data_nascimento: '',
    cargo: '', funcao: '', unidade: '', lotacao: '', regime: 'efetivo', situacao: 'ativo', data_admissao: '',
    email_institucional: '', telefone_institucional: '', ramal: '',
    email_pessoal: '', celular: '', logradouro: '', numero: '', complemento: '',
    bairro: '', cidade: '', uf: '', cep: '', observacoes: '',
  })

  const sectionStyle: React.CSSProperties = {
    background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
    borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', padding: 24, marginBottom: 16,
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome_completo.trim() || !form.data_nascimento) {
      setError('Nome completo e data de nascimento são obrigatórios')
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
      const colab = await createColaborador(supabase, data as Parameters<typeof createColaborador>[1])
      router.push(`/pmo-dashboard/colaboradores/${colab.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar colaborador')
    }
    finally { setSaving(false) }
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.push('/pmo-dashboard/colaboradores')}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>Novo Colaborador</h1>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={sectionStyle}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase' }}>Identificação</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12 }}>
            <Field label="Nome Completo" formKey="nome_completo" required form={form} setForm={setForm} />
            <Field label="CPF" formKey="cpf" form={form} setForm={setForm} />
            <Field label="Matrícula" formKey="matricula" form={form} setForm={setForm} />
            <Field label="Sexo" formKey="sexo" type="select-sexo" form={form} setForm={setForm} />
            <Field label="Data de Nascimento" formKey="data_nascimento" type="date" required form={form} setForm={setForm} />
          </div>
        </div>

        <div style={sectionStyle}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase' }}>Dados Funcionais</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Field label="Cargo" formKey="cargo" form={form} setForm={setForm} />
            <Field label="Função" formKey="funcao" form={form} setForm={setForm} />
            <Field label="Unidade/Coordenação" formKey="unidade" form={form} setForm={setForm} />
            <Field label="Lotação" formKey="lotacao" form={form} setForm={setForm} />
            <Field label="Regime" formKey="regime" type="select" form={form} setForm={setForm} />
            <Field label="Situação" formKey="situacao" type="select-situacao" form={form} setForm={setForm} />
            <Field label="Data de Admissão" formKey="data_admissao" type="date" form={form} setForm={setForm} />
          </div>
        </div>

        <div style={sectionStyle}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase' }}>Contatos</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
            <Field label="E-mail Institucional" formKey="email_institucional" type="email" form={form} setForm={setForm} />
            <Field label="Telefone Institucional" formKey="telefone_institucional" form={form} setForm={setForm} />
            <Field label="Ramal" formKey="ramal" form={form} setForm={setForm} />
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 16, paddingTop: 16 }}>
            <p style={{ fontSize: 11, color: '#f59e0b', margin: '0 0 12px' }}>Dados pessoais (restritos):</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="E-mail Pessoal" formKey="email_pessoal" type="email" form={form} setForm={setForm} />
              <Field label="Celular" formKey="celular" form={form} setForm={setForm} />
            </div>
          </div>
        </div>

        <div style={sectionStyle}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase' }}>Endereço</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr', gap: 12, marginBottom: 12 }}>
            <Field label="Logradouro" formKey="logradouro" form={form} setForm={setForm} />
            <Field label="Número" formKey="numero" form={form} setForm={setForm} />
            <Field label="Complemento" formKey="complemento" form={form} setForm={setForm} />
            <Field label="Bairro" formKey="bairro" form={form} setForm={setForm} />
            <Field label="Cidade" formKey="cidade" form={form} setForm={setForm} />
            <Field label="UF" formKey="uf" form={form} setForm={setForm} />
            <Field label="CEP" formKey="cep" form={form} setForm={setForm} />
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Observações</label>
            <textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })}
              rows={3} style={{ ...baseInput, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => router.push('/pmo-dashboard/colaboradores')}
            style={{ padding: '10px 20px', background: '#334155', color: '#f1f5f9', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button type="submit" disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            <Save size={14} /> {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  )
}
