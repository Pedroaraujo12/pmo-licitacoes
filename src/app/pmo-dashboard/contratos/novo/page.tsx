'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createContrato } from '@/lib/contratos'
import { cleanNum } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useToast } from '@/components/ui/toast'
import { ArrowLeft, Search } from 'lucide-react'
import Link from 'next/link'

const baseInput: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, fontSize: 13, background: 'rgba(30,41,59,0.5)', color: '#cbd5e1',
  outline: 'none', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8',
  marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em',
}

function RequiredAsterisk() {
  return <span style={{color:'#ef4444',fontSize:11}}> *</span>
}

export default function NovoContratoPage() {
  const router = useRouter()
  const supabase = createClient()
  const isMobile = useIsMobile()
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [processos, setProcessos] = useState<{ id: string; id_processo: string | null }[]>([])
  const [colaboradores, setColaboradores] = useState<{ id: string; nome_completo: string }[]>([])
  const [processoSearch, setProcessoSearch] = useState('')
  const [showProcessoDropdown, setShowProcessoDropdown] = useState(false)

  const [form, setForm] = useState({
    numero_contrato: '',
    ano: new Date().getFullYear().toString(),
    processo_id: '',
    contratada_nome: '',
    contratada_cnpj: '',
    contratada_representante: '',
    contratada_email: '',
    contratada_telefone: '',
    objeto: '',
    categoria: '',
    tipo_contratacao: '',
    data_assinatura: '',
    data_inicio_vigencia: '',
    data_fim_vigencia: '',
    valor_inicial: '',
    valor_atual: '',
    gestor_id: '',
    fiscal_tecnico_id: '',
    fiscal_administrativo_id: '',
    link_sei: '',
    link_drive: '',
    permite_renovacao: false,
    permite_aditivo: false,
    tem_garantia: false,
    emergencial: false,
    observacoes: '',
  })

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const params = new URLSearchParams(window.location.search)
        const processoParam = params.get('processo_id')

        const [procData, colabData] = await Promise.all([
          supabase.from('processos').select('id, id_processo').order('created_at', { ascending: false }).limit(200),
          supabase.from('colaboradores').select('id, nome_completo').order('nome_completo', { ascending: true }).limit(100),
        ])
        const procs = (procData.data || []) as { id: string; id_processo: string | null }[]
        setProcessos(procs)
        setColaboradores((colabData.data || []) as { id: string; nome_completo: string }[])

        if (processoParam) {
          const found = procs.find(p => p.id === processoParam)
          if (found) {
            setForm(prev => ({ ...prev, processo_id: found.id }))
            setProcessoSearch(found.id_processo || found.id)
          } else {
            const { data: singleProc } = await supabase
              .from('processos')
              .select('id, id_processo')
              .eq('id', processoParam)
              .maybeSingle()
            if (singleProc) {
              procs.push(singleProc as { id: string; id_processo: string | null })
              setProcessos([...procs])
              setForm(prev => ({ ...prev, processo_id: singleProc.id }))
              setProcessoSearch((singleProc as { id: string; id_processo: string | null }).id_processo || singleProc.id)
            }
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar tela de novo contrato:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredProcessos = processos.filter(p =>
    p.id_processo?.toLowerCase().includes(processoSearch.toLowerCase())
  )

  const selectedProcesso = processos.find(p => p.id === form.processo_id)

  function setField(field: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.numero_contrato.trim() || !form.contratada_nome.trim()) {
      toast('Preencha os campos obrigatorios: N Contrato e Contratada', 'error')
      return
    }
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      const payload: Record<string, unknown> = {
        numero_contrato: form.numero_contrato.trim(),
        ano: parseInt(form.ano) || new Date().getFullYear(),
        processo_id: form.processo_id || null,
        contratada_nome: form.contratada_nome.trim(),
        contratada_cnpj: form.contratada_cnpj.replace(/\D/g, '') || null,
        contratada_representante: form.contratada_representante || null,
        contratada_email: form.contratada_email || null,
        contratada_telefone: form.contratada_telefone || null,
        objeto: form.objeto || null,
        categoria: form.categoria || null,
        tipo_contratacao: form.tipo_contratacao || null,
        data_assinatura: form.data_assinatura || null,
        data_inicio_vigencia: form.data_inicio_vigencia || null,
        data_fim_vigencia: form.data_fim_vigencia || null,
        valor_inicial: cleanNum(form.valor_inicial),
        valor_atual: cleanNum(form.valor_atual),
        gestor_id: form.gestor_id || null,
        fiscal_tecnico_id: form.fiscal_tecnico_id || null,
        fiscal_administrativo_id: form.fiscal_administrativo_id || null,
        link_sei: form.link_sei || null,
        link_drive: form.link_drive || null,
        permite_renovacao: form.permite_renovacao,
        permite_aditivo: form.permite_aditivo,
        tem_garantia: form.tem_garantia,
        emergencial: form.emergencial,
        observacoes: form.observacoes || null,
        status: 'minuta',
        created_by: user?.id || null,
      }
      const result = await createContrato(supabase, payload as Parameters<typeof createContrato>[1])
      if (result) {
        toast('Contrato criado com sucesso', 'success')
        router.push(`/pmo-dashboard/contratos/detalhe?id=${result.id}`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar contrato'
      if (msg.includes('row-level security') || msg.includes('policy')) {
        toast('Sem permissão para criar contratos. Execute a migration SQL no Supabase Dashboard.', 'error')
      } else {
        toast(msg, 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  function renderInput(field: string, label: string, type = 'text', required = false) {
    return (
      <div>
        <label style={labelStyle}>{label}{required && <RequiredAsterisk />}</label>
        <input type={type} value={form[field as keyof typeof form] as string}
          onChange={e => setField(field, e.target.value)}
          required={required} style={baseInput} />
      </div>
    )
  }

  function renderSelect(field: string, label: string, options: { id: string; nome: string }[], required = false) {
    return (
      <div>
        <label style={labelStyle}>{label}{required && <RequiredAsterisk />}</label>
        <select value={form[field as keyof typeof form] as string}
          onChange={e => setField(field, e.target.value)}
          required={required} style={{ ...baseInput, cursor: 'pointer' }}>
          <option value="">Selecione...</option>
          {options.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
      </div>
    )
  }

  function renderTextarea(field: string, label: string) {
    return (
      <div>
        <label style={labelStyle}>{label}</label>
        <textarea value={form[field as keyof typeof form] as string}
          onChange={e => setField(field, e.target.value)}
          rows={3} style={{ ...baseInput, resize: 'vertical' }} />
      </div>
    )
  }

  function renderCheckbox(field: string, label: string) {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#cbd5e1', cursor: 'pointer' }}>
        <input type="checkbox" checked={form[field as keyof typeof form] as boolean}
          onChange={e => setField(field, e.target.checked)} style={{ accentColor: '#2563eb' }} />
        {label}
      </label>
    )
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href="/pmo-dashboard/contratos" style={{ color: '#94a3b8', display: 'flex', textDecoration: 'none' }}>
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>Novo Contrato</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: '4px 0 0' }}>Preencha os dados do contrato</p>
        </div>
      </div>

      {loading && (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b', fontSize: 14 }}>Carregando dados...</div>
      )}

      {!loading && (
        <form onSubmit={handleSubmit} style={{
          background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
          borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)',
          padding: isMobile ? 16 : 24,
        }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px',
            textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Dados Basicos
          </h3>
          <div style={{
            display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 16, marginBottom: 24,
          }}>
            <div>
              <label style={labelStyle}>N Contrato<RequiredAsterisk /></label>
              <input type="text" value={form.numero_contrato}
                onChange={e => setField('numero_contrato', e.target.value)}
                required placeholder="Ex: 001/2026" style={baseInput} />
            </div>
            {renderInput('ano', 'Ano', 'number')}
            <div style={{ position: 'relative' }}>
              <label style={labelStyle}>Processo Vinculado</label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{
                  position: 'absolute', left: 10, top: 10, color: '#64748b', pointerEvents: 'none'
                }} />
                <input type="text" placeholder="Buscar processo..."
                  value={selectedProcesso
                    ? `${selectedProcesso.id_processo || selectedProcesso.id}`
                    : processoSearch}
                  onChange={e => { setProcessoSearch(e.target.value); setField('processo_id', ''); setShowProcessoDropdown(true) }}
                  onFocus={() => setShowProcessoDropdown(true)}
                  style={{ ...baseInput, paddingLeft: 32, cursor: 'pointer' }} />
                {selectedProcesso && (
                  <button type="button"
                    onClick={() => { setField('processo_id', ''); setProcessoSearch('') }}
                    style={{
                      position: 'absolute', right: 8, top: 8,
                      background: 'none', border: 'none', color: '#64748b',
                      cursor: 'pointer', fontSize: 14,
                    }}>&times;</button>
                )}
              </div>
              {showProcessoDropdown && !selectedProcesso && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                  background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, maxHeight: 200, overflowY: 'auto', marginTop: 4,
                }}>
                  {filteredProcessos.length === 0 ? (
                    <div style={{ padding: 10, fontSize: 12, color: '#64748b' }}>
                      Nenhum processo encontrado
                    </div>
                  ) : (
                    filteredProcessos.slice(0, 20).map(p => (
                      <div key={p.id}
                        onClick={() => { setField('processo_id', p.id); setProcessoSearch(p.id_processo || p.id); setShowProcessoDropdown(false) }}
                        style={{
                          padding: '8px 10px', fontSize: 13, color: '#cbd5e1',
                          cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)'
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        {p.id_processo || p.id.slice(0, 8)}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <h3 style={{
            fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px',
            textTransform: 'uppercase', letterSpacing: '0.05em'
          }}>
            Dados da Contratada
          </h3>
          <div style={{
            display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 16, marginBottom: 24,
          }}>
            {renderInput('contratada_nome', 'Contratada Nome', 'text', true)}
            {renderInput('contratada_cnpj', 'CNPJ')}
            {renderInput('contratada_representante', 'Representante')}
            {renderInput('contratada_email', 'E-mail', 'email')}
            {renderInput('contratada_telefone', 'Telefone')}
          </div>

          <h3 style={{
            fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px',
            textTransform: 'uppercase', letterSpacing: '0.05em'
          }}>
            Objeto e Classificacao
          </h3>
          <div style={{ marginBottom: 16 }}>
            {renderTextarea('objeto', 'Objeto')}
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 16, marginBottom: 24,
          }}>
            {renderInput('categoria', 'Categoria')}
            {renderInput('tipo_contratacao', 'Tipo de Contratacao')}
          </div>

          <h3 style={{
            fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px',
            textTransform: 'uppercase', letterSpacing: '0.05em'
          }}>
            Datas
          </h3>
          <div style={{
            display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
            gap: 16, marginBottom: 24,
          }}>
            {renderInput('data_assinatura', 'Assinatura', 'date')}
            {renderInput('data_inicio_vigencia', 'Inicio Vigencia', 'date')}
            {renderInput('data_fim_vigencia', 'Fim Vigencia', 'date')}
          </div>

          <h3 style={{
            fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px',
            textTransform: 'uppercase', letterSpacing: '0.05em'
          }}>
            Valores
          </h3>
          <div style={{
            display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 16, marginBottom: 24,
          }}>
            {renderInput('valor_inicial', 'Valor Inicial (R$)')}
            {renderInput('valor_atual', 'Valor Atual (R$)')}
          </div>

          <h3 style={{
            fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px',
            textTransform: 'uppercase', letterSpacing: '0.05em'
          }}>
            Gestao e Fiscalizacao
          </h3>
          <div style={{
            display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
            gap: 16, marginBottom: 24,
          }}>
            {renderSelect('gestor_id', 'Gestor do Contrato',
              colaboradores.map(c => ({ id: c.id, nome: c.nome_completo })))}
            {renderSelect('fiscal_tecnico_id', 'Fiscal Tecnico',
              colaboradores.map(c => ({ id: c.id, nome: c.nome_completo })))}
            {renderSelect('fiscal_administrativo_id', 'Fiscal Administrativo',
              colaboradores.map(c => ({ id: c.id, nome: c.nome_completo })))}
          </div>

          <h3 style={{
            fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px',
            textTransform: 'uppercase', letterSpacing: '0.05em'
          }}>
            Links
          </h3>
          <div style={{
            display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 16, marginBottom: 24,
          }}>
            {renderInput('link_sei', 'Link SEI')}
            {renderInput('link_drive', 'Link Drive')}
          </div>

          <h3 style={{
            fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px',
            textTransform: 'uppercase', letterSpacing: '0.05em'
          }}>
            Opcoes
          </h3>
          <div style={{
            display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 12, marginBottom: 24,
          }}>
            {renderCheckbox('permite_renovacao', 'Permite Renovacao')}
            {renderCheckbox('permite_aditivo', 'Permite Aditivo')}
            {renderCheckbox('tem_garantia', 'Tem Garantia')}
            {renderCheckbox('emergencial', 'Contrato Emergencial')}
          </div>

          <div style={{ marginBottom: 24 }}>
            {renderTextarea('observacoes', 'Observacoes')}
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => router.push('/pmo-dashboard/contratos')}
              style={{
                padding: '8px 16px', background: '#334155', color: '#f1f5f9',
                border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
              }}>
              Cancelar
            </button>
            <button type="submit" disabled={submitting}
              style={{
                padding: '8px 16px', background: '#2563eb', color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', opacity: submitting ? 0.6 : 1,
              }}>
              {submitting ? 'Salvando...' : 'Salvar Contrato'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
