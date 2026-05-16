'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { use } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Coordenacao, Modalidade, Demandante, Responsavel, StatusProcesso } from '@/types/database'

export default function EditProcessoClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [coordenacoes, setCoordenacoes] = useState<Coordenacao[]>([])
  const [modalidades, setModalidades] = useState<Modalidade[]>([])
  const [demandantes, setDemandantes] = useState<Demandante[]>([])
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([])
  const [statusList, setStatusList] = useState<StatusProcesso[]>([])

  const [form, setForm] = useState<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      const [proc, c, m, d, r, s] = await Promise.all([
        supabase.from('processos').select('*').eq('id', id).single(),
        supabase.from('coordenacoes').select('*'),
        supabase.from('modalidades').select('*'),
        supabase.from('demandantes').select('*'),
        supabase.from('responsaveis').select('*'),
        supabase.from('status_processo').select('*'),
      ])

      if (c.data) setCoordenacoes(c.data)
      if (m.data) setModalidades(m.data)
      if (d.data) setDemandantes(d.data)
      if (r.data) setResponsaveis(r.data)
      if (s.data) setStatusList(s.data)

      if (proc.data) {
        const f: Record<string, string> = {}
        for (const [key, value] of Object.entries(proc.data)) {
          f[key] = value === null || value === undefined ? '' : String(value)
        }
        setForm(f)
      }
    }
    load()
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const payload: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(form)) {
      if (['id', 'created_by', 'created_at', 'updated_at'].includes(key)) continue
      if (value === '') {
        payload[key] = null
        continue
      }
      if (['qtd_itens', 'progresso', 'valor_estimado', 'valor_homologado', 'despesa_evitada'].includes(key)) {
        payload[key] = Number(value)
      } else if (['data_entrada', 'data_atividade', 'data_entrega'].includes(key)) {
        payload[key] = value || null
      } else {
        payload[key] = value
      }
    }

    const { error: err } = await supabase.from('processos').update(payload).eq('id', id)
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    router.push(`/pmo-dashboard/processos/${id}`)
    router.refresh()
  }

  const fields = [
    { label: 'Data de Entrada', name: 'data_entrada', type: 'date' },
    { label: 'Coordenação', name: 'coordenacao_id', options: coordenacoes },
    { label: 'ID Processo', name: 'id_processo' },
    { label: 'Status', name: 'status_id', options: statusList },
    { label: 'Qtd Itens', name: 'qtd_itens', type: 'number' },
    { label: 'Responsável', name: 'responsavel_id', options: responsaveis },
    { label: 'Demandante', name: 'demandante_id', options: demandantes },
    { label: 'Modalidade', name: 'modalidade_id', options: modalidades },
    { label: 'Prioridade', name: 'prioridade' },
    { label: 'Data Atividade', name: 'data_atividade', type: 'date' },
    { label: 'Progresso (%)', name: 'progresso', type: 'number' },
    { label: 'Data Entrega', name: 'data_entrega', type: 'date' },
    { label: 'Valor Estimado (R$)', name: 'valor_estimado', type: 'number' },
    { label: 'Valor Homologado (R$)', name: 'valor_homologado', type: 'number' },
    { label: 'Despesa Evitada (R$)', name: 'despesa_evitada', type: 'number' },
    { label: 'Houve Recurso?', name: 'houve_recurso' },
  ]

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>Editar Processo</h1>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>{form.id_processo}</p>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          {fields.map(f => (
            <div key={f.name}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 }}>{f.label}</label>
              {f.options ? (
                <select
                  value={form[f.name] || ''}
                  onChange={e => setForm(fm => ({ ...fm, [f.name]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, background: '#fff' }}
                >
                  <option value="">Selecione...</option>
                  {f.options.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>
              ) : (
                <input
                  type={f.type || 'text'}
                  value={form[f.name] || ''}
                  onChange={e => setForm(fm => ({ ...fm, [f.name]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}
                />
              )}
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Objeto Resumido</label>
          <textarea
            value={form.objeto_resumido || ''}
            onChange={e => setForm(fm => ({ ...fm, objeto_resumido: e.target.value }))}
            rows={3}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, resize: 'vertical' }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Atividade Atual</label>
          <textarea
            value={form.atividade_atual || ''}
            onChange={e => setForm(fm => ({ ...fm, atividade_atual: e.target.value }))}
            rows={3}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => router.back()}
            style={{ padding: '10px 20px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button type="submit" disabled={loading}
            style={{
              padding: '10px 20px', background: loading ? '#93c5fd' : '#2563eb', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
            }}>
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>
    </div>
  )
}
