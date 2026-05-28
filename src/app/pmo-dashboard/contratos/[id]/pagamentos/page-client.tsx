'use client'

import { useEffect, useState, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getContrato } from '@/lib/contratos'
import { listPagamentos, createPagamento } from '@/lib/contrato-pagamentos'
import { cleanNum, formatDateBR, formatBRL, parseDateInputBR } from '@/lib/utils'
import { PAGAMENTO_STATUS_RECORDS } from '@/types/contratos'
import type { Contrato, ContratoPagamento, PagamentoStatus } from '@/types/contratos'
import { ArrowLeft, Plus, Save, X } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

const cardStyle: React.CSSProperties = {
  background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
  borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', padding: 24, marginBottom: 16,
}
const baseInput: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, fontSize: 13, background: 'rgba(30,41,59,0.5)', color: '#cbd5e1', outline: 'none',
}
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4,
}

export default function PagamentosClient({ params }: { params: Promise<{ id: string }> }) {
  const paramsId = use(params).id
  const [id, setId] = useState(paramsId)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { toast } = useToast()
  const [contrato, setContrato] = useState<Contrato | null>(null)
  const [pagamentos, setPagamentos] = useState<ContratoPagamento[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({
    numero_nota_fiscal: '', valor: '', data_vencimento: '', data_pagamento: '',
    data_emissao_nf: '', status: 'aguardando_nf',
  })

  useEffect(() => {
    async function load() {
      const currentId = id
      const queryId = searchParams.get('id')
      if (queryId && queryId !== currentId) {
        setId(queryId)
        return
      }
      if (currentId === 'placeholder') {
        const m = window.location.pathname.match(/\/contratos\/([a-f0-9-]+)\/pagamentos/)
        if (m && m[1] !== 'placeholder') {
          setId(m[1])
          return
        }
      }
      const [c, pags] = await Promise.all([
        getContrato(supabase, currentId),
        listPagamentos(supabase, { contrato_id: currentId }),
      ])
      setContrato(c)
      setPagamentos(pags)
      setLoading(false)
    }
    load()
  }, [id, searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.numero_nota_fiscal.trim()) return
    setSaving(true)
    try {
      const dataEmissao = parseDateInputBR(form.data_emissao_nf)
      const dataVencimento = parseDateInputBR(form.data_vencimento)
      const dataPagamento = parseDateInputBR(form.data_pagamento)
      if (form.data_emissao_nf && !dataEmissao) {
        toast('Emissão NF inválida. Use dd/mm/aaaa.', 'error')
        return
      }
      if (form.data_vencimento && !dataVencimento) {
        toast('Vencimento inválido. Use dd/mm/aaaa.', 'error')
        return
      }
      if (form.data_pagamento && !dataPagamento) {
        toast('Data de pagamento inválida. Use dd/mm/aaaa.', 'error')
        return
      }
      const { data: { user } } = await supabase.auth.getUser()
      const payload = {
        contrato_id: id,
        ordem_servico_id: null,
        medicao_id: null,
        numero_nota_fiscal: form.numero_nota_fiscal.trim(),
        valor: cleanNum(form.valor),
        data_emissao_nf: dataEmissao,
        data_vencimento: dataVencimento,
        data_atesto: null,
        data_pagamento: dataPagamento,
        status: form.status as PagamentoStatus,
        observacoes: null,
        created_by: user?.id || null,
      } as Omit<ContratoPagamento, 'id' | 'created_at'>
      const pag = await createPagamento(supabase, payload)
      if (pag) setPagamentos(prev => [pag, ...prev])
      setShowForm(false)
      setForm({ numero_nota_fiscal: '', valor: '', data_vencimento: '', data_pagamento: '', data_emissao_nf: '', status: 'aguardando_nf' })
      toast('Pagamento criado com sucesso', 'success')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Erro ao criar pagamento', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        {[1, 2].map(i => (
          <div key={i} style={cardStyle}>
            {[1, 2, 3].map(j => (
              <div key={j} style={{ height: 14, background: 'rgba(71,85,105,0.4)', borderRadius: 6, marginBottom: 10, width: `${40 + j * 15}%` }} />
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.push(`/pmo-dashboard/contratos/detalhe?id=${id}`)}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>Pagamentos</h1>
          {contrato && (
            <p style={{ color: '#94a3b8', fontSize: 13, margin: '4px 0 0' }}>
              Contrato: {contrato.numero_contrato} — {contrato.contratada_nome}
            </p>
          )}
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={14} /> Novo Pagamento
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: 0, textTransform: 'uppercase' }}>Novo Pagamento</h3>
            <button type="button" onClick={() => setShowForm(false)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Nº NF *</label>
              <input value={form.numero_nota_fiscal} onChange={e => setForm(f => ({ ...f, numero_nota_fiscal: e.target.value }))} style={baseInput} />
            </div>
            <div>
              <label style={labelStyle}>Valor</label>
              <input value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} style={baseInput} />
            </div>
            <div>
              <label style={labelStyle}>Emissão NF</label>
              <input value={form.data_emissao_nf} onChange={e => setForm(f => ({ ...f, data_emissao_nf: e.target.value }))} placeholder="dd/mm/aaaa" style={baseInput} />
            </div>
            <div>
              <label style={labelStyle}>Vencimento</label>
              <input value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} placeholder="dd/mm/aaaa" style={baseInput} />
            </div>
            <div>
              <label style={labelStyle}>Data Pagamento</label>
              <input value={form.data_pagamento} onChange={e => setForm(f => ({ ...f, data_pagamento: e.target.value }))} placeholder="dd/mm/aaaa" style={baseInput} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={{ ...baseInput, cursor: 'pointer' }}>
                {Object.entries(PAGAMENTO_STATUS_RECORDS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="submit" disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              <Save size={14} /> {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      )}

      {pagamentos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748b', fontSize: 14 }}>
          Nenhum pagamento registrado
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '100px 120px 100px 110px 100px',
            gap: 8, padding: '8px 16px', fontSize: 11, fontWeight: 700, color: '#64748b',
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            <span>NF</span>
            <span>Valor</span>
            <span>Vencimento</span>
            <span>Data Pagamento</span>
            <span>Status</span>
          </div>
          {pagamentos.map(p => {
            const statusRec = PAGAMENTO_STATUS_RECORDS[p.status]
            return (
              <div key={p.id}
                style={{
                  display: 'grid', gridTemplateColumns: '100px 120px 100px 110px 100px',
                  gap: 8, padding: '12px 16px', background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
                  borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', fontSize: 13, alignItems: 'center',
                }}>
                <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{p.numero_nota_fiscal}</span>
                <span style={{ color: '#22c55e', fontWeight: 600 }}>{formatBRL(p.valor)}</span>
                <span style={{ color: '#94a3b8' }}>{formatDateBR(p.data_vencimento)}</span>
                <span style={{ color: '#94a3b8' }}>{formatDateBR(p.data_pagamento)}</span>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 6, justifySelf: 'start',
                  background: `${statusRec.bgColor}20`, color: statusRec.color, fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}>{statusRec.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
