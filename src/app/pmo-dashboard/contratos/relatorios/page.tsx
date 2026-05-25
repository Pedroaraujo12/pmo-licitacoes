'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { exportCSV } from '@/lib/utils'
import { Download } from 'lucide-react'

interface RelatorioDef {
  id: string
  titulo: string
  descricao: string
  icon: React.ReactNode
}

const relatorios: RelatorioDef[] = [
  { id: 'vigentes', titulo: 'Contratos Vigentes', descricao: 'Contratos com status Vigente ou Próximo ao Vencimento', icon: <span style={{ color: '#22c55e' }}>●</span> },
  { id: 'vencidos', titulo: 'Contratos Vencidos', descricao: 'Contratos com data de vigência vencida', icon: <span style={{ color: '#ef4444' }}>●</span> },
  { id: 'avencer', titulo: 'A Vencer em 30 Dias', descricao: 'Contratos que vencem nos próximos 30 dias', icon: <span style={{ color: '#f59e0b' }}>●</span> },
  { id: 'os_execucao', titulo: 'OS em Execução', descricao: 'Ordens de Serviço em andamento', icon: <span style={{ color: '#3b82f6' }}>●</span> },
  { id: 'os_atrasadas', titulo: 'OS Atrasadas', descricao: 'Ordens de Serviço com prazo vencido', icon: <span style={{ color: '#ef4444' }}>●</span> },
  { id: 'pagamentos_pendentes', titulo: 'Pagamentos Pendentes', descricao: 'Pagamentos aguardando liberação', icon: <span style={{ color: '#8b5cf6' }}>●</span> },
  { id: 'medicoes_pendentes', titulo: 'Medições Pendentes', descricao: 'Medições enviadas ou em análise', icon: <span style={{ color: '#f59e0b' }}>●</span> },
  { id: 'aditivos', titulo: 'Aditivos', descricao: 'Todos os aditivos registrados', icon: <span style={{ color: '#f59e0b' }}>●</span> },
]

interface Counts {
  vigentes: number
  vencidos: number
  avencer: number
  os_execucao: number
  os_atrasadas: number
  pagamentos_pendentes: number
  medicoes_pendentes: number
  aditivos: number
}

export default function RelatoriosPage() {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<string | null>(null)
  const dataCache = useRef<Record<string, unknown[]>>({})

  async function carregarCounts() {
    const supabase = createClient()
    const hoje = new Date().toISOString().slice(0, 10)
    const trintaDias = new Date()
    trintaDias.setDate(trintaDias.getDate() + 30)
    const trintaDiasStr = trintaDias.toISOString().slice(0, 10)

    const [
      vigentesRes, vencidosRes, avencerRes,
      osExecRes, osAtrasRes,
      pagRes, medRes, aditivosRes,
    ] = await Promise.all([
      supabase.from('contratos').select('id', { count: 'exact', head: true }).in('status', ['vigente', 'proximo_vencimento']),
      supabase.from('contratos').select('id', { count: 'exact', head: true }).lt('data_fim_vigencia', hoje).not('status', 'in', '("encerrado","rescindido")'),
      supabase.from('contratos').select('id', { count: 'exact', head: true }).gte('data_fim_vigencia', hoje).lte('data_fim_vigencia', trintaDiasStr).in('status', ['vigente', 'proximo_vencimento']),
      supabase.from('ordens_servico').select('id', { count: 'exact', head: true }).eq('status', 'em_execucao'),
      supabase.from('ordens_servico').select('id', { count: 'exact', head: true }).not('status', 'in', '("concluida","cancelada")').lt('data_fim_prevista', hoje),
      supabase.from('contrato_pagamentos').select('id', { count: 'exact', head: true }).in('status', ['aguardando_nf', 'aguardando_atesto', 'aguardando_liquidacao', 'aguardando_pagamento']),
      supabase.from('contrato_medicoes').select('id', { count: 'exact', head: true }).in('status', ['enviada', 'em_analise']),
      supabase.from('contrato_aditivos').select('id', { count: 'exact', head: true }),
    ])

    setCounts({
      vigentes: vigentesRes.count ?? 0,
      vencidos: vencidosRes.count ?? 0,
      avencer: avencerRes.count ?? 0,
      os_execucao: osExecRes.count ?? 0,
      os_atrasadas: osAtrasRes.count ?? 0,
      pagamentos_pendentes: pagRes.count ?? 0,
      medicoes_pendentes: medRes.count ?? 0,
      aditivos: aditivosRes.count ?? 0,
    })
    setLoading(false)
  }

  useState(() => { carregarCounts() })

  async function handleExport(id: string) {
    if (dataCache.current[id]) {
      doExport(id, dataCache.current[id])
      return
    }

    setExporting(id)
    const supabase = createClient()
    const hoje = new Date().toISOString().slice(0, 10)
    const trintaDias = new Date()
    trintaDias.setDate(trintaDias.getDate() + 30)
    const trintaDiasStr = trintaDias.toISOString().slice(0, 10)

    let data: unknown[] = []
    switch (id) {
      case 'vigentes': {
        const { data: d } = await supabase.from('contratos').select('*').in('status', ['vigente', 'proximo_vencimento'])
        data = d || []
        break
      }
      case 'vencidos': {
        const { data: d } = await supabase.from('contratos').select('*').lt('data_fim_vigencia', hoje).not('status', 'in', '("encerrado","rescindido")')
        data = d || []
        break
      }
      case 'avencer': {
        const { data: d } = await supabase.from('contratos').select('*').gte('data_fim_vigencia', hoje).lte('data_fim_vigencia', trintaDiasStr).in('status', ['vigente', 'proximo_vencimento'])
        data = d || []
        break
      }
      case 'os_execucao': {
        const { data: d } = await supabase.from('ordens_servico').select('*').eq('status', 'em_execucao')
        data = d || []
        break
      }
      case 'os_atrasadas': {
        const { data: d } = await supabase.from('ordens_servico').select('*').not('status', 'in', '("concluida","cancelada")').lt('data_fim_prevista', hoje)
        data = d || []
        break
      }
      case 'pagamentos_pendentes': {
        const { data: d } = await supabase.from('contrato_pagamentos').select('*').in('status', ['aguardando_nf', 'aguardando_atesto', 'aguardando_liquidacao', 'aguardando_pagamento'])
        data = d || []
        break
      }
      case 'medicoes_pendentes': {
        const { data: d } = await supabase.from('contrato_medicoes').select('*').in('status', ['enviada', 'em_analise'])
        data = d || []
        break
      }
      case 'aditivos': {
        const { data: d } = await supabase.from('contrato_aditivos').select('*')
        data = d || []
        break
      }
    }
    dataCache.current[id] = data
    setExporting(null)
    doExport(id, data)
  }

  function doExport(id: string, data: unknown[]) {
    exportCSV(data as Record<string, unknown>[], `${id}-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const cardStyle: React.CSSProperties = {
    background: '#1e293b', borderRadius: 16,
    border: '1px solid #334155', padding: 20,
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>Relatórios de Contratos</h1>
        <p style={{ color: '#64748b', fontSize: 14, margin: '4px 0 0' }}>Relatórios operacionais e financeiros para exportação</p>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {relatorios.map(r => (
            <div key={r.id} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ height: 20, width: '60%', background: '#334155', borderRadius: 6 }} />
              <div style={{ height: 14, width: '80%', background: '#1e293b', borderRadius: 6, border: '1px solid #334155' }} />
              <div style={{ height: 32, width: '40%', background: '#334155', borderRadius: 8 }} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {relatorios.map(rel => {
            const count = counts?.[rel.id as keyof Counts] ?? 0
            return (
              <div key={rel.id} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {rel.icon}
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', margin: 0 }}>{rel.titulo}</h3>
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: '#f1f5f9',
                    background: 'rgba(99,102,241,0.2)', padding: '2px 10px', borderRadius: 12,
                  }}>{count}</span>
                </div>
                <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px' }}>{rel.descricao}</p>
                <button
                  onClick={() => handleExport(rel.id)}
                  disabled={count === 0 || exporting === rel.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border-none"
                  style={{ background: count > 0 ? '#2563eb' : '#1e293b', color: count > 0 ? '#fff' : '#475569' }}
                >
                  <Download size={12} /> {exporting === rel.id ? 'Carregando...' : 'Exportar CSV'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
