'use client'

import { X } from 'lucide-react'
import { CORES } from '@/lib/dashboard-tokens'

/* ==========================================================================
   Chips do que está filtrando.

   Antes havia dois sistemas desconectados: os cards de status filtravam de um
   lado, a barra de busca e os selects do outro, e o que estava ativo aparecia
   como texto solto de 10px em três cores diferentes. Agora todo filtro — venha
   do card, do gráfico ou do select — vira um chip removível no mesmo lugar.
   ========================================================================== */

export interface Chip {
  chave: string
  rotulo: string
  onRemove: () => void
}

export default function FilterChips({ chips, onLimparTudo }: { chips: Chip[]; onLimparTudo: () => void }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap',
        padding: '11px 14px', borderTop: `1px solid ${CORES.lineSoft}`,
      }}
    >
      {chips.length === 0 ? (
        <span style={{ fontSize: 11.5, color: CORES.ink3 }}>
          Nenhum filtro ativo — a tabela mostra a carteira completa.
        </span>
      ) : (
        chips.map(c => (
          <span
            key={c.chave}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: CORES.accentWash, border: `1px solid ${CORES.accentDim}`,
              color: CORES.ink, borderRadius: 999, padding: '4px 5px 4px 11px',
              fontSize: 11.5, fontWeight: 600,
            }}
          >
            {c.rotulo}
            <button
              type="button"
              onClick={c.onRemove}
              aria-label={`Remover filtro ${c.rotulo}`}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: 'none', border: 0, color: CORES.ink2, cursor: 'pointer',
                padding: 3, borderRadius: 4, lineHeight: 1,
              }}
            >
              <X size={12} />
            </button>
          </span>
        ))
      )}

      {chips.length > 0 && (
        <button
          type="button"
          onClick={onLimparTudo}
          style={{
            marginLeft: 'auto', background: CORES.surface2, border: `1px solid ${CORES.line}`,
            color: CORES.ink2, borderRadius: 8, padding: '6px 11px',
            fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Limpar tudo
        </button>
      )}
    </div>
  )
}
