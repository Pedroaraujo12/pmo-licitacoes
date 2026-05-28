'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getFornecedor } from '@/lib/fornecedores'
import { formatDateBR, formatBRL } from '@/lib/utils'
import type { FornecedorResumo, FornecedorContrato } from '@/types/fornecedores'
import { CONTRATO_STATUS_RECORDS } from '@/types/contratos'
import { useIsMobile } from '@/hooks/useIsMobile'
import {
  ArrowLeft, Building2, FileText, DollarSign,
  Mail, Phone, User, TrendingUp, Wallet,
} from 'lucide-react'

const cardStyle: React.CSSProperties = {
  background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
  borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)',
  padding: 24, marginBottom: 24,
}

function MetricCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string | number; color: string
}) {
  return (
    <div style={{
      background: 'rgba(30,41,59,0.5)', borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.06)',
      padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(30,41,59,0.5)', borderRadius: 10,
      border: '1px solid rgba(255,255,255,0.06)', padding: '12px 16px',
    }}>
      <div style={{
        fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{children}</div>
    </div>
  )
}

export default function FornecedorDetailClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const isMobile = useIsMobile()

  const nomeParam = searchParams?.get('nome') || ''
  const nome = decodeURIComponent(nomeParam)

  const [resumo, setResumo] = useState<FornecedorResumo | null>(null)
  const [contratos, setContratos] = useState<FornecedorContrato[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!nome) {
        if (!cancelled) setLoading(false)
        return
      }
      try {
        const data = await getFornecedor(supabase, nome)
        if (!cancelled) {
          setResumo(data.resumo)
          setContratos(data.contratos)
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nome])

  if (!nome) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>
        Fornecedor não especificado.
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ height: 28, width: '40%', background: 'rgba(71,85,105,0.4)', borderRadius: 8, marginBottom: 8 }} />
          <div style={{ height: 16, width: '25%', background: 'rgba(71,85,105,0.3)', borderRadius: 6 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{
              height: 64, background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
              borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
            }} />
          ))}
        </div>
      </div>
    )
  }

  if (!resumo) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>
        Fornecedor não encontrado.
      </div>
    )
  }

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
    gap: 12, marginBottom: 24,
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.push('/pmo-dashboard/fornecedores')}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>
            {resumo.nome}
          </h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: '4px 0 0' }}>
            {resumo.total_contratos} contrato{resumo.total_contratos !== 1 ? 's' : ''} vinculado{resumo.total_contratos !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div style={gridStyle}>
        <MetricCard icon={<FileText size={16} color="#60a5fa" />} label="Contratos" value={resumo.total_contratos} color="#60a5fa" />
        <MetricCard icon={<DollarSign size={16} color="#22c55e" />} label="Valor Total" value={formatBRL(resumo.valor_total)} color="#22c55e" />
        <MetricCard icon={<TrendingUp size={16} color="#60a5fa" />} label="Valor Executado" value={formatBRL(resumo.valor_executado)} color="#60a5fa" />
        <MetricCard icon={<Wallet size={16} color="#a78bfa" />} label="Saldo" value={formatBRL(resumo.valor_total - resumo.valor_executado)} color="#a78bfa" />
      </div>

      <div style={cardStyle}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <Building2 size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Dados do Fornecedor
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: 12,
        }}>
          {resumo.cnpj && <DetailField label="CNPJ">{resumo.cnpj}</DetailField>}
          {resumo.representante && (
            <DetailField label="Representante">
              <User size={12} style={{ marginRight: 4, verticalAlign: 'middle', color: '#64748b' }} />
              {resumo.representante}
            </DetailField>
          )}
          {resumo.email && (
            <DetailField label="E-mail">
              <Mail size={12} style={{ marginRight: 4, verticalAlign: 'middle', color: '#64748b' }} />
              {resumo.email}
            </DetailField>
          )}
          {resumo.telefone && (
            <DetailField label="Telefone">
              <Phone size={12} style={{ marginRight: 4, verticalAlign: 'middle', color: '#64748b' }} />
              {resumo.telefone}
            </DetailField>
          )}
          {resumo.primeiro_contrato && <DetailField label="Primeiro Contrato">{formatDateBR(resumo.primeiro_contrato)}</DetailField>}
          {resumo.ultimo_vencimento && <DetailField label="Último Vencimento">{formatDateBR(resumo.ultimo_vencimento)}</DetailField>}
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <FileText size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Contratos Relacionados
        </h3>
        {contratos.length === 0 ? (
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Nenhum contrato encontrado.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {contratos.map(c => {
              const statusRec = CONTRATO_STATUS_RECORDS[c.status as keyof typeof CONTRATO_STATUS_RECORDS]
              return (
                <Link key={c.id} href={`/pmo-dashboard/contratos/detalhe?id=${c.id}`}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 16px', background: 'rgba(30,41,59,0.5)', borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none',
                    transition: 'background 0.15s', gap: 12,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(30,41,59,0.8)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(30,41,59,0.5)')}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', marginBottom: 2 }}>
                      {c.numero_contrato}
                    </div>
                    {c.objeto && (
                      <div style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.objeto}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#22c55e' }}>{formatBRL(c.valor_atual)}</div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>contratado</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#60a5fa' }}>{formatBRL(c.valor_executado)}</div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>executado</div>
                    </div>
                    {statusRec && (
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 6,
                        background: `${statusRec.color}20`, color: statusRec.color, fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}>
                        {statusRec.label}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
