'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Coordenacao, Modalidade, Demandante, Responsavel, StatusProcesso } from '@/types/database'

export default function NovoProcessoPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [coordenacoes, setCoordenacoes] = useState<Coordenacao[]>([])
  const [modalidades, setModalidades] = useState<Modalidade[]>([])
  const [demandantes, setDemandantes] = useState<Demandante[]>([])
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([])
  const [statusList, setStatusList] = useState<StatusProcesso[]>([])

  const [form, setForm] = useState({
    data_entrada: '',
    coordenacao_id: '',
    drive: '',
    status_id: '',
    id_processo: '',
    qtd_itens: '',
    responsavel_id: '',
    objeto_resumido: '',
    demandante_id: '',
    modalidade_id: '',
    prioridade: '',
    atividade_atual: '',
    data_atividade: '',
    progresso: '',
    data_entrega: '',
    houve_recurso: '',
    valor_estimado: '',
    valor_homologado: '',
    despesa_evitada: '',
    observacoes: '',
  })

  useEffect(() => {
    Promise.all([
      supabase.from('coordenacoes').select('*'),
      supabase.from('modalidades').select('*'),
      supabase.from('demandantes').select('*'),
      supabase.from('responsaveis').select('*'),
      supabase.from('status_processo').select('*'),
    ]).then(([c, m, d, r, s]) => {
      if (c.data) setCoordenacoes(c.data)
      if (m.data) setModalidades(m.data)
      if (d.data) setDemandantes(d.data)
      if (r.data) setResponsaveis(r.data)
      if (s.data) setStatusList(s.data)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const payload: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(form)) {
      if (value === '') continue
      if (['qtd_itens', 'progresso', 'valor_estimado', 'valor_homologado', 'despesa_evitada'].includes(key)) {
        payload[key] = Number(value)
      } else if (['data_entrada', 'data_atividade', 'data_entrega'].includes(key)) {
        payload[key] = value || null
      } else {
        payload[key] = value
      }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) payload.created_by = user.id

    const { error: err } = await supabase.from('processos').insert(payload)
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    router.push('/pmo-dashboard')
    router.refresh()
  }

  function Field({ label, name, type = 'text', options }: {
    label: string; name: string; type?: string; options?: { id: string; nome: string }[]
  }) {
    const value = form[name as keyof typeof form]
    return (
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 }}>{label}</label>
        {options ? (
          <select
            value={value}
            onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, background: '#fff' }}
          >
            <option value="">Selecione...</option>
            {options.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        ) : type === 'textarea' ? (
          <textarea
            value={value}
            onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
            rows={3}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, resize: 'vertical' }}
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}
          />
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>Novo Processo</h1>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>Preencha os dados do processo licitatório</p>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <Field label="Data de Entrada" name="data_entrada" type="date" />
          <Field label="Coordenação" name="coordenacao_id" options={coordenacoes} />
          <Field label="ID Processo" name="id_processo" />
          <Field label="Status" name="status_id" options={statusList} />
          <Field label="Qtd Itens" name="qtd_itens" type="number" />
          <Field label="Responsável" name="responsavel_id" options={responsaveis} />
          <Field label="Demandante" name="demandante_id" options={demandantes} />
          <Field label="Modalidade" name="modalidade_id" options={modalidades} />
          <Field label="Prioridade" name="prioridade" />
          <Field label="Data Atividade" name="data_atividade" type="date" />
          <Field label="Progresso (%)" name="progresso" type="number" />
          <Field label="Data Entrega" name="data_entrega" type="date" />
          <Field label="Valor Estimado (R$)" name="valor_estimado" type="number" />
          <Field label="Valor Homologado (R$)" name="valor_homologado" type="number" />
          <Field label="Despesa Evitada (R$)" name="despesa_evitada" type="number" />
          <Field label="Houve Recurso?" name="houve_recurso" />
        </div>
        <div style={{ marginBottom: 24 }}>
          <Field label="Objeto Resumido" name="objeto_resumido" type="textarea" />
        </div>
        <div style={{ marginBottom: 24 }}>
          <Field label="Atividade Atual" name="atividade_atual" type="textarea" />
        </div>
        <div style={{ marginBottom: 24 }}>
          <Field label="Observações" name="observacoes" type="textarea" />
        </div>
        <div style={{ marginBottom: 24 }}>
          <Field label="Drive" name="drive" />
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{ padding: '10px 20px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '10px 20px',
              background: loading ? '#93c5fd' : '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Salvando...' : 'Salvar Processo'}
          </button>
        </div>
      </form>
    </div>
  )
}
