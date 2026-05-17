'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Processo, StatusProcessoCronograma } from '@/types/database'
import {
  CheckCircle2, Clock, Circle, AlertTriangle, ArrowRight,
} from 'lucide-react'

function formatDate(d: string | null | undefined) {
  if (!d) return '-'
  const date = new Date(d)
  if (isNaN(date.getTime())) return d
  return date.toLocaleDateString('pt-BR')
}

function statusBadge(status: string) {
  switch (status) {
    case 'concluido': return { label: 'Concluído', color: '#059669', icon: CheckCircle2 }
    case 'em_andamento': return { label: 'Em Andamento', color: '#2563eb', icon: Clock }
    default: return { label: 'Não Iniciado', color: '#64748b', icon: Circle }
  }
}

export default function CronogramaPage() {
  const router = useRouter()
  const [processos, setProcessos] = useState<(Processo & { status_cronograma?: StatusProcessoCronograma })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: procs } = await supabase
        .from('processos')
        .select('*, coordenacao(nome), status(nome), responsavel(nome), demandante(nome), modalidade(nome)')
        .order('data_entrada', { ascending: false })
      if (!procs) { setLoading(false); return }

      const ids = procs.map((p: Processo) => p.id_processo).filter(Boolean) as string[]
      let cronoMap: Record<string, StatusProcessoCronograma> = {}
      if (ids.length > 0) {
        const { data: cronoData } = await supabase
          .from('vw_status_processo_cronograma')
          .select('*')
          .in('id_processo', ids)
        if (cronoData) {
          for (const c of cronoData as StatusProcessoCronograma[]) {
            if (c.id_processo) cronoMap[c.id_processo] = c
          }
        }
      }

      setProcessos(procs.map((p: Processo) => ({ ...p, status_cronograma: cronoMap[p.id_processo || ''] })))
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Carregando...</div>
  )

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: '#f1f5f9' }}>
        Cronograma de Processos
      </h1>

      {processos.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
          Nenhum processo encontrado. Crie um processo no Dashboard para gerar o cronograma automaticamente.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {processos.map(p => {
            const sc = p.status_cronograma
            const badge = statusBadge(sc?.processo_atrasado ? 'em_andamento' : (sc?.etapas_concluidas === sc?.total_etapas && sc?.total_etapas ? 'concluido' : 'nao_iniciado'))
            const Icon = badge.icon
            return (
              <div
                key={p.id}
                onClick={() => router.push(`/pmo-dashboard/processos/${p.id}`)}
                style={{
                  background: '#1e293b',
                  borderRadius: 12,
                  padding: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  cursor: 'pointer',
                  border: sc?.processo_atrasado ? '1px solid #dc2626' : '1px solid #334155',
                }}
              >
                <Icon size={24} color={badge.color} />

                <div style={{ flex: 1 }}>
                  <div style={{ color: '#f1f5f9', fontWeight: 600, marginBottom: 4 }}>
                    {p.id_processo || 'Sem ID'} {p.modalidade?.nome ? `- ${p.modalidade.nome}` : ''}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 13 }}>
                    {p.data_entrada ? `Entrada: ${formatDate(p.data_entrada)}` : ''}
                    {sc?.total_etapas ? ` · ${sc.etapas_concluidas}/${sc.total_etapas} etapas` : ' · Sem cronograma'}
                    {sc?.progresso_calculado ? ` · ${sc.progresso_calculado}%` : ''}
                    {sc?.etapas_atrasadas ? ` · ${sc.etapas_atrasadas} atrasada(s)` : ''}
                  </div>
                  {sc?.atividade_atual && (
                    <div style={{ color: '#cbd5e1', fontSize: 13, marginTop: 4 }}>
                      Atual: {sc.atividade_atual}
                    </div>
                  )}
                </div>

                {sc && (
                  <div style={{ textAlign: 'right' }}>
                    {sc.total_etapas > 0 && (
                      <div style={{
                        width: 80, height: 6, background: '#334155', borderRadius: 3, overflow: 'hidden', marginLeft: 'auto', marginBottom: 4,
                      }}>
                        <div style={{
                          width: `${sc.progresso_calculado}%`,
                          height: '100%',
                          background: sc.processo_atrasado ? '#dc2626' : '#22c55e',
                          borderRadius: 3,
                          transition: 'width 0.3s',
                        }} />
                      </div>
                    )}
                    <div style={{ color: '#64748b', fontSize: 12 }}>
                      {sc.data_fim_prevista_total ? `Previsão: ${formatDate(sc.data_fim_prevista_total)}` : ''}
                    </div>
                  </div>
                )}

                <ArrowRight size={16} color="#64748b" />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
