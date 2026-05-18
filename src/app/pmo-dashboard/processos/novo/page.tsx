'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Coordenacao, Modalidade, Demandante, Responsavel, StatusProcesso } from '@/types/database'

export default function NovoProcessoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)

  function getSupabase() {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }

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
    observacoes: '',
  })

  useEffect(() => {
    Promise.all([
      getSupabase().from('coordenacoes').select('*'),
      getSupabase().from('modalidades').select('*'),
      getSupabase().from('demandantes').select('*'),
      getSupabase().from('responsaveis').select('*'),
      getSupabase().from('status_processo').select('*'),
    ]).then(([c, m, d, r, s]) => {
      if (c.data) setCoordenacoes(c.data)
      if (m.data) setModalidades(m.data)
      if (d.data) setDemandantes(d.data)
      if (r.data) setResponsaveis(r.data)
      if (s.data) setStatusList(s.data)
    }).catch((err: unknown) => {
      console.error('Erro ao carregar dados do formulário:', err)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const payload: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(form)) {
        if (value === '') continue
        if (['qtd_itens', 'progresso', 'valor_estimado', 'valor_homologado'].includes(key)) {
          payload[key] = Number(value)
        } else if (['data_entrada', 'data_atividade', 'data_entrega'].includes(key)) {
          payload[key] = value || null
        } else {
          payload[key] = value
        }
      }

      const estimado = Number(form.valor_estimado) || 0
      const homologado = Number(form.valor_homologado) || 0
      payload.despesa_evitada = estimado - homologado

      const { data: { user } } = await getSupabase().auth.getUser()
      if (user) payload.created_by = user.id

      const { error: err } = await getSupabase().from('processos').insert(payload)
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }

      router.push('/pmo-dashboard')
      router.refresh()
    } catch (err) {
      setError((err as Error)?.message || 'Erro de conexão ao salvar')
      setLoading(false)
    }
  }

  function Field({ label, name, type = 'text', options }: {
    label: string; name: string; type?: string; options?: { id: string; nome: string }[]
  }) {
    const value = form[name as keyof typeof form]
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
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
        {options ? (
          <select value={value} onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
            style={{ ...baseInput, cursor: 'pointer' }}>
            <option value="">Selecione...</option>
            {options.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        ) : type === 'textarea' ? (
          <textarea value={value} onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
            rows={3} style={{ ...baseInput, resize: 'vertical' }} />
        ) : (
          <input type={type} value={value} onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
            style={baseInput} />
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
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.15)', color: '#fca5a5', borderRadius: 8, fontSize: 13, marginBottom: 16, border: '1px solid rgba(239,68,68,0.3)' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', padding: 24 }}>
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
          <button type="button" onClick={() => router.back()}
            className="bg-slate-700 hover:bg-slate-600 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer border-none">
            Cancelar
          </button>
          <button type="submit" disabled={loading}
            className={`${loading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-500'} text-white px-5 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer border-none disabled:opacity-50`}
            style={{ background: loading ? '#60a5fa' : '#2563eb' }}>
            {loading ? 'Salvando...' : 'Salvar Processo'}
          </button>
        </div>
      </form>
    </div>
  )
}
