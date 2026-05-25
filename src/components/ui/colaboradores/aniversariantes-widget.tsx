'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Cake, ChevronRight, Gift } from 'lucide-react'

interface ProximoAniversariante {
  id: string
  nome: string
  dia: number
  mes: number
  unidade: string | null
}

export default function AniversariantesWidget() {
  const router = useRouter()
  const [proximos, setProximos] = useState<ProximoAniversariante[]>([])

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)
      const limite = new Date(hoje)
      limite.setDate(limite.getDate() + 15)

      const { data } = await supabase
        .from('colaboradores')
        .select('id, nome_completo, data_nascimento, unidade')
        .not('data_nascimento', 'is', null)
        .limit(30)

      if (!data) return

      const result: ProximoAniversariante[] = []
      for (const c of data) {
        const partes = c.data_nascimento.split('-')
        if (partes.length !== 3) continue
        const mesNasc = parseInt(partes[1], 10)
        const diaNasc = parseInt(partes[2], 10)
        const anivEsteAno = new Date(hoje.getFullYear(), mesNasc - 1, diaNasc)
        if (anivEsteAno >= hoje && anivEsteAno <= limite) {
          result.push({ id: c.id, nome: c.nome_completo, dia: diaNasc, mes: mesNasc, unidade: c.unidade })
        }
      }
      result.sort((a, b) => {
        if (a.mes !== b.mes) return a.mes - b.mes
        return a.dia - b.dia
      })
      setProximos(result)
    }
    load()
  }, [])

  if (proximos.length === 0) return null

  const primeiro = proximos[0]

  return (
    <div style={{
      background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
      borderRadius: 20, border: '1px solid rgba(251,146,60,0.3)', padding: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Cake size={16} style={{ color: '#fb923c' }} /> Aniversariantes
        </h3>
        {proximos.length > 1 && (
          <span style={{ fontSize: 11, color: '#fb923c', background: 'rgba(251,146,60,0.15)', padding: '2px 8px', borderRadius: 6 }}>
            +{proximos.length - 1} em {15} dias
          </span>
        )}
      </div>

      {/* Destaque do próximo aniversariante */}
      <div
        onClick={() => router.push(`/pmo-dashboard/colaboradores/${primeiro.id}`)}
        style={{
          background: 'rgba(251,146,60,0.12)', borderRadius: 12,
          border: '1px solid rgba(251,146,60,0.25)', padding: '14px 16px',
          cursor: 'pointer', marginBottom: proximos.length > 1 ? 8 : 0,
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(251,146,60,0.2)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Gift size={22} style={{ color: '#fb923c' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fed7aa' }}>{primeiro.nome}</div>
            <div style={{ fontSize: 12, color: '#fb923c', marginTop: 1 }}>
              {primeiro.dia}/{String(primeiro.mes).padStart(2, '0')}
              {primeiro.unidade && <> · {primeiro.unidade}</>}
            </div>
          </div>
        </div>
      </div>

      {/* Lista dos demais */}
      {proximos.slice(1).map(a => (
        <div key={a.id} onClick={() => router.push(`/pmo-dashboard/colaboradores/${a.id}`)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
            borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#cbd5e1',
          }}>
          <span style={{ fontSize: 14 }}>🎂</span>
          <span style={{ flex: 1, fontWeight: 500 }}>{a.nome}</span>
          <span style={{ fontSize: 11, color: '#64748b' }}>
            {a.dia}/{String(a.mes).padStart(2, '0')}
          </span>
          {a.unidade && <span style={{ fontSize: 11, color: '#64748b' }}>{a.unidade}</span>}
        </div>
      ))}

      <button onClick={() => router.push('/pmo-dashboard/colaboradores/aniversariantes')}
        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0 0', marginTop: 8 }}>
        Ver todos <ChevronRight size={12} />
      </button>
    </div>
  )
}
