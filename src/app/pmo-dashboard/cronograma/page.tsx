'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Processo, StatusProcessoCronograma } from '@/types/database'
import {
  CheckCircle2, Clock, Circle, AlertTriangle, ArrowRight, Search,
} from 'lucide-react'

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])
  return isMobile
}

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
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const isMobile = useIsMobile()

  const filtered = useMemo(() => {
    if (!search.trim()) return processos
    const q = search.toLowerCase()
    return processos.filter(p =>
      (p.id_processo?.toLowerCase() || '').includes(q) ||
      (p.objeto_resumido?.toLowerCase() || '').includes(q)
    )
  }, [processos, search])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    async function load() {
      const { data: procs } = await supabase
        .from('processos')
        .select('*, coordenacoes(nome), status_processo(nome), responsaveis(nome), demandantes(nome), modalidades(nome)')
        .order('data_entrada', { ascending: false })
      if (cancelled) return
      if (!procs) { setLoading(false); return }

      const ids = procs.map((p: Processo) => p.id_processo).filter(Boolean) as string[]

      const { data: cronoData } = ids.length > 0
        ? await supabase.from('vw_status_processo_cronograma').select('*').in('id_processo', ids)
        : { data: null }

      if (cancelled) return

      const cronoMap: Record<string, StatusProcessoCronograma> = {}
      if (cronoData) {
        for (const c of cronoData as StatusProcessoCronograma[]) {
          if (c.id_processo) cronoMap[c.id_processo] = c
        }
      }

      setProcessos(procs.map((p: Processo) => ({ ...p, status_cronograma: cronoMap[p.id_processo || ''] })))
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Carregando...</div>
  )

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: '#f1f5f9' }}>
        Cronograma de Processos
      </h1>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
        background: 'rgba(30,41,59,0.5)', borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.1)', padding: '0 12px',
      }}>
        <Search size={16} color="#64748b" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por ID ou objeto..."
          style={{
            flex: 1, padding: '10px 0', border: 'none', background: 'transparent',
            color: '#f1f5f9', fontSize: 14, outline: 'none', width: '100%',
          }}
        />
        {search && (
          <button onClick={() => setSearch('')}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16 }}>
            ×
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
          {search ? 'Nenhum processo encontrado para esta busca.' : 'Nenhum processo encontrado. Crie um processo no Dashboard para gerar o cronograma automaticamente.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(p => {
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
                  padding: isMobile ? 12 : 16,
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'stretch' : 'center',
                  gap: isMobile ? 8 : 16,
                  cursor: 'pointer',
                  border: sc?.processo_atrasado ? '1px solid #dc2626' : '1px solid #334155',
                }}
              >
                <Icon size={24} color={badge.color} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 14, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.objeto_resumido || 'Sem objeto'}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>
                    {p.id_processo || 'Sem ID'}{p.modalidades?.nome ? ` · ${p.modalidades.nome}` : ''}
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
