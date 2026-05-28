'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { listAniversariantes, listUnidades } from '@/lib/colaboradores'
import type { ColaboradorAniversariante } from '@/types/colaboradores'
import { ArrowLeft } from 'lucide-react'

const PERIODO_LABELS: Record<string, string> = {
  hoje: 'Hoje',
  essa_semana: 'Esta Semana',
  esse_mes: 'Este Mês',
}

const PERIODO_COLORS: Record<string, string> = {
  hoje: '#ef4444',
  essa_semana: '#f59e0b',
  esse_mes: '#3b82f6',
}

export default function AniversariantesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [aniversariantes, setAniversariantes] = useState<ColaboradorAniversariante[]>([])
  const [unidades, setUnidades] = useState<string[]>([])
  const [filtroUnidade, setFiltroUnidade] = useState('')
  const [periodo, setPeriodo] = useState<string>('')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const data = await listAniversariantes(supabase, (periodo || undefined) as 'hoje' | 'essa_semana' | 'esse_mes' | undefined, filtroUnidade || undefined)
    setAniversariantes(data)
    const u = await listUnidades(supabase)
    setUnidades(u)
    setLoading(false)
  }

  useEffect(() => { load() }, [periodo, filtroUnidade]) // eslint-disable-line react-hooks/set-state-in-effect,react-hooks/exhaustive-deps
  useEffect(() => {
    const watchdog = window.setTimeout(() => setLoading(false), 12000)
    return () => window.clearTimeout(watchdog)
  }, [periodo, filtroUnidade])

  const baseInput: React.CSSProperties = {
    padding: '8px 10px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
    fontSize: 13, background: 'rgba(30,41,59,0.5)', color: '#cbd5e1', outline: 'none',
  }



  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.push('/pmo-dashboard/colaboradores')}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>🎂 Aniversariantes</h1>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <select value={periodo} onChange={e => setPeriodo(e.target.value)} style={{ ...baseInput, minWidth: 160 }}>
          <option value="">Todos os períodos</option>
          <option value="hoje">Hoje</option>
          <option value="essa_semana">Esta semana</option>
          <option value="esse_mes">Este mês</option>
        </select>
        <select value={filtroUnidade} onChange={e => setFiltroUnidade(e.target.value)} style={{ ...baseInput, minWidth: 200 }}>
          <option value="">Todas unidades</option>
          {unidades.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="loading-spinner" /></div>
      ) : aniversariantes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748b', fontSize: 14 }}>
          Nenhum aniversariante encontrado neste período
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {aniversariantes.map(a => (
            <div key={a.id} onClick={() => router.push(`/pmo-dashboard/colaboradores/detalhe?id=${a.id}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
                borderRadius: 12, border: `1px solid ${PERIODO_COLORS[a.periodo_aniversario]}30`,
                cursor: 'pointer',
              }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
              }}>
                🎂
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#f1f5f9' }}>{a.nome_completo}</span>
                  <span style={{
                    fontSize: 10, padding: '1px 7px', borderRadius: 6,
                    background: `${PERIODO_COLORS[a.periodo_aniversario]}20`,
                    color: PERIODO_COLORS[a.periodo_aniversario], fontWeight: 600,
                  }}>{PERIODO_LABELS[a.periodo_aniversario]}</span>
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                  {a.cargo && <span>{a.cargo} · </span>}
                  {a.unidade && <span>{a.unidade} · </span>}
                  <span>{a.dia_nascimento}/{String(a.mes_nascimento).padStart(2, '0')} — {a.idade} anos</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 12, color: '#64748b', flexShrink: 0 }}>
                {a.email_institucional && <span>{a.email_institucional}</span>}
                {a.telefone_institucional && <span>{a.telefone_institucional}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
