'use client'

import { useEffect, useState, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Coordenacao, Modalidade, Demandante, Responsavel, StatusProcesso } from '@/types/database'
import { useIsMobile } from '@/hooks/useIsMobile'
import { cleanNum, formatBRL, upsertSeiLink, fetchSeiLink } from '@/lib/utils'
import { PT_BR } from '@/lib/pt-br'

export default function EditProcessoClient({ params, idOverride }: { params?: Promise<{ id: string }>; idOverride?: string }) {
  const paramsId = idOverride ?? (params ? use(params).id : '')
  const id = paramsId
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const isMobile = useIsMobile()

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

  const atividadesAtuais = [
    'Análise do Termo de Referência e anexos',
    'Pesquisa de Preços e levantamento do custo estimado da Contratação',
    'Relatório de Pesquisa Preços',
    'Disponibilidade orçamentária',
    'Designação da Comissão de Seleção',
    'Elaboração Da Minuta de Edital e Anexos. Envio à UJUR/AGSUS',
    'Análise jurídica e Emissão de Parecer',
    'Adequações e atendimento ao Parecer Jurídico quanto aos aspectos técnicos do Edital e Anexos e Autorização de Governança publicação do Edital',
    'Publicação do Edital (prazos legais: 3 dias úteis - Cotação de Preços,  8 dias úteis - Pregão bens e materiais, 10 dias úteis - Pregão serviços e 15 dias úteis concorrência)',
    'Abertura e Fase de Lances',
    'Fase de Julgamento das Propostas, Aceitação e Habilitação',
    'Envio da proposta e documentação de qualificação técnica para análise da área demandante',
    'Resposta da Área demandante',
    'Prazo recursal (3 DIAS ÚTEIS)',
    'Prazo contrarrazões (3 DIAS ÚTEIS)',
    'Decisão quanto ao recurso (5 dias úteis)',
    'Envio do Recurso ao Jurídico e Ratificação autoridade competente da decisão do pregoeiro',
  ]

  useEffect(() => {
    async function load() {
      try {
        const [proc, c, m, d, r, s] = await Promise.all([
          getSupabase().from('processos').select('*').eq('id', id).single(),
          getSupabase().from('coordenacoes').select('*').limit(100),
          getSupabase().from('modalidades').select('*').limit(100),
          getSupabase().from('demandantes').select('*').limit(100),
          getSupabase().from('responsaveis').select('*').limit(100),
          getSupabase().from('status_processo').select('*').limit(100),
        ])

        if (c.data) setCoordenacoes(c.data)
        if (m.data) setModalidades(m.data)
        if (d.data) setDemandantes(d.data)
        if (r.data) setResponsaveis(r.data)
        if (s.data) setStatusList(s.data)

        if (proc.data) {
          const f: Record<string, string> = {}
          for (const [key, value] of Object.entries(proc.data)) {
            f[key] = value === null || value === undefined
              ? ''
              : ['valor_estimado', 'valor_homologado'].includes(key)
                ? formatBRL(value)
                : String(value)
          }
          const sei = await fetchSeiLink(getSupabase(), id)
          if (sei) f.link_sei = sei
          setForm(f)
        } else if (typeof window !== 'undefined') {
          setNotFound(true)
          setError('Processo não encontrado.')
        } else {
          setNotFound(true)
          setError('Processo não encontrado.')
        }
      } catch (err: unknown) {
        console.error('Erro ao carregar processo:', err)
        setError('Erro de conexão ao carregar dados.')
      }
    }
    load()
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!form.responsavel_id) {
      setError('Responsável é obrigatório.')
      setLoading(false)
      return
    }

    const payload: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(form)) {
      if (['id', 'created_by', 'created_at', 'updated_at', 'link_sei'].includes(key)) continue
      if (value === '') {
        payload[key] = null
        continue
      }
      if (['valor_estimado', 'valor_homologado'].includes(key)) {
        payload[key] = cleanNum(value)
      } else if (['qtd_itens', 'progresso'].includes(key)) {
        payload[key] = Number(value)
      } else if (['data_entrada', 'data_atividade', 'data_entrega'].includes(key)) {
        payload[key] = value || null
      } else {
        payload[key] = value
      }
    }

    // Auto-compute despesa_evitada
    const estimado = cleanNum(form.valor_estimado)
    const homologado = cleanNum(form.valor_homologado)
    payload.despesa_evitada = estimado - homologado

    const { error: err } = await getSupabase().from('processos').update(payload).eq('id', id)
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    if (form.link_sei?.trim()) {
      await upsertSeiLink(getSupabase(), id, form.link_sei.trim())
    } else {
      await upsertSeiLink(getSupabase(), id, null)
    }

    router.push(`/pmo-dashboard/processos/detalhe?id=${id}`)
    router.refresh()
  }

  const fields = [
    { label: 'Data de Entrada', name: 'data_entrada', type: 'date' },
    { label: 'Coordenação', name: 'coordenacao_id', options: coordenacoes },
    { label: 'ID Processo', name: 'id_processo', type: 'text' },
    { label: 'Status', name: 'status_id', options: statusList },
    { label: 'Qtd Itens', name: 'qtd_itens', type: 'number' },
    { label: 'Responsável', name: 'responsavel_id', options: responsaveis },
    { label: 'Demandante', name: 'demandante_id', options: demandantes },
    { label: 'Modalidade', name: 'modalidade_id', options: modalidades },
    { label: 'Prioridade', name: 'prioridade', type: 'select', options: [
      { id: 'Baixa', nome: 'Baixa' },
      { id: 'Média', nome: 'Média' },
      { id: 'Alta', nome: 'Alta' },
      { id: 'Urgente', nome: 'Urgente' },
    ] },
    { label: 'Data Atividade', name: 'data_atividade', type: 'date' },
    { label: 'Progresso (%)', name: 'progresso', type: 'number' },
    { label: 'Data Entrega', name: 'data_entrega', type: 'date' },
    { label: 'Valor Estimado (R$)', name: 'valor_estimado', type: 'text' },
    { label: 'Valor Homologado (R$)', name: 'valor_homologado', type: 'text' },
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

  function handleIdInput(e: React.FormEvent<HTMLInputElement>) {
    const raw = e.currentTarget.value.replace(/[^0-9A-Za-z\/\-\.]/g, '').toUpperCase()
    const m = raw.match(/^(AGSUS\.?)?(\d{0,6})?(\/?)(\d{0,4})?(\-?)(\d{0,2})?/)
    if (!m) return
    let v = 'AGSUS.'
    if (m[2]) v += m[2].padEnd(6, '0').slice(0, 6)
    if (m[4]) v += '/' + m[4].padEnd(4, '0').slice(0, 4) + (m[6] ? '-' + m[6].padEnd(2, '0').slice(0, 2) : m[5] ? '-' : '')
    else if (m[3]) v += '/'
    else if (raw.length <= 6) v = 'AGSUS.' + raw
    setForm(fm => ({ ...fm, id_processo: v }))
  }

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

      <form onSubmit={handleSubmit} style={{ background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', padding: isMobile ? 16 : 24 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 16, marginBottom: 24,
        }}>
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
                  onInput={f.name === 'id_processo' ? handleIdInput : undefined}
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
          <select
            value={form.atividade_atual || ''}
            onChange={e => setForm(fm => ({ ...fm, atividade_atual: e.target.value }))}
            style={{ ...baseInput, cursor: 'pointer' }}
          >
            <option value="">Selecione...</option>
            {atividadesAtuais.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Observações</label>
          <textarea
            name="observacoes"
            aria-label="Observações"
            value={form.observacoes || ''}
            onChange={e => setForm(fm => ({ ...fm, observacoes: e.target.value }))}
            rows={4}
            placeholder="Registre observações relevantes do processo"
            style={{ ...baseInput, resize: 'vertical', minHeight: 96 }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{PT_BR.googleDrive}</label>
          <input
            value={form.drive || ''}
            onChange={e => setForm(fm => ({ ...fm, drive: e.target.value }))}
            placeholder="https://drive.google.com/..."
            style={baseInput}
          />
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>{PT_BR.googleDrive}</p>
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Link SEI (Processo Administrativo)</label>
          <input
            value={form.link_sei || ''}
            onChange={e => setForm(fm => ({ ...fm, link_sei: e.target.value }))}
            placeholder="https://sei.agenciasus.org.br/sei/controlador.php?acao=procedimento_trabalhar&id_procedimento=..."
            style={baseInput}
          />
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>Link para o processo no SEI (Sistema Eletrônico de Informações)</p>
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
