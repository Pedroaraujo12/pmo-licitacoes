'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createTemplate } from '@/lib/documentos'
import { TIPO_DOCUMENTO_LABELS, CATEGORIA_LABELS } from '@/types/documentos'

export default function NovoModeloPage() {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    title: '',
    tipo_documento: 'edital',
    categoria: 'licitacoes',
    base_legal: '',
    sei_link: '',
    descricao: '',
    conteudo: '',
    tags: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { setError('Título é obrigatório'); return }
    if (!form.conteudo.trim()) { setError('Conteúdo do modelo é obrigatório'); return }
    setSaving(true)
    setError('')
    try {
      const data = await createTemplate(supabase, {
        ...form,
        base_legal: form.base_legal || undefined,
        sei_link: form.sei_link || undefined,
        descricao: form.descricao || undefined,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
      })
      router.push(`/pmo-dashboard/documentos/detalhe?id=${data.id}`)
    } catch (err) {
      setError((err as Error).message || 'Erro ao criar modelo')
    } finally { setSaving(false) }
  }

  const baseInput = {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    fontSize: 13,
    background: 'rgba(30,41,59,0.5)',
    color: '#cbd5e1',
    outline: 'none',
  } as const

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: '0 0 24px' }}>Novo Modelo de Documento</h1>

      <form onSubmit={handleSubmit} style={{ background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', padding: 24 }}>
        {error && (
          <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.15)', color: '#fca5a5', borderRadius: 8, fontSize: 13, marginBottom: 16, border: '1px solid rgba(239,68,68,0.3)' }}>{error}</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Título do Modelo *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={baseInput} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tipo de Documento *</label>
            <select value={form.tipo_documento} onChange={e => setForm(f => ({ ...f, tipo_documento: e.target.value }))} style={{ ...baseInput, cursor: 'pointer' }}>
              {Object.entries(TIPO_DOCUMENTO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Categoria</label>
            <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} style={{ ...baseInput, cursor: 'pointer' }}>
              {Object.entries(CATEGORIA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Base Legal</label>
            <input value={form.base_legal} onChange={e => setForm(f => ({ ...f, base_legal: e.target.value }))} placeholder="ex: Lei 14.133/2021, art. 75" style={baseInput} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Link SEI</label>
            <input value={form.sei_link} onChange={e => setForm(f => ({ ...f, sei_link: e.target.value }))} placeholder="https://sei.agsus..." style={baseInput} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tags (separadas por vírgula)</label>
            <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="pregão eletrônico, registro de preços, serviço contínuo" style={baseInput} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Descrição Orientativa</label>
            <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={3}
              placeholder="Quando usar este modelo, observações, anexos obrigatórios..." style={{ ...baseInput, resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Conteúdo do Modelo *</label>
            <span style={{ fontSize: 11, color: '#64748b' }}>Use [[PLACEHOLDER]] para campos variáveis</span>
          </div>
          <textarea value={form.conteudo} onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))} rows={20}
            placeholder={`EDITAL DE PREGÃO ELETRÔNICO Nº [[NUMERO_PROCESSO]]/[[ANO_PROCESSO]]

A [[COORDENACAO]], por intermédio do Pregoeiro, torna público que realizará licitação na modalidade PREGÃO ELETRÔNICO, do tipo menor preço, sob o regime de execução indireta, do tipo empreitada por preço global.

OBJETO: [[OBJETO]]

VALOR ESTIMADO: [[VALOR_ESTIMADO]]

...`}
            style={{ ...baseInput, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }} />
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => router.back()}
            style={{ padding: '10px 18px', background: '#334155', color: '#f1f5f9', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button type="submit" disabled={saving}
            style={{ padding: '10px 18px', background: saving ? '#60a5fa' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Salvando...' : 'Criar Modelo'}
          </button>
        </div>
      </form>
    </div>
  )
}
