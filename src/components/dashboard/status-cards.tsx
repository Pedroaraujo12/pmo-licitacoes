'use client'

import { formatBRL } from '@/lib/utils'

export interface StatusValue {
  status: string | null
  total: number
  valor_estimado: number
  valor_homologado: number
}

interface Props {
  porStatus: StatusValue[]
  totalEstimado: number
  totalHomologado: number
  totalProcessos: number
  economia: number
  selected?: string | null
  onSelect?: (status: string | null) => void
}

const STATUS_COLORS: Record<string, { dot: string; bar: string; text: string }> = {
  'Em andamento': { dot: '#38bdf8', bar: 'rgba(56,189,248,0.45)', text: '#7dd3fc' },
  'Concluído': { dot: '#34d399', bar: 'rgba(52,211,153,0.45)', text: '#6ee7b7' },
  'Homologado': { dot: '#34d399', bar: 'rgba(52,211,153,0.45)', text: '#6ee7b7' },
  'Não recebido': { dot: '#94a3b8', bar: 'rgba(148,163,184,0.4)', text: '#cbd5e1' },
  'Cancelado': { dot: '#f87171', bar: 'rgba(248,113,113,0.45)', text: '#fca5a5' },
  'Devolvido': { dot: '#a78bfa', bar: 'rgba(167,139,250,0.45)', text: '#c4b5fd' },
  'Suspenso': { dot: '#fbbf24', bar: 'rgba(251,191,36,0.45)', text: '#fcd34d' },
  'Rascunho': { dot: '#cbd5e1', bar: 'rgba(203,213,225,0.35)', text: '#e2e8f0' },
}

function colorFor(status: string) {
  return STATUS_COLORS[status] || { dot: '#94a3b8', bar: 'rgba(148,163,184,0.4)', text: '#cbd5e1' }
}

export default function StatusCards({ porStatus, totalEstimado, totalHomologado, totalProcessos, economia, selected, onSelect }: Props) {
  const renda = totalEstimado > 0 ? totalEstimado : 1

  return (
    <div className="mb-8">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <h2 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-0">Valores por Status</h2>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
        <span className="text-[9px] font-bold bg-slate-800 px-2 py-0.5 rounded-full text-slate-500">
          {totalProcessos} processos
        </span>
        {onSelect && (
          <span className="text-[9px] font-medium text-slate-500">
            {selected ? 'Clique de novo no card ou no total para limpar' : 'Clique em um card para filtrar o fluxo'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {porStatus.map(s => {
          const nome = s.status || 'Sem status'
          const chave = s.status || ''
          const c = colorFor(nome)
          const share = Math.round((s.valor_estimado / renda) * 100)
          const economizado = s.valor_estimado - s.valor_homologado
          const isSelected = selected === chave
          return (
            <div
              key={s.status || 'null'}
              onClick={onSelect ? () => onSelect(isSelected ? null : chave) : undefined}
              style={{
                background: isSelected ? 'rgba(30,41,59,0.9)' : 'rgba(30,41,59,0.7)',
                backdropFilter: 'blur(12px)',
                borderRadius: 16,
                border: isSelected ? `1px solid ${c.dot}` : '1px solid rgba(255,255,255,0.06)',
                boxShadow: isSelected ? `0 0 0 1px ${c.dot}` : undefined,
                padding: '16px 18px',
                cursor: onSelect ? 'pointer' : 'default',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: c.dot, flexShrink: 0 }} />
                <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 13, flex: 1 }}>{nome}</span>
                <span style={{
                  fontSize: 17, fontWeight: 800, color: c.text,
                  background: 'rgba(15,23,42,0.5)', borderRadius: 8, padding: '1px 10px',
                }}>{s.total}</span>
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                  <span style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Estimado</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(s.valor_estimado)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Homologado</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(s.valor_homologado)}</span>
                </div>
              </div>

              <div style={{ height: 5, borderRadius: 99, background: 'rgba(148,163,184,0.15)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${share}%`, borderRadius: 99, background: c.bar }} />
              </div>
              <div style={{ marginTop: 6, fontSize: 9, color: '#64748b' }}>
                {share}% do valor estimado
              </div>

              {(nome === 'Concluído' || nome === 'Homologado') && economizado > 0 && (
                <div style={{
                  marginTop: 10, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)',
                  borderRadius: 8, padding: '6px 8px', fontSize: 10, color: '#6ee7b7', fontWeight: 700,
                }}>
                  Economia · {formatBRL(economizado)}
                </div>
              )}
            </div>
          )
        })}

        <div onClick={onSelect ? () => onSelect(null) : undefined} style={{
          background: 'linear-gradient(135deg, rgba(56,189,248,0.12), rgba(34,211,238,0.06))',
          borderRadius: 16, border: selected ? '1px solid #38bdf8' : '1px solid rgba(56,189,248,0.25)',
          boxShadow: selected ? '0 0 0 1px #38bdf8' : undefined,
          padding: '16px 18px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          cursor: onSelect ? 'pointer' : 'default',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: '#38bdf8', flexShrink: 0 }} />
            <span style={{ fontWeight: 800, color: '#e0f2fe', fontSize: 13, flex: 1 }}>Total da carteira</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: '#7dd3fc', background: 'rgba(15,23,42,0.5)', borderRadius: 8, padding: '1px 10px' }}>{totalProcessos}</span>
          </div>
          <div style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Estimado</span>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(totalEstimado)}</div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Homologado</span>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(totalHomologado)}</div>
          </div>
          <div style={{
            background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)',
            borderRadius: 8, padding: '6px 8px', fontSize: 12, color: '#6ee7b7', fontWeight: 700,
          }}>
            Economia · {formatBRL(economia)}
          </div>
        </div>
      </div>
    </div>
  )
}