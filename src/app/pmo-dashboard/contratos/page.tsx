'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getContratoMetricas, listContratos } from '@/lib/contratos'
import { formatDateBR, formatBRL } from '@/lib/utils'
import type { ContratoMetricas, Contrato } from '@/types/contratos'
import { CONTRATO_STATUS_RECORDS } from '@/types/contratos'
import { useIsMobile } from '@/hooks/useIsMobile'
import {
  FileText, AlertTriangle, Clock, CheckCircle, XCircle, DollarSign,
  TrendingUp, Wallet, CreditCard, ClipboardList, FileSignature, ArrowRight, Calendar,
} from 'lucide-react'
import Link from 'next/link'

interface MetricCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  color: string
  bgColor?: string
}

function MetricCard({ icon, label, value, color, bgColor }: MetricCardProps) {
  return (
    <div style={{
      background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
      borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)',
      padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
      minWidth: 0,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: bgColor || `${color}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}

export default function ContratosDashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const isMobile = useIsMobile()
  const [metricas, setMetricas] = useState<ContratoMetricas | null>(null)
  const [proximosVencimentos, setProximosVencimentos] = useState<Contrato[]>([])
  const [semFiscal, setSemFiscal] = useState<Contrato[]>([])
  const [semMovimentacao, setSemMovimentacao] = useState<Contrato[]>([])
  const [loading, setLoading] = useState(true)
  const [schemaError, setSchemaError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const m = await getContratoMetricas(supabase)
        setMetricas(m)

        const [vencendo, semFiscalData] = await Promise.all([
          listContratos(supabase, { vigencia: 'vence_30d', limit: 10 }),
          listContratos(supabase, { sem_fiscal: true, limit: 10 }),
        ])
        setProximosVencimentos(vencendo)
        setSemFiscal(semFiscalData)

        const trintaDiasAtras = new Date()
        trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30)
        const trintaDiasAtrasStr = trintaDiasAtras.toISOString()
        const { data: semMovData, error } = await supabase
          .from('contratos')
          .select('id, numero_contrato, contratada_nome, objeto, data_fim_vigencia, status')
          .lt('updated_at', trintaDiasAtrasStr)
          .order('updated_at', { ascending: true })
          .limit(10)
        if (error) throw error
        setSemMovimentacao((semMovData || []) as Contrato[])
      } catch (err) {
        console.warn('Contratos schema unavailable:', err)
        setSchemaError('O módulo de contratos ainda não foi aplicado no banco de dados.')
      }

      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cardGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
    gap: 12, marginBottom: 24,
  }

  const glassCard: React.CSSProperties = {
    background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
    borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)',
    padding: isMobile ? 16 : 24, marginBottom: 24,
  }

  if (loading) return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ height: 28, width: '60%', background: 'rgba(71,85,105,0.4)', borderRadius: 8, marginBottom: 8 }} />
        <div style={{ height: 16, width: '40%', background: 'rgba(71,85,105,0.3)', borderRadius: 6 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <div key={i} style={{ height: 72, background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
            borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)' }} />
        ))}
      </div>
    </div>
  )

  if (schemaError) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{
          background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
          borderRadius: 16, border: '1px solid rgba(245,158,11,0.35)',
          padding: 24, color: '#f1f5f9',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <AlertTriangle size={20} color="#f59e0b" />
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Contratos indisponível</h1>
          </div>
          <p style={{ color: '#cbd5e1', fontSize: 14, margin: 0 }}>
            {schemaError} As demais áreas do sistema continuam acessíveis.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center',
        marginBottom: 24, gap: 12,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>Gestão de Contratos</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: '4px 0 0' }}>Painel geral de contratos</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push('/pmo-dashboard/contratos/novo')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', background: '#2563eb', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}>
            <FileText size={14} /> Novo Contrato
          </button>
          <button onClick={() => router.push('/pmo-dashboard/contratos/lista')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', background: '#334155', color: '#f1f5f9',
              border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}>
            <ClipboardList size={14} /> Ver Todos
          </button>
          <button onClick={() => router.push('/pmo-dashboard/contratos/vencimentos')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', background: '#334155', color: '#f1f5f9',
              border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}>
            <Calendar size={14} /> Vencimentos
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={cardGridStyle}>
        <MetricCard icon={<FileText size={18} color="#60a5fa" />} label="Total" value={metricas?.total ?? 0} color="#60a5fa" bgColor="rgba(96,165,250,0.15)" />
        <MetricCard icon={<CheckCircle size={18} color="#22c55e" />} label="Vigentes" value={metricas?.vigentes ?? 0} color="#22c55e" bgColor="rgba(34,197,94,0.15)" />
        <MetricCard icon={<Clock size={18} color="#f59e0b" />} label="Vencendo em 30d" value={metricas?.vencendo_30d ?? 0} color="#f59e0b" bgColor="rgba(245,158,11,0.15)" />
        <MetricCard icon={<XCircle size={18} color="#ef4444" />} label="Vencidos" value={metricas?.vencidos ?? 0} color="#ef4444" bgColor="rgba(239,68,68,0.15)" />
        <MetricCard icon={<DollarSign size={18} color="#22c55e" />} label="Valor Contratado" value={formatBRL(metricas?.valor_contratado ?? 0)} color="#22c55e" bgColor="rgba(34,197,94,0.15)" />
        <MetricCard icon={<TrendingUp size={18} color="#60a5fa" />} label="Valor Executado" value={formatBRL(metricas?.valor_executado ?? 0)} color="#60a5fa" bgColor="rgba(96,165,250,0.15)" />
        <MetricCard icon={<Wallet size={18} color="#a78bfa" />} label="Saldo" value={formatBRL(metricas?.saldo ?? 0)} color="#a78bfa" bgColor="rgba(167,139,250,0.15)" />
        <MetricCard icon={<CreditCard size={18} color="#f59e0b" />} label="Pagamentos Pendentes" value={metricas?.pagamentos_pendentes ?? 0} color="#f59e0b" bgColor="rgba(245,158,11,0.15)" />
      </div>

      {/* Secondary metrics */}
      <div style={cardGridStyle}>
        <MetricCard icon={<ClipboardList size={18} color="#3b82f6" />} label="OS em Execução" value={metricas?.os_em_execucao ?? 0} color="#3b82f6" bgColor="rgba(59,130,246,0.15)" />
        <MetricCard icon={<FileSignature size={18} color="#8b5cf6" />} label="Aditivos em Andamento" value={metricas?.aditivos_andamento ?? 0} color="#8b5cf6" bgColor="rgba(139,92,246,0.15)" />
        <MetricCard icon={<AlertTriangle size={18} color="#f59e0b" />} label="Sem Fiscal" value={metricas?.sem_fiscal ?? 0} color="#f59e0b" bgColor="rgba(245,158,11,0.15)" />
        <MetricCard icon={<AlertTriangle size={18} color="#ef4444" />} label="Sem Movimentação" value={metricas?.sem_movimentacao ?? 0} color="#ef4444" bgColor="rgba(239,68,68,0.15)" />
      </div>

      {/* Próximos Vencimentos */}
      <div style={glassCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <Clock size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Próximos Vencimentos
          </h3>
          {proximosVencimentos.length > 0 && (
            <Link href="/pmo-dashboard/contratos/lista?vigencia=vence_30d" style={{ fontSize: 12, color: '#60a5fa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              Ver todos <ArrowRight size={12} />
            </Link>
          )}
        </div>
        {proximosVencimentos.length === 0 ? (
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Nenhum contrato vencendo nos próximos 30 dias.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {proximosVencimentos.slice(0, 5).map(c => (
              <div key={c.id} onClick={() => router.push(`/pmo-dashboard/contratos/detalhe?id=${c.id}`)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: 'rgba(30,41,59,0.5)', borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(30,41,59,0.8)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(30,41,59,0.5)')}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{c.numero_contrato}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{c.contratada_nome}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#f59e0b' }}>{formatDateBR(c.data_fim_vigencia)}</div>
                  {c.status && (
                    <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 6,
                      background: `${CONTRATO_STATUS_RECORDS[c.status].color}20`,
                      color: CONTRATO_STATUS_RECORDS[c.status].color, fontWeight: 600,
                    }}>{CONTRATO_STATUS_RECORDS[c.status].label}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alertas */}
      <div style={glassCard}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <AlertTriangle size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Alertas
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {semFiscal.length > 0 && (
            <div style={{
              padding: '12px 16px', borderRadius: 10,
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <AlertTriangle size={14} color="#f59e0b" />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b' }}>
                  {semFiscal.length} contrato{semFiscal.length > 1 ? 's' : ''} sem fiscal designado
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {semFiscal.slice(0, 3).map(c => (
                  <div key={c.id} onClick={() => router.push(`/pmo-dashboard/contratos/detalhe?id=${c.id}`)}
                    style={{ fontSize: 12, color: '#94a3b8', cursor: 'pointer', padding: '4px 0' }}>
                    {c.numero_contrato} - {c.contratada_nome}
                  </div>
                ))}
              </div>
            </div>
          )}
          {semMovimentacao.length > 0 && (
            <div style={{
              padding: '12px 16px', borderRadius: 10,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <AlertTriangle size={14} color="#ef4444" />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#ef4444' }}>
                  {semMovimentacao.length} contrato{semMovimentacao.length > 1 ? 's' : ''} sem movimentação há mais de 30 dias
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {semMovimentacao.slice(0, 3).map(c => (
                  <div key={c.id} onClick={() => router.push(`/pmo-dashboard/contratos/detalhe?id=${c.id}`)}
                    style={{ fontSize: 12, color: '#94a3b8', cursor: 'pointer', padding: '4px 0' }}>
                    {c.numero_contrato} - {c.contratada_nome}
                  </div>
                ))}
              </div>
            </div>
          )}
          {semFiscal.length === 0 && semMovimentacao.length === 0 && (
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Nenhum alerta no momento.</p>
          )}
        </div>
      </div>
    </div>
  )
}
