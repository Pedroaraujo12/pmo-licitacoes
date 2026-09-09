'use client'

import { formatBRL } from '@/lib/utils'
import { CORES } from '@/lib/dashboard-tokens'

/* ==========================================================================
   Indicadores da carteira.

   O trio mudou: a contagem bruta de processos e o valor total saíram (os dois
   já aparecem inteiros na faixa "Total da carteira") e entraram atraso e taxa
   de homologação. Atraso é o alerta que abre a tela — não podia continuar como
   legenda de 9px embaixo de outro número.
   ========================================================================== */

interface Props {
  atrasados: number
  total: number
  taxaHomologacao: number
  estimadoTotal: number
  homologadoTotal: number
  economia: number
  economiaPercentual: number
  concluidos: number
  onVerAtrasados?: () => void
}

const pct = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function Cartao({
  rotulo, valor, unidade, apoio, critico, acao,
}: {
  rotulo: string
  valor: string
  unidade?: string
  apoio: string
  critico?: boolean
  acao?: React.ReactNode
}) {
  return (
    <article
      style={{
        background: CORES.surface,
        border: `1px solid ${critico ? '#4a2530' : CORES.lineSoft}`,
        borderRadius: 12, padding: '15px 17px 13px',
        display: 'flex', flexDirection: 'column', minWidth: 0,
      }}
    >
      <p style={{
        margin: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em',
        color: CORES.ink3, textTransform: 'uppercase',
      }}>{rotulo}</p>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9, marginTop: 4 }}>
        <span style={{
          fontSize: 31, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums', color: critico ? CORES.critical : CORES.ink,
        }}>{valor}</span>
        {unidade && (
          <span style={{ fontSize: 15, fontWeight: 700, color: CORES.ink2, paddingBottom: 3 }}>{unidade}</span>
        )}
      </div>

      <p style={{ margin: '9px 0 0', fontSize: 11.5, color: CORES.ink3, fontVariantNumeric: 'tabular-nums' }}>
        {apoio}
      </p>
      {acao}
    </article>
  )
}

export default function KpiCards({
  atrasados, total, taxaHomologacao, estimadoTotal, homologadoTotal,
  economia, economiaPercentual, concluidos, onVerAtrasados,
}: Props) {
  const participacaoAtraso = total > 0 ? (atrasados / total) * 100 : 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
      <Cartao
        rotulo="Processos em atraso"
        valor={String(atrasados)}
        unidade={`de ${total}`}
        apoio={`${pct(participacaoAtraso)}% da carteira · ${total - atrasados} no prazo`}
        critico
        acao={onVerAtrasados && atrasados > 0 ? (
          <button
            type="button"
            onClick={onVerAtrasados}
            style={{
              marginTop: 12, alignSelf: 'flex-start', background: 'transparent',
              border: `1px solid ${CORES.line}`, borderRadius: 8, padding: '5px 10px',
              color: CORES.ink2, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Ver no fluxo
          </button>
        ) : undefined}
      />

      <Cartao
        rotulo="Taxa de homologação"
        valor={pct(taxaHomologacao)}
        unidade="%"
        apoio={`${formatBRL(homologadoTotal)} de ${formatBRL(estimadoTotal)}`}
      />

      <Cartao
        rotulo="Economia sobre o estimado"
        valor={pct(economiaPercentual)}
        unidade="%"
        apoio={`${formatBRL(economia)} em ${concluidos} concluído${concluidos === 1 ? '' : 's'}`}
      />
    </div>
  )
}
