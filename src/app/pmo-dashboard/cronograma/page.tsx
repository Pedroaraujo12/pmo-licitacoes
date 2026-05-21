'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Processo, StatusProcessoCronograma } from '@/types/database'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useDebounce } from '@/hooks/useDebounce'
import { fetchAllSeiLinks } from '@/lib/utils'
import {
  CheckCircle2, Clock, Circle, ArrowRight, Search,
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
  const searchRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [loading, setLoading] = useState(true)
  const [seiLinks, setSeiLinks] = useState<Record<string, string>>({})
  const isMobile = useIsMobile()

  const filtered = useMemo(() => {
    if (!debouncedSearch.trim()) return processos
    const q = debouncedSearch.toLowerCase()
    return processos.filter(p =>
      (p.id_processo?.toLowerCase() || '').includes(q) ||
      (p.objeto_resumido?.toLowerCase() || '').includes(q)
    )
  }, [processos, debouncedSearch])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    async function load() {
      try {
        const { data: procs } = await supabase
          .from('processos')
          .select('*, coordenacoes(nome), status_processo(nome), responsaveis(nome), demandantes(nome), modalidades(nome)')
          .order('data_entrada', { ascending: false })
        if (cancelled) return
        if (!procs) { setLoading(false); return }

        const procsById = new Map<string, Processo>(procs.map((p: Processo) => [p.id, p]))
        const { data: etapas } = await supabase
          .from('cronograma_atividades')
          .select('*')
          .order('ordem', { ascending: true })

        if (cancelled) return

        const cronoMap: Record<string, StatusProcessoCronograma> = {}
        if (etapas) {
        const grouped: Record<string, { etapaConcluida: number; etapaAtrasada: number; total: number; ultimaFase: string; }> = {}
        for (const e of etapas) {
          const key = e.processo_id
          if (!grouped[key]) grouped[key] = { etapaConcluida: 0, etapaAtrasada: 0, total: 0, ultimaFase: '' }
          grouped[key].total++
          if (e.status === 'concluido') grouped[key].etapaConcluida++
          const overdue = e.status !== 'concluido' && e.data_fim && new Date(e.data_fim) < new Date()
          if (overdue) grouped[key].etapaAtrasada++
          if (e.status !== 'concluido') grouped[key].ultimaFase = e.fase
        }
        for (const [procId, g] of Object.entries(grouped)) {
          const proc = procsById.get(procId)
          const dataEntrega = proc?.data_entrega
          const atrasadoPorData = dataEntrega ? new Date(dataEntrega) < new Date() : false
          const pct = g.total > 0 ? Math.round((g.etapaConcluida / g.total) * 100) : 0
          cronoMap[procId] = {
            id_processo: procId,
            processo_atrasado: g.etapaConcluida < g.total && (atrasadoPorData || g.etapaAtrasada > 0),
            total_etapas: g.total,
            etapas_concluidas: g.etapaConcluida,
            etapas_atrasadas: g.etapaAtrasada,
            progresso_calculado: pct,
            atividade_atual: g.ultimaFase || null,
            data_fim_prevista_total: dataEntrega || null,
          } as StatusProcessoCronograma
        }
      }

      setProcessos(procs.map((p: Processo) => ({ ...p, status_cronograma: cronoMap[p.id] })))
      setLoading(false)
      } catch {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    fetchAllSeiLinks(supabase).then(setSeiLinks)
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
          ref={searchRef}
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por ID ou objeto...  ⌘K"
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
                    <a href={seiLinks[p.id] || '#'} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: seiLinks[p.id] ? 'underline' : 'none' }}>{p.id_processo || 'Sem ID'}</a>{p.modalidades?.nome ? ` · ${p.modalidades.nome}` : ''}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 13 }}>
                    {p.data_entrada ? `Entrada: ${formatDate(p.data_entrada)}` : ''}
                    {sc ? ` · ${sc.etapas_concluidas}/${sc.total_etapas} etapas` : ' · Sem cronograma'}
                    {sc?.progresso_calculado !== undefined ? ` · ${sc.progresso_calculado}%` : ''}
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
