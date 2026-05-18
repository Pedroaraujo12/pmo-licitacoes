'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Coordenacao, Modalidade, Demandante, Responsavel, StatusProcesso } from '@/types/database'

export default function NovoProcessoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
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
      const form = e.currentTarget as HTMLFormElement
      const fd = new FormData(form)
      const payload: Record<string, unknown> = {}

      for (const [key, value] of fd.entries()) {
        const str = value as string
        if (!str) continue
        if (['qtd_itens', 'progresso', 'valor_estimado', 'valor_homologado'].includes(key)) {
          payload[key] = Number(str)
        } else if (['data_entrada', 'data_atividade', 'data_entrega'].includes(key)) {
          payload[key] = str || null
        } else {
          payload[key] = str
        }
      }

      const estimado = Number(fd.get('valor_estimado')) || 0
      const homologado = Number(fd.get('valor_homologado')) || 0
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

  function renderSelect(name: string, label: string, options: { id: string; nome: string }[]) {
    return (
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
        <select name={name} defaultValue="" style={{ ...baseInput, cursor: 'pointer' }}>
          <option value="">Selecione...</option>
          {options.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
      </div>
    )
  }

  function renderInput(name: string, label: string, type = 'text', defaultValue = '') {
    return (
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
        <input type={type} name={name} defaultValue={defaultValue} style={baseInput} />
      </div>
    )
  }

  function renderTextarea(name: string, label: string) {
    return (
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
        <textarea name={name} defaultValue="" rows={3} style={{ ...baseInput, resize: 'vertical' }} />
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

      <form ref={formRef} onSubmit={handleSubmit} style={{ background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          {renderInput('data_entrada', 'Data de Entrada', 'date', new Date().toISOString().split('T')[0])}
          {renderSelect('coordenacao_id', 'Coordenação', coordenacoes)}
          {renderInput('id_processo', 'ID Processo')}
          {renderSelect('status_id', 'Status', statusList)}
          {renderInput('qtd_itens', 'Qtd Itens', 'number')}
          {renderSelect('responsavel_id', 'Responsável', responsaveis)}
          {renderSelect('demandante_id', 'Demandante', demandantes)}
          {renderSelect('modalidade_id', 'Modalidade', modalidades)}
          {renderInput('prioridade', 'Prioridade')}
          {renderInput('data_atividade', 'Data Atividade', 'date')}
          {renderInput('progresso', 'Progresso (%)', 'number')}
          {renderInput('data_entrega', 'Data Entrega', 'date')}
          {renderInput('valor_estimado', 'Valor Estimado (R$)', 'number')}
          {renderInput('valor_homologado', 'Valor Homologado (R$)', 'number')}
        </div>
        <div style={{ marginBottom: 24 }}>
          {renderTextarea('objeto_resumido', 'Objeto Resumido')}
        </div>
        <div style={{ marginBottom: 24 }}>
          {renderTextarea('atividade_atual', 'Atividade Atual')}
        </div>
        <div style={{ marginBottom: 24 }}>
          {renderTextarea('observacoes', 'Observações')}
        </div>
        <div style={{ marginBottom: 24 }}>
          {renderInput('drive', 'Drive')}
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => router.back()}
            className="bg-slate-700 hover:bg-slate-600 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer border-none">
            Cancelar
          </button>
          <button type="submit" disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer border-none disabled:opacity-50"
            style={{ opacity: loading ? 0.5 : 1 }}>
            {loading ? 'Salvando...' : 'Salvar Processo'}
          </button>
        </div>
      </form>
    </div>
  )
}
