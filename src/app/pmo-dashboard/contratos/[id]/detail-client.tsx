'use client'

import { useEffect, useState, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getContrato, computeContratoAlertas, computeSaldoContrato, computeDiasRestantes, computeValoresBreakdown } from '@/lib/contratos'
import { listOrdensServico, listAditivos, listMedicoes, listPagamentos } from '@/lib/ordens-servico'
import { formatDateBR, formatBRL } from '@/lib/utils'
import type { Contrato, OrdemServico, ContratoAditivo, ContratoMedicao, ContratoPagamento, ContratoHistorico, ContratoAlerta, ValoresBreakdown } from '@/types/contratos'
import {
  CONTRATO_STATUS_RECORDS, OS_STATUS_RECORDS, ADITIVO_TIPO_RECORDS,
  MEDICAO_STATUS_RECORDS, PAGAMENTO_STATUS_RECORDS,
} from '@/types/contratos'
import { useIsMobile } from '@/hooks/useIsMobile'
import {
  ArrowLeft, Edit, FileText, Plus, AlertTriangle, Calendar,
  DollarSign, CheckCircle, ExternalLink,
  FileSignature, ClipboardList,
  BarChart3, History, Link as LinkIcon,
} from 'lucide-react'

const cardStyle: React.CSSProperties = {
  background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
  borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)',
  padding: 24, marginBottom: 24,
}

const fieldStyle: React.CSSProperties = {
  background: 'rgba(30,41,59,0.5)', borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.06)', padding: '12px 16px',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.05em',
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={fieldStyle}>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{children}</div>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      style={{
        padding: '8px 16px', fontSize: 12, fontWeight: 600,
        background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
        color: active ? '#60a5fa' : '#64748b',
        border: 'none', borderBottom: active ? '2px solid #60a5fa' : '2px solid transparent',
        cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
      }}>
      {children}
    </button>
  )
}

export default function ContratoDetailClient({ params, idOverride }: { params?: Promise<{ id: string }>; idOverride?: string }) {
  const paramsId = idOverride ?? (params ? use(params).id : '')
  const [id, setId] = useState(paramsId)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const isMobile = useIsMobile()

  const [contrato, setContrato] = useState<Contrato | null>(null)
  const [alertas, setAlertas] = useState<ContratoAlerta[]>([])
  const [saldo, setSaldo] = useState(0)
  const [diasRestantes, setDiasRestantes] = useState(0)
  const [breakdown, setBreakdown] = useState<ValoresBreakdown | null>(null)
  const [loading, setLoading] = useState(true)

  const [ordensServico, setOrdensServico] = useState<OrdemServico[]>([])
  const [aditivos, setAditivos] = useState<ContratoAditivo[]>([])
  const [medicoes, setMedicoes] = useState<ContratoMedicao[]>([])
  const [pagamentos, setPagamentos] = useState<ContratoPagamento[]>([])
  const [historico, setHistorico] = useState<ContratoHistorico[]>([])
  const [profile, setProfile] = useState<{ role: string } | null>(null)

  const [activeTab, setActiveTab] = useState('resumo')

  useEffect(() => {
    async function load() {
      let currentId = id
      const queryId = searchParams.get('id')
      if (queryId && queryId !== currentId) {
        setId(queryId)
        return
      }
      if (currentId === 'placeholder') {
        const m = window.location.pathname.match(/\/contratos\/([a-f0-9-]+)/)
        if (m && m[1] !== 'placeholder') {
          currentId = m[1]
          setId(currentId)
          return
        }
      }

      const c = await getContrato(supabase, currentId)
      if (!c) {
        setLoading(false)
        return
      }
      setContrato(c)
      setAlertas(computeContratoAlertas(c))
      setSaldo(computeSaldoContrato(c))
      setDiasRestantes(computeDiasRestantes(c.data_fim_vigencia))
      setBreakdown(computeValoresBreakdown(c))

      const [os, ad, med, pag, hist] = await Promise.all([
        listOrdensServico(supabase, { contrato_id: currentId, limit: 100 }),
        listAditivos(supabase, currentId, 50),
        listMedicoes(supabase, { contrato_id: currentId, limit: 50 }),
        listPagamentos(supabase, { contrato_id: currentId, limit: 50 }),
        supabase.from('contrato_historico').select('*, profiles(name)')
          .eq('contrato_id', currentId).order('created_at', { ascending: false }).limit(50),
      ])
      setOrdensServico(os)
      setAditivos(ad)
      setMedicoes(med)
      setPagamentos(pag)
      setHistorico((hist.data || []) as ContratoHistorico[])

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        setProfile(p)
      }
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, searchParams])

  if (loading) return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
          borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)',
          padding: isMobile ? 16 : 24, marginBottom: 16,
        }}>
          {[1, 2, 3, 4].map(j => (
            <div key={j} style={{
              height: 14, background: 'rgba(71,85,105,0.4)', borderRadius: 6,
              marginBottom: 10, width: `${40 + j * 15}%`,
            }} />
          ))}
        </div>
      ))}
    </div>
  )

  if (!contrato) return (
    <div style={{ padding: 60, textAlign: 'center', color: '#ef4444', fontSize: 14 }}>
      Contrato não encontrado
    </div>
  )

  const c = contrato as Contrato

  const canEdit = profile?.role && ['admin', 'gestor'].includes(profile.role)
  const isVigente = c.status === 'vigente' || c.status === 'proximo_vencimento'
  const osAbertas = ordensServico.filter(o => !['concluida', 'cancelada'].includes(o.status)).length

  function getDiasRestantesBadge() {
    if (diasRestantes > 30) return { label: `${diasRestantes} dias`, color: '#22c55e', bg: 'rgba(34,197,94,0.15)' }
    if (diasRestantes > 0) return { label: `${diasRestantes} dias`, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' }
    return { label: 'Vencido', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' }
  }

  const drBadge = getDiasRestantesBadge()

  function getStatusBadge(status: keyof typeof CONTRATO_STATUS_RECORDS) {
    const rec = CONTRATO_STATUS_RECORDS[status]
    if (!rec) return null
    return (
      <span style={{
        fontSize: 11, padding: '3px 10px', borderRadius: 8,
        background: `${rec.color}20`, color: rec.color, fontWeight: 600,
      }}>
        {rec.label}
      </span>
    )
  }

  const tabs = [
    { key: 'resumo', label: 'Resumo', icon: <FileText size={13} /> },
    { key: 'ordens', label: 'Ordens de Serviço', icon: <ClipboardList size={13} /> },
    { key: 'aditivos', label: 'Aditivos', icon: <FileSignature size={13} /> },
    { key: 'medicoes', label: 'Medições', icon: <BarChart3 size={13} /> },
    { key: 'pagamentos', label: 'Pagamentos', icon: <DollarSign size={13} /> },
    { key: 'historico', label: 'Histórico', icon: <History size={13} /> },
  ]

  const bd = breakdown
  const summaryCards = [
    { label: 'Valor Original', value: bd ? formatBRL(bd.valorOriginal) : formatBRL(c.valor_atual), color: '#22c55e' },
    { label: '+ Aditivos', value: bd ? formatBRL(bd.totalAditivos) : 'R$ 0,00', color: bd && bd.totalAditivos >= 0 ? '#f59e0b' : '#ef4444' },
    { label: 'Valor Atual', value: formatBRL(c.valor_atual), color: '#22c55e' },
    { label: 'Valor Executado', value: formatBRL(c.valor_executado), color: '#60a5fa' },
    { label: 'Saldo', value: formatBRL(saldo), color: saldo > 0 ? '#22c55e' : '#ef4444' },
    { label: 'OS Abertas', value: osAbertas, color: '#f59e0b' },
  ]

  function renderSummaryCards() {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(6, 1fr)',
        gap: 10, marginBottom: 24,
      }}>
        {summaryCards.map(sc => (
          <div key={sc.label} style={{
            background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
            borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)',
            padding: '14px 16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: sc.color }}>{sc.value}</div>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 500, marginTop: 2 }}>{sc.label}</div>
          </div>
        ))}
      </div>
    )
  }

  function renderAlertas() {
    if (alertas.length === 0) return null
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {alertas.map((a, i) => (
          <div key={i} style={{
            padding: '10px 14px', borderRadius: 10, fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 8,
            background: a.gravidade === 'alto' ? 'rgba(239,68,68,0.12)' : a.gravidade === 'medio' ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.1)',
            border: `1px solid ${a.gravidade === 'alto' ? 'rgba(239,68,68,0.25)' : a.gravidade === 'medio' ? 'rgba(245,158,11,0.25)' : 'rgba(59,130,246,0.2)'}`,
          }}>
            <AlertTriangle size={14} color={a.gravidade === 'alto' ? '#ef4444' : a.gravidade === 'medio' ? '#f59e0b' : '#60a5fa'} />
            <span style={{ flex: 1, color: '#cbd5e1' }}>{a.mensagem}</span>
            {a.acao && <span style={{ fontSize: 11, color: '#60a5fa' }}>{a.acao}</span>}
          </div>
        ))}
      </div>
    )
  }

  // Tab: Resumo
  function renderResumo() {
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <DetailField label="Contratada">{c.contratada_nome}</DetailField>
          <DetailField label="CNPJ">{c.contratada_cnpj || '-'}</DetailField>
          <DetailField label="Representante">{c.contratada_representante || '-'}</DetailField>
          <DetailField label="E-mail">{c.contratada_email || '-'}</DetailField>
          <DetailField label="Telefone">{c.contratada_telefone || '-'}</DetailField>
          <DetailField label="Categoria">{c.categoria || '-'}</DetailField>
          <DetailField label="Tipo de Contratação">{c.tipo_contratacao || '-'}</DetailField>
          <DetailField label="Gestor">{c.gestor?.nome || '-'}</DetailField>
          <DetailField label="Fiscal Técnico">{c.fiscal_tecnico?.nome || '-'}</DetailField>
          <DetailField label="Fiscal Administrativo">{c.fiscal_administrativo?.nome || '-'}</DetailField>
        </div>

        {bd && (bd.totalAcrescimos > 0 || bd.totalSupressoes > 0) && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ ...labelStyle, marginBottom: 12 }}>Breakdown Financeiro</h3>
            <div style={{
              background: 'rgba(30,41,59,0.5)', borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.06)', padding: 16,
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>VALOR ORIGINAL</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#22c55e', marginTop: 2 }}>{formatBRL(bd.valorOriginal)}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>Base do contrato sem aditivos</div>
                </div>
                {bd.totalAcrescimos > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>ACRÉSCIMOS</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#22c55e', marginTop: 2 }}>+ {formatBRL(bd.totalAcrescimos)}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>Aditivos de acréscimo/valor</div>
                  </div>
                )}
                {bd.totalSupressoes > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>SUPRESSÕES</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444', marginTop: 2 }}>- {formatBRL(bd.totalSupressoes)}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>Aditivos de supressão</div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>VALOR ATUAL (calculado)</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#60a5fa', marginTop: 2 }}>{formatBRL(bd.valorAtualCalculado)}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>Original + acréscimos - supressões</div>
                </div>
              </div>
              {c.total_aditivos !== undefined && c.total_aditivos !== null && (
                <div style={{ marginTop: 10, fontSize: 11, color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
                  Total de aditivos: {formatBRL(c.total_aditivos)}
                  {bd.diferenca !== 0 && <span style={{ color: '#f59e0b', marginLeft: 8 }}>(diferença: {formatBRL(bd.diferenca)})</span>}
                </div>
              )}
            </div>
          </div>
        )}

        <h3 style={{ ...labelStyle, marginBottom: 12 }}>Datas</h3>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
          <DetailField label="Assinatura">{formatDateBR(c.data_assinatura)}</DetailField>
          <DetailField label="Publicação">{formatDateBR(c.data_publicacao)}</DetailField>
          <DetailField label="Fim da Vigência">{formatDateBR(c.data_fim_vigencia)}</DetailField>
        </div>

        {c.link_sei && (
          <div style={{ marginBottom: 16 }}>
            <DetailField label="Link SEI">
              <a href={c.link_sei} target="_blank" rel="noopener noreferrer"
                style={{ color: '#60a5fa', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 13 }}>
                <ExternalLink size={14} /> Abrir no SEI
              </a>
            </DetailField>
          </div>
        )}
        {c.link_drive && (
          <div style={{ marginBottom: 16 }}>
            <DetailField label="Link Drive">
              <a href={c.link_drive} target="_blank" rel="noopener noreferrer"
                style={{ color: '#60a5fa', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 13 }}>
                <ExternalLink size={14} /> Abrir Drive
              </a>
            </DetailField>
          </div>
        )}

        {c.objeto && (
          <div style={{ marginBottom: 16 }}>
            <DetailField label="Objeto">{c.objeto}</DetailField>
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          {c.permite_renovacao && <CheckItem label="Permite Renovação" />}
          {c.permite_aditivo && <CheckItem label="Permite Aditivo" />}
          {c.tem_garantia && <CheckItem label="Tem Garantia" />}
          {c.emergencial && <CheckItem label="Contrato Emergencial" />}
        </div>

        {c.observacoes && (
          <DetailField label="Observações">{c.observacoes}</DetailField>
        )}
      </div>
    )
  }

  function CheckItem({ label }: { label: string }) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 12, color: '#22c55e', background: 'rgba(34,197,94,0.1)',
        padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(34,197,94,0.2)',
      }}>
        <CheckCircle size={12} /> {label}
      </span>
    )
  }

  // Tab: Ordens de Serviço
  function renderOrdensServico() {
    if (ordensServico.length === 0) return <EmptyTab message="Nenhuma ordem de serviço registrada." />
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ordensServico.map(os => {
          const statusRec = OS_STATUS_RECORDS[os.status]
          return (
            <div key={os.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', background: 'rgba(30,41,59,0.5)', borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{os.numero_os}</div>
                {os.objeto && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{os.objeto}</div>}
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  {formatDateBR(os.data_inicio)} - {formatDateBR(os.data_fim_prevista)}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#22c55e' }}>{formatBRL(os.valor)}</div>
                {statusRec && (
                  <span style={{
                    fontSize: 10, padding: '1px 6px', borderRadius: 6,
                    background: `${statusRec.color}20`, color: statusRec.color,
                    fontWeight: 600, whiteSpace: 'nowrap',
                  }}>{statusRec.label}</span>
                )}
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{os.percentual_execucao}% exec.</div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Tab: Aditivos
  function renderAditivos() {
    if (aditivos.length === 0) return <EmptyTab message="Nenhum aditivo registrado." />
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {aditivos.map(ad => {
          const tipoRec = ADITIVO_TIPO_RECORDS[ad.tipo]
          return (
            <div key={ad.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', background: 'rgba(30,41,59,0.5)', borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{ad.numero_aditivo}</div>
                {tipoRec && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{tipoRec.label}</div>}
                {ad.justificativa && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{ad.justificativa}</div>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, fontSize: 12 }}>
                <div style={{ color: '#94a3b8' }}>Anterior: {formatBRL(ad.valor_anterior)}</div>
                <div style={{ color: '#f59e0b' }}>Alteração: {formatBRL(ad.valor_alteracao)}</div>
                <div style={{ color: '#22c55e', fontWeight: 500 }}>Novo: {formatBRL(ad.valor_novo)}</div>
                {ad.vigencia_nova_fim && (
                  <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>
                    Vig: {formatDateBR(ad.vigencia_nova_fim)}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Tab: Medições
  function renderMedicoes() {
    if (medicoes.length === 0) return <EmptyTab message="Nenhuma medição registrada." />
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {medicoes.map(m => {
          const statusRec = MEDICAO_STATUS_RECORDS[m.status]
          return (
            <div key={m.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', background: 'rgba(30,41,59,0.5)', borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{m.numero_medicao}</div>
                {m.competencia && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Competência: {m.competencia}</div>}
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  {formatDateBR(m.periodo_inicio)} - {formatDateBR(m.periodo_fim)}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#22c55e' }}>{formatBRL(m.valor_medido)}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{m.percentual_executado}%</div>
                {statusRec && (
                  <span style={{
                    fontSize: 10, padding: '1px 6px', borderRadius: 6,
                    background: `${statusRec.color}20`, color: statusRec.color,
                    fontWeight: 600, whiteSpace: 'nowrap',
                  }}>{statusRec.label}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Tab: Pagamentos
  function renderPagamentos() {
    if (pagamentos.length === 0) return <EmptyTab message="Nenhum pagamento registrado." />
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pagamentos.map(p => {
          const statusRec = PAGAMENTO_STATUS_RECORDS[p.status]
          return (
            <div key={p.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', background: 'rgba(30,41,59,0.5)', borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>NF {p.numero_nota_fiscal}</div>
                {p.data_emissao_nf && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Emissão: {formatDateBR(p.data_emissao_nf)}</div>}
                {p.data_vencimento && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Venc: {formatDateBR(p.data_vencimento)}</div>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, fontSize: 12 }}>
                <div style={{ fontWeight: 600, color: '#22c55e' }}>{formatBRL(p.valor)}</div>
                {statusRec && (
                  <span style={{
                    fontSize: 10, padding: '1px 6px', borderRadius: 6,
                    background: `${statusRec.color}20`, color: statusRec.color,
                    fontWeight: 600, whiteSpace: 'nowrap',
                  }}>{statusRec.label}</span>
                )}
                {p.data_pagamento && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Pago: {formatDateBR(p.data_pagamento)}</div>}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Tab: Histórico
  function renderHistorico() {
    if (historico.length === 0) return <EmptyTab message="Nenhum histórico registrado." />
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {historico.map(h => (
          <div key={h.id} style={{
            padding: '12px 16px', background: 'rgba(30,41,59,0.5)', borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid #3b82f6',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{h.entidade}</div>
                {h.descricao && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{h.descricao}</div>}
                <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  <span>Ação: {h.acao}</span>
                  {h.valor_anterior && <span>Anterior: {h.valor_anterior}</span>}
                  {h.valor_novo && <span>Novo: {h.valor_novo}</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, fontSize: 11, color: '#64748b' }}>
                <div>{formatDateBR(h.created_at)}</div>
                {h.profiles?.name && <div>{h.profiles.name}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  function EmptyTab({ message }: { message: string }) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#64748b', fontSize: 13 }}>
        {message}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'flex-start',
        marginBottom: 16, gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0, flex: 1 }}>
          <button onClick={() => router.push('/pmo-dashboard/contratos')}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4, marginTop: 2 }}>
            <ArrowLeft size={20} />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#f8fafc', margin: 0, wordBreak: 'break-word' }}>
                {c.numero_contrato}
              </h1>
              {getStatusBadge(c.status)}
            </div>
            <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>{c.contratada_nome}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>
                <Calendar size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                {formatDateBR(c.data_inicio_vigencia)} - {formatDateBR(c.data_fim_vigencia)}
              </span>
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 6,
                background: drBadge.bg, color: drBadge.color, fontWeight: 600,
              }}>
                {drBadge.label}
              </span>
              {c.processos?.id_processo && (
                <Link href={`/pmo-dashboard/processos/detalhe?id=${c.processo_id}`}
                  style={{ fontSize: 12, color: '#60a5fa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <LinkIcon size={12} /> {c.processos.id_processo}
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
          {c.processo_id && (
            <Link href={`/pmo-dashboard/processos/detalhe?id=${c.processo_id}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px',
                background: '#334155', color: '#f1f5f9', border: 'none', borderRadius: 6,
                fontSize: 11, fontWeight: 600, cursor: 'pointer', textDecoration: 'none',
              }}>
              <FileText size={12} /> Processo
            </Link>
          )}
          {canEdit && (
            <Link href={`/pmo-dashboard/contratos/editar?id=${id}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px',
                background: '#334155', color: '#f1f5f9', border: 'none', borderRadius: 6,
                fontSize: 11, fontWeight: 600, cursor: 'pointer', textDecoration: 'none',
              }}>
              <Edit size={12} /> Editar
            </Link>
          )}
          {isVigente && (
            <button
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px',
                background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6,
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>
              <Plus size={12} /> Nova OS
            </button>
          )}
          {isVigente && (
            <button
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px',
                background: '#059669', color: '#fff', border: 'none', borderRadius: 6,
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>
              <BarChart3 size={12} /> Medição
            </button>
          )}
          {isVigente && (
            <button
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px',
                background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6,
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>
              <FileSignature size={12} /> Aditivo
            </button>
          )}
        </div>
      </div>

      {/* Alertas */}
      {renderAlertas()}

      {/* Summary Cards */}
      {renderSummaryCards()}

      {/* Tabs */}
      <div style={cardStyle}>
        <div style={{
          display: 'flex', overflowX: 'auto', gap: 0,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          marginBottom: 20, marginLeft: -24, marginRight: -24,
          paddingLeft: 24, paddingRight: 24,
        }}>
          {tabs.map(t => (
            <TabButton key={t.key} active={activeTab === t.key} onClick={() => setActiveTab(t.key)}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {t.icon} {t.label}
              </span>
            </TabButton>
          ))}
        </div>

        {activeTab === 'resumo' && renderResumo()}
        {activeTab === 'ordens' && renderOrdensServico()}
        {activeTab === 'aditivos' && renderAditivos()}
        {activeTab === 'medicoes' && renderMedicoes()}
        {activeTab === 'pagamentos' && renderPagamentos()}
        {activeTab === 'historico' && renderHistorico()}
      </div>
    </div>
  )
}
