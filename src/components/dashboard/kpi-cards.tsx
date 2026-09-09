'use client'

import { formatBRL } from '@/lib/utils'
import { CORES } from '@/lib/dashboard-tokens'
import { Sparkline } from './chart-primitives'

/* ==========================================================================
   Indicadores da carteira.

   O trio mudou: a contagem bruta de processos e o valor total saíram (os dois
   já aparecem inteiros na faixa "Total da carteira") e entraram atraso e taxa
   de homologação. Atraso é o alerta que abre a tela — não podia continuar como
   legenda de 9px embaixo de outro número.
   ========================================================================== */

export interface KpiSerie {
  /** Série histórica do indicador; quando ausente, o cartão vai sem faixa. */
  valores?: number[]
}

interface Props {
  atrasados: number
  total: number
  taxaHomologacao: number
  estimadoTotal: number
  homologadoTotal: number
  economia: number
  economiaPercentual: number
  concluidos: number
  serieAtrasados?: number[]
  serieHomologacao?: number[]
  serieEconomia?: number[]
  onVerAtrasados?: () => void
}

const pct = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function variacao(serie: number[] | undefined, casas = 0): { texto: string; sentido: 'sobe' | 'desce' } | null {
  if (!serie || serie.length < 2) return null
  const delta = serie[serie.length - 1] - serie[serie.length - 2]
  if (Math.abs(delta) < (casas ? 0.05 : 0.5)) return null
  const abs = Math.abs(delta).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
  return { texto: abs, sentido: delta > 0 ? 'sobe' : 'desce' }
}

function Cartao({
  rotulo, valor, unidade, apoio, delta, deltaBom, deltaTitulo, serie, corSerie, critico, acao, ariaSerie,
}: {
  rotulo: string
  valor: string
  unidade?: string
  apoio: string
  delta?: { texto: string; sentido: 'sobe' | 'desce' } | null
  deltaBom?: boolean
  deltaTitulo?: string
  serie?: number[]
  corSerie: string
  critico?: boolean
  acao?: React.ReactNode
  ariaSerie: string
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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 9 }}>
        <span style={{ fontSize: 11.5, color: CORES.ink3, fontVariantNumeric: 'tabular-nums' }}>{apoio}</span>
        {delta && (
          <span
            title={deltaTitulo}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5, fontWeight: 700,
              color: deltaBom ? CORES.good : CORES.critical, whiteSpace: 'nowrap',
            }}
          >
            {delta.sentido === 'sobe' ? '▲' : '▼'} {delta.texto}
          </span>
        )}
      </div>

      {serie && serie.length > 1 && <Sparkline valores={serie} cor={corSerie} ariaLabel={ariaSerie} />}
      {acao}
    </article>
  )
}

export default function KpiCards({
  atrasados, total, taxaHomologacao, estimadoTotal, homologadoTotal,
  economia, economiaPercentual, concluidos,
  serieAtrasados, serieHomologacao, serieEconomia, onVerAtrasados,
}: Props) {
  const participacaoAtraso = total > 0 ? (atrasados / total) * 100 : 0
  const deltaAtraso = variacao(serieAtrasados)
  const deltaHomologacao = variacao(serieHomologacao, 1)
  const deltaEconomia = variacao(serieEconomia, 1)

  return (
    <div
      /* três indicadores em três colunas — a grade de quatro deixava uma
         coluna inteira vazia na faixa mais valiosa da tela */
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5"
    >
      <Cartao
        rotulo="Processos em atraso"
        valor={String(atrasados)}
        unidade={`de ${total}`}
        apoio={`${pct(participacaoAtraso)}% da carteira · ${total - atrasados} no prazo`}
        delta={deltaAtraso}
        deltaBom={deltaAtraso?.sentido === 'desce'}
        deltaTitulo="Comparado ao mês anterior"
        serie={serieAtrasados}
        corSerie={CORES.critical}
        critico
        ariaSerie="Evolução mensal dos processos em atraso"
        acao={onVerAtrasados && atrasados > 0 ? (
          <button
            type="button"
            onClick={onVerAtrasados}
            style={{
              marginTop: 10, alignSelf: 'flex-start', background: 'transparent',
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
        delta={deltaHomologacao}
        deltaBom={deltaHomologacao?.sentido === 'sobe'}
        deltaTitulo="Comparado ao mês anterior"
        serie={serieHomologacao}
        corSerie={CORES.good}
        ariaSerie="Evolução mensal da taxa de homologação"
      />

      <Cartao
        rotulo="Economia sobre o estimado"
        valor={pct(economiaPercentual)}
        unidade="%"
        apoio={`${formatBRL(economia)} em ${concluidos} concluído${concluidos === 1 ? '' : 's'}`}
        delta={deltaEconomia}
        deltaBom={deltaEconomia?.sentido === 'sobe'}
        deltaTitulo="Comparado ao mês anterior"
        serie={serieEconomia}
        corSerie={CORES.good}
        ariaSerie="Evolução mensal da economia percentual"
      />
    </div>
  )
}
