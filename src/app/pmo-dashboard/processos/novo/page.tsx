'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Coordenacao, Modalidade, Demandante, Responsavel, StatusProcesso } from '@/types/database'
import { useIsMobile } from '@/hooks/useIsMobile'
import { cleanNum, upsertSeiLink } from '@/lib/utils'
import { PT_BR } from '@/lib/pt-br'

export default function NovoProcessoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
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
    Promise.all([
      getSupabase().from('coordenacoes').select('*').limit(100),
      getSupabase().from('modalidades').select('*').limit(100),
      getSupabase().from('demandantes').select('*').limit(100),
      getSupabase().from('responsaveis').select('*').limit(100),
      getSupabase().from('status_processo').select('*').limit(100),
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

  function handleIdInput(e: React.FormEvent<HTMLInputElement>) {
    const raw = (e.target as HTMLInputElement).value
    const cleaned = raw.replace(/[^A-Za-z0-9./\-]/g, '')
    const match = cleaned.match(/^([A-Za-z]+\.)?(\d{0,6})(\/?)(\d{0,4})(-?)(\d{0,2})/)
    if (match) {
      const parts = [
        match[1] || '',
        match[2],
        match[3] && match[2].length === 6 ? '/' : '',
        match[4],
        match[5] && match[4].length === 4 ? '-' : '',
        match[6],
      ]
      ;(e.target as HTMLInputElement).value = parts.join('')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const form = e.currentTarget as HTMLFormElement
      const fd = new FormData(form)
      const idProc = (fd.get('id_processo') as string || '').trim()

      if (!fd.get('responsavel_id')) {
        setError('Responsável é obrigatório.')
        setLoading(false)
        return
      }

      if (idProc && !/^AGSUS\.\d{6}\/\d{4}-\d{2}$/.test(idProc)) {
        setError('ID Processo deve seguir o formato AGSUS.000000/2026-00 (6 dígitos + ano + 2 dígitos)')
        setLoading(false)
        return
      }

      const payload: Record<string, unknown> = {}

      for (const [key, value] of fd.entries()) {
        const str = value as string
        if (!str) continue
        if (key === 'link_sei') continue
        if (['valor_estimado', 'valor_homologado'].includes(key)) {
          payload[key] = cleanNum(str)
        } else if (['qtd_itens', 'progresso'].includes(key)) {
          payload[key] = Number(str)
        } else if (['data_entrada', 'data_atividade', 'data_entrega'].includes(key)) {
          payload[key] = str || null
        } else {
          payload[key] = str
        }
      }

      const estimado = cleanNum(fd.get('valor_estimado'))
      const homologado = cleanNum(fd.get('valor_homologado'))
      payload.despesa_evitada = estimado - homologado

      const { data: { user } } = await getSupabase().auth.getUser()
      if (user) payload.created_by = user.id

      const { data: inserted, error: err } = await getSupabase().from('processos').insert(payload).select('id')
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }

      const linkSei = fd.get('link_sei') as string
      if (linkSei?.trim() && inserted?.[0]?.id) {
        await upsertSeiLink(getSupabase(), inserted[0].id, linkSei.trim())
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
        <textarea name={name} defaultValue="" rows={3} required style={{ ...baseInput, resize: 'vertical' }} />
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

      <form ref={formRef} onSubmit={handleSubmit} style={{ background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', padding: isMobile ? 16 : 24 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 16, marginBottom: 24,
        }}>
          {renderInput('data_entrada', 'Data de Entrada', 'date', new Date().toISOString().split('T')[0])}
          {renderSelect('coordenacao_id', 'Coordenação', coordenacoes)}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ID Processo</label>
            <input
              type="text"
              name="id_processo"
              placeholder="AGSUS.000000/2026-00"
              onInput={handleIdInput}
              style={{ ...baseInput, fontFamily: 'monospace' }}
            />
          </div>
          {renderSelect('status_id', 'Status', statusList)}
          {renderInput('qtd_itens', 'Qtd Itens', 'number')}
          {renderSelect('responsavel_id', 'Responsável', responsaveis)}
          {renderSelect('demandante_id', 'Demandante', demandantes)}
          {renderSelect('modalidade_id', 'Modalidade', modalidades)}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prioridade</label>
            <select name="prioridade" defaultValue="" style={{ ...baseInput, cursor: 'pointer' }}>
              <option value="">Selecione...</option>
              <option value="Baixa">Baixa</option>
              <option value="Média">Média</option>
              <option value="Alta">Alta</option>
              <option value="Urgente">Urgente</option>
            </select>
          </div>
          {renderInput('data_atividade', 'Data Atividade', 'date')}
          {renderInput('progresso', 'Progresso (%)', 'number')}
          {renderInput('data_entrega', 'Data Entrega', 'date')}
          {renderInput('valor_estimado', 'Valor Estimado (R$)', 'text')}
          {renderInput('valor_homologado', 'Valor Homologado (R$)', 'text')}
        </div>
        <div style={{ marginBottom: 24 }}>
          {renderTextarea('objeto_resumido', 'Objeto Resumido')}
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Atividade Atual</label>
          <select name="atividade_atual" defaultValue="" style={{ ...baseInput, cursor: 'pointer' }}>
            <option value="">Selecione...</option>
            {atividadesAtuais.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 24 }}>
          {renderTextarea('observacoes', 'Observações')}
        </div>
        <div style={{ marginBottom: 24 }}>
          {renderInput('drive', PT_BR.googleDrive)}
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>{PT_BR.googleDrive}</p>
        </div>
        <div style={{ marginBottom: 24 }}>
          {renderInput('link_sei', 'Link SEI (Processo Administrativo)')}
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>Link para o processo no SEI (Sistema Eletrônico de Informações)</p>
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
