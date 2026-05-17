'use client'

import { useEffect, useState, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Coordenacao, Modalidade, Demandante, Responsavel, StatusProcesso } from '@/types/database'

export default function EditProcessoClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)
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

  const [form, setForm] = useState<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      const [proc, c, m, d, r, s] = await Promise.all([
        getSupabase().from('processos').select('*').eq('id', id).single(),
        getSupabase().from('coordenacoes').select('*'),
        getSupabase().from('modalidades').select('*'),
        getSupabase().from('demandantes').select('*'),
        getSupabase().from('responsaveis').select('*'),
        getSupabase().from('status_processo').select('*'),
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
      } else {
        // Check if this is a legacy licitacoes record
        const { data: lic } = await getSupabase().from('licitacoes').select('id').eq('id', id).single()
        if (lic) {
          setNotFound(true)
          setError('Registros legados não podem ser editados pelo novo formulário. Crie um novo processo para este item.')
        } else {
          setNotFound(true)
          setError('Processo não encontrado.')
        }
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
      if (['qtd_itens', 'progresso', 'valor_estimado', 'valor_homologado'].includes(key)) {
        payload[key] = Number(value)
      } else if (['data_entrada', 'data_atividade', 'data_entrega'].includes(key)) {
        payload[key] = value || null
      } else {
        payload[key] = value
      }
    }

    // Auto-compute despesa_evitada
    const estimado = Number(form.valor_estimado) || 0
    const homologado = Number(form.valor_homologado) || 0
    payload.despesa_evitada = estimado - homologado

    const { error: err } = await getSupabase().from('processos').update(payload).eq('id', id)
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
  ]

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

  if (notFound) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center', paddingTop: 60 }}>
        <div style={{ background: 'rgba(239,68,68,0.1)', borderRadius: 20, padding: 40, border: '1px solid rgba(239,68,68,0.2)' }}>
          <p style={{ color: '#fca5a5', fontSize: 16, fontWeight: 600, margin: '0 0 12px' }}>{error}</p>
          <button
            onClick={() => router.push('/pmo-dashboard')}
            className="bg-slate-700 hover:bg-slate-600 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer border-none"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>Editar Processo</h1>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>{form.id_processo}</p>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.15)', color: '#fca5a5', borderRadius: 8, fontSize: 13, marginBottom: 16, border: '1px solid rgba(239,68,68,0.3)' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          {fields.map(f => (
            <div key={f.name}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</label>
              {f.options ? (
                <select
                  value={form[f.name] || ''}
                  onChange={e => setForm(fm => ({ ...fm, [f.name]: e.target.value }))}
                  style={{ ...baseInput, cursor: 'pointer' }}
                >
                  <option value="">Selecione...</option>
                  {f.options.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>
              ) : (
                <input
                  type={f.type || 'text'}
                  value={form[f.name] || ''}
                  onChange={e => setForm(fm => ({ ...fm, [f.name]: e.target.value }))}
                  style={baseInput}
                />
              )}
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Objeto Resumido</label>
          <textarea
            value={form.objeto_resumido || ''}
            onChange={e => setForm(fm => ({ ...fm, objeto_resumido: e.target.value }))}
            rows={3}
            style={{ ...baseInput, resize: 'vertical' }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Atividade Atual</label>
          <textarea
            value={form.atividade_atual || ''}
            onChange={e => setForm(fm => ({ ...fm, atividade_atual: e.target.value }))}
            rows={3}
            style={{ ...baseInput, resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => router.back()}
            className="bg-slate-700 hover:bg-slate-600 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer border-none">
            Cancelar
          </button>
          <button type="submit" disabled={loading}
            className={`${loading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-500'} text-white px-5 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer border-none disabled:opacity-50`}
            style={{ background: loading ? '#60a5fa' : '#2563eb' }}>
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>
    </div>
  )
}
