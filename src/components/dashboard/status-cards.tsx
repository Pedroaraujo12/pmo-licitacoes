'use client'

import { formatBRL } from '@/lib/utils'
import { CORES, corDoStatus } from '@/lib/dashboard-tokens'

/* ==========================================================================
   Valores por status.

   Três correções em relação à versão anterior:

   1. "Total da carteira" saiu da grade. Era o sexto card, irmão visual dos
      cinco status, misturando a parte com o todo — e usava exatamente o mesmo
      azul de "Em andamento". Agora é uma faixa própria, com forma distinta.
   2. O rótulo dizia "47% do valor estimado" quando o número era a participação
      na carteira. Passou a dizer o que é.
   3. Valor zero deixa de ser afirmado como R$ 0,00 quando na verdade é ausência
      de estimativa — zero é uma afirmação, ausência não é.
   ========================================================================== */

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
  taxaHomologacao: number
  selected?: string | null
  onSelect?: (status: string | null) => void
}

function valorOuAusencia(valor: number, temEstimativa: boolean) {
  if (valor > 0) return formatBRL(valor)
  return temEstimativa ? formatBRL(0) : '— não informado'
}

export default function StatusCards({
  porStatus, totalEstimado, totalHomologado, totalProcessos, economia, taxaHomologacao, selected, onSelect,
}: Props) {
  const base = totalEstimado > 0 ? totalEstimado : 1

  return (
    <section style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 11 }}>
        <h2 style={{
          margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.11em',
          textTransform: 'uppercase', color: CORES.ink2,
        }}>Valores por status</h2>
        {onSelect && (
          <span style={{ fontSize: 11.5, color: CORES.ink3 }}>
            clique num card para filtrar o fluxo · clique de novo para limpar
          </span>
        )}
      </div>

      {/* cinco status em cinco colunas: partes iguais, altura igual */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {porStatus.map(s => {
          const nome = s.status || 'Sem status'
          const chave = s.status || ''
          const cor = corDoStatus(nome)
          const participacao = (s.valor_estimado / base) * 100
          const selecionado = selected === chave
          const temEstimativa = s.valor_estimado > 0

          return (
            <button
              key={s.status || 'null'}
              type="button"
              aria-pressed={selecionado}
              onClick={onSelect ? () => onSelect(selecionado ? null : chave) : undefined}
              disabled={!onSelect}
              style={{
                display: 'flex', flexDirection: 'column', gap: 9, textAlign: 'left',
                background: selecionado ? CORES.surface2 : CORES.surface,
                border: `1px solid ${selecionado ? CORES.surface3 : CORES.lineSoft}`,
                borderTop: `2px solid ${cor}`,
                borderRadius: 12, padding: '13px 14px',
                cursor: onSelect ? 'pointer' : 'default',
                font: 'inherit', color: 'inherit', minWidth: 0,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: CORES.ink, minWidth: 0 }}>
                  <i aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: cor, flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
                </span>
                <span style={{ fontSize: 19, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: CORES.ink }}>
                  {s.total}
                </span>
              </span>

              <span style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ color: CORES.ink3 }}>Estimado</span>
                  <span style={{ fontWeight: 600, color: CORES.ink2 }}>{valorOuAusencia(s.valor_estimado, temEstimativa)}</span>
                </span>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ color: CORES.ink3 }}>Homologado</span>
                  <span style={{ fontWeight: 600, color: CORES.ink2 }}>{valorOuAusencia(s.valor_homologado, temEstimativa)}</span>
                </span>
              </span>

              <span style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 'auto' }}>
                <span style={{ height: 4, borderRadius: 2, background: CORES.surface3, overflow: 'hidden', display: 'block' }}>
                  <i style={{ display: 'block', height: '100%', width: `${participacao.toFixed(1)}%`, borderRadius: 2, background: cor }} />
                </span>
                <span style={{ fontSize: 10.5, color: CORES.ink3 }}>
                  {participacao.toFixed(0)}% da carteira
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {/* o todo, com forma própria — não disputa mais a leitura com as partes */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap',
          marginTop: 12, padding: '13px 18px',
          background: CORES.surface2, border: `1px solid ${CORES.line}`, borderRadius: 12,
        }}
      >
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', color: CORES.ink3, textTransform: 'uppercase' }}>
          Total da carteira
        </span>
        <Item valor={String(totalProcessos)} apoio="processos" />
        <Divisor />
        <Item valor={formatBRL(totalEstimado)} apoio="estimado" />
        <Divisor />
        <Item
          valor={formatBRL(totalHomologado)}
          apoio={`homologado · ${taxaHomologacao.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
        />
        <Divisor />
        <Item valor={formatBRL(economia)} apoio="economia" destaque />

        <div style={{ flex: '1 1 240px', minWidth: 180, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div
            role="img"
            aria-label={`Composição do valor estimado por status: ${porStatus
              .filter(s => s.valor_estimado > 0)
              .map(s => `${s.status || 'Sem status'}, ${((s.valor_estimado / base) * 100).toFixed(0)} por cento`)
              .join('; ')}.`}
            style={{ display: 'flex', height: 9, borderRadius: 3, overflow: 'hidden', gap: 2, background: CORES.surface }}
          >
            {porStatus.filter(s => s.valor_estimado > 0).map(s => (
              <i
                key={s.status || 'null'}
                title={`${s.status || 'Sem status'} · ${formatBRL(s.valor_estimado)}`}
                style={{ display: 'block', height: '100%', width: `${(s.valor_estimado / base) * 100}%`, background: corDoStatus(s.status) }}
              />
            ))}
          </div>
          <span style={{ fontSize: 10.5, color: CORES.ink3 }}>composição do valor estimado</span>
        </div>
      </div>
    </section>
  )
}

function Item({ valor, apoio, destaque }: { valor: string; apoio: string; destaque?: boolean }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <b style={{
        fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em',
        fontVariantNumeric: 'tabular-nums', color: destaque ? CORES.good : CORES.ink,
      }}>{valor}</b>
      <small style={{ fontSize: 10.5, color: CORES.ink3 }}>{apoio}</small>
    </span>
  )
}

function Divisor() {
  return <span aria-hidden="true" style={{ width: 1, alignSelf: 'stretch', background: CORES.line }} />
}
