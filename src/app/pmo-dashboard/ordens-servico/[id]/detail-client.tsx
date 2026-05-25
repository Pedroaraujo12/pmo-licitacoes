'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getOrdemServico } from '@/lib/ordens-servico'
import { formatDateBR, formatBRL } from '@/lib/utils'
import { OS_STATUS_RECORDS } from '@/types/contratos'
import type { OrdemServico } from '@/types/contratos'
import { ArrowLeft, Edit, ExternalLink } from 'lucide-react'

const cardStyle: React.CSSProperties = {
  background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
  borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', padding: 24, marginBottom: 16,
}
const fieldStyle: React.CSSProperties = {
  background: 'rgba(30,41,59,0.5)', borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.06)', padding: '12px 16px',
}
const labelStyle: React.CSSProperties = {
  fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.05em',
}

export default function OrdemServicoDetailClient({ params }: { params: Promise<{ id: string }> }) {
  const paramsId = use(params).id
  const [id, setId] = useState(paramsId)
  const router = useRouter()
  const supabase = createClient()
  const [os, setOs] = useState<OrdemServico | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const currentId = id
      if (currentId === 'placeholder') {
        const m = window.location.pathname.match(/\/ordens-servico\/([a-f0-9-]+)/)
        if (m && m[1] !== 'placeholder') {
          setId(m[1])
          return
        }
      }
      const data = await getOrdemServico(supabase, currentId)
      setOs(data)
      setLoading(false)
    }
    load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={cardStyle}>
            {[1, 2, 3, 4].map(j => (
              <div key={j} style={{ height: 14, background: 'rgba(71,85,105,0.4)', borderRadius: 6, marginBottom: 10, width: `${40 + j * 15}%` }} />
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (!os) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: '#ef4444' }}>
        Ordem de Serviço não encontrada
      </div>
    )
  }

  const statusRec = OS_STATUS_RECORDS[os.status]

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/pmo-dashboard/ordens-servico')}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>OS {os.numero_os}</h1>
            {os.objeto && <p style={{ color: '#94a3b8', fontSize: 14, margin: '4px 0 0' }}>{os.objeto}</p>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push(`/pmo-dashboard/ordens-servico/${id}/editar`)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#334155', color: '#f1f5f9', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
            <Edit size={14} /> Editar
          </button>
        </div>
      </div>

      {/* Status + Progress */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={fieldStyle}>
          <div style={labelStyle}>Status</div>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: `${statusRec.bgColor}20`, color: statusRec.color, fontWeight: 600 }}>
            {statusRec.label}
          </span>
        </div>
        <div style={fieldStyle}>
          <div style={labelStyle}>% Executado</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <div style={{ flex: 1, height: 8, background: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(os.percentual_execucao || 0, 100)}%`, background: '#3b82f6', borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>{os.percentual_execucao || 0}%</span>
          </div>
        </div>
      </div>

      {/* Contrato */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase' }}>Contrato Vinculado</h3>
        {os.contratos ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>{os.contratos.numero_contrato}</span>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>{os.contratos.contratada_nome}</span>
            <button onClick={() => router.push(`/pmo-dashboard/contratos/${os.contrato_id}`)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              <ExternalLink size={12} /> Ver contrato
            </button>
          </div>
        ) : (
          <span style={{ color: '#64748b', fontSize: 13 }}>—</span>
        )}
      </div>

      {/* Descrição */}
      {os.descricao && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 8px', textTransform: 'uppercase' }}>Descrição</h3>
          <p style={{ fontSize: 13, color: '#cbd5e1', margin: 0, whiteSpace: 'pre-wrap' }}>{os.descricao}</p>
        </div>
      )}

      {/* Datas */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase' }}>Datas</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div style={fieldStyle}>
            <div style={labelStyle}>Emissão</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{formatDateBR(os.data_emissao)}</div>
          </div>
          <div style={fieldStyle}>
            <div style={labelStyle}>Início</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{formatDateBR(os.data_inicio)}</div>
          </div>
          <div style={fieldStyle}>
            <div style={labelStyle}>Prevista Conclusão</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{formatDateBR(os.data_fim_prevista)}</div>
          </div>
          <div style={fieldStyle}>
            <div style={labelStyle}>Conclusão Real</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{formatDateBR(os.data_fim_real)}</div>
          </div>
        </div>
      </div>

      {/* Valores */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase' }}>Valores</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div style={fieldStyle}>
            <div style={labelStyle}>Valor</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#22c55e' }}>{formatBRL(os.valor)}</div>
          </div>
          <div style={fieldStyle}>
            <div style={labelStyle}>Valor Medido</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>{formatBRL(os.valor_medido)}</div>
          </div>
          <div style={fieldStyle}>
            <div style={labelStyle}>Valor Pago</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>{formatBRL(os.valor_pago)}</div>
          </div>
        </div>
      </div>

      {/* Responsáveis e Local */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase' }}>Responsáveis e Local</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={fieldStyle}>
            <div style={labelStyle}>Fiscal Responsável</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{os.fiscais?.nome || '-'}</div>
          </div>
          <div style={fieldStyle}>
            <div style={labelStyle}>Contratada Responsável</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{os.contratada_responsavel || '-'}</div>
          </div>
          <div style={fieldStyle}>
            <div style={labelStyle}>Local de Execução</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{os.local_execucao || '-'}</div>
          </div>
        </div>
      </div>

      {/* Observações */}
      {os.observacoes && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 8px', textTransform: 'uppercase' }}>Observações</h3>
          <p style={{ fontSize: 13, color: '#cbd5e1', margin: 0, whiteSpace: 'pre-wrap' }}>{os.observacoes}</p>
        </div>
      )}
    </div>
  )
}
