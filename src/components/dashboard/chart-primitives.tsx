'use client'

import { useState, useRef, type ReactNode } from 'react'
import { CORES } from '@/lib/dashboard-tokens'
import { useElementWidth } from '@/hooks/useElementWidth'

/* ==========================================================================
   Primitivos de gráfico em SVG.

   Marcas finas, grade em fio de cabelo, folga de 2px entre segmentos de uma
   barra empilhada e rótulo de valor na ponta — em vez de número em todo ponto.
   Cada gráfico carrega `role="img"` com `aria-label` descritivo, para que a
   leitura por voz não dependa de enxergar a barra.
   ========================================================================== */

/**
 * Tooltip que não re-renderiza o gráfico enquanto o ponteiro anda.
 *
 * A posição vai direto para o estilo do nó — mover o mouse sobre uma barra
 * dispara mousemove a cada pixel, e guardar isso em estado repintava o SVG
 * inteiro dezenas de vezes por segundo. Só o conteúdo é estado, e só muda
 * quando o ponteiro troca de marca.
 */
function useTooltip() {
  const nó = useRef<HTMLDivElement | null>(null)
  const [conteudo, setConteudo] = useState<ReactNode>(null)
  const atual = useRef<ReactNode>(null)

  const posicionar = (e: React.MouseEvent) => {
    const el = nó.current
    if (!el) return
    el.style.left = `${e.clientX}px`
    el.style.top = `${e.clientY - 8}px`
    el.style.opacity = '1'
  }

  const bind = (texto: ReactNode) => ({
    onMouseEnter: (e: React.MouseEvent) => {
      if (atual.current !== texto) { atual.current = texto; setConteudo(texto) }
      posicionar(e)
    },
    onMouseMove: posicionar,
    onMouseLeave: () => {
      atual.current = null
      if (nó.current) nó.current.style.opacity = '0'
      setConteudo(null)
    },
  })

  return { nó, conteudo, bind }
}

function TooltipLayer({ nó, conteudo }: { nó: React.RefObject<HTMLDivElement | null>; conteudo: ReactNode }) {
  return (
    <div
      ref={nó}
      aria-hidden="true"
      style={{
        position: 'fixed', left: 0, top: 0, zIndex: 60, opacity: 0,
        transform: 'translate(-50%, -100%)', pointerEvents: 'none',
        background: '#0b1222', border: `1px solid ${CORES.surface3}`,
        borderRadius: 8, padding: '7px 10px', fontSize: 11.5, lineHeight: 1.45,
        color: CORES.ink, whiteSpace: 'nowrap', boxShadow: '0 8px 26px rgba(0,0,0,0.55)',
      }}
    >
      {conteudo}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

const FONTE_ROTULO = "11px 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"

let contextoDeMedida: CanvasRenderingContext2D | null | undefined

/**
 * Largura real de um texto na fonte do eixo.
 *
 * Estimar por numero de caracteres nao funciona nos dois sentidos: cortar em
 * 26 deixou "Fase de Julgamento das Pr…" vazar 2px, e apertar a estimativa
 * passou a truncar "Atraso de 1 a 15 dias", que cabia inteiro. measureText da
 * o valor exato sem custar um passe de layout.
 *
 * Onde nao ha canvas (jsdom, sem o pacote nativo), cai numa estimativa —
 * o suficiente para os testes decidirem entre "cabe" e "nao cabe".
 */
function medirTexto(texto: string): number {
  if (contextoDeMedida === undefined) {
    contextoDeMedida = typeof document !== 'undefined'
      ? document.createElement('canvas').getContext('2d')
      : null
  }
  if (!contextoDeMedida || typeof contextoDeMedida.measureText !== 'function') {
    return texto.length * 6.2
  }
  contextoDeMedida.font = FONTE_ROTULO
  return contextoDeMedida.measureText(texto).width || texto.length * 6.2
}

export interface LinhaBarra {
  rotulo: string
  /** Valor total da barra. */
  total: number
  /** Parcela do total desenhada com `corAlternativa` (ex.: em atraso). */
  parcela?: number
  /** Cor própria da barra. Sem ela, usa `cor` do gráfico. */
  cor?: string
  /** Texto na ponta da barra. Sem ele, usa o total. */
  valorTexto?: string
  descricao?: ReactNode
  descricaoParcela?: ReactNode
  onClick?: () => void
  selecionada?: boolean
}

interface BarrasProps {
  linhas: LinhaBarra[]
  ariaLabel: string
  /** Largura reservada aos rótulos do eixo Y, em px. */
  larguraRotulo?: number
  altura?: number
  maximo?: number
  marcas?: number[]
  /** Linha de referência (meta) desenhada sobre a grade. */
  referencia?: number
  cor?: string
  corAlternativa?: string
  alturaBarra?: number
  vazio?: string
}

export function BarrasHorizontais({
  linhas,
  ariaLabel,
  larguraRotulo = 132,
  altura = 176,
  maximo,
  marcas,
  referencia,
  cor = CORES.accentDim,
  corAlternativa = '#c8474c',
  alturaBarra = 13,
  vazio = 'Nenhum dado disponível',
}: BarrasProps) {
  const [ref, largura] = useElementWidth<HTMLDivElement>()
  const { nó, conteudo, bind } = useTooltip()

  if (linhas.length === 0) {
    return (
      <div ref={ref} style={{ height: altura, display: 'flex', alignItems: 'center', justifyContent: 'center', color: CORES.ink3, fontSize: 12 }}>
        {vazio}
      </div>
    )
  }

  const rotuloX = Math.min(larguraRotulo, Math.max(70, largura * 0.36))

  /* SVG nao quebra linha nem coloca reticencia sozinho: texto maior que a
     calha vaza pela borda. O corte usa a largura medida do texto, nao um
     numero de caracteres — o nome inteiro segue no tooltip e no aria-label. */
  const espacoDoRotulo = rotuloX - 12
  const caber = (t: string) => {
    if (medirTexto(t) <= espacoDoRotulo) return t
    let corte = t.length
    while (corte > 1 && medirTexto(t.slice(0, corte).trimEnd() + '…') > espacoDoRotulo) corte--
    return t.slice(0, corte).trimEnd() + '…'
  }
  const larguraValor = 46
  const plot = Math.max(40, largura - rotuloX - larguraValor)
  const max = maximo ?? Math.max(...linhas.map(l => l.total), 1)
  const faixaMarcas = marcas?.length ? 16 : 0
  const areaBarras = altura - faixaMarcas
  const faixa = areaBarras / linhas.length
  const hBarra = Math.min(alturaBarra, Math.max(6, faixa - 7))

  return (
    <div ref={ref} style={{ width: '100%' }}>
      <svg width="100%" height={altura} viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label={ariaLabel}>
        {marcas?.map(m => {
          const x = rotuloX + (m / max) * plot
          return (
            <g key={m}>
              <line x1={x} y1={0} x2={x} y2={areaBarras} stroke={CORES.lineSoft} strokeWidth={1} />
              <text x={x} y={altura - 3} fill={CORES.ink3} fontSize={9.5} textAnchor="middle">{m}</text>
            </g>
          )
        })}

        {referencia !== undefined && (
          <line
            x1={rotuloX + (referencia / max) * plot} y1={0}
            x2={rotuloX + (referencia / max) * plot} y2={areaBarras}
            stroke={CORES.ink2} strokeWidth={1.5} opacity={0.55}
          />
        )}

        {linhas.map((l, i) => {
          const cy = i * faixa + faixa / 2
          const larguraTotal = Math.max(2, (l.total / max) * plot)
          const parcela = l.parcela ?? 0
          const larguraParcela = parcela > 0 ? (parcela / max) * plot : 0
          const larguraBase = larguraTotal - larguraParcela
          const interativa = Boolean(l.onClick)

          return (
            <g key={`${l.rotulo}-${i}`}>
              <text
                x={rotuloX - 9} y={cy + 4} fill={l.selecionada ? CORES.ink : CORES.ink2}
                fontSize={11} fontWeight={l.selecionada ? 700 : 400} textAnchor="end"
              >
                {caber(l.rotulo)}
              </text>

              {parcela > 0 ? (
                <>
                  {/* folga de 2px entre os segmentos, em vez de contorno */}
                  <rect
                    x={rotuloX} y={cy - hBarra / 2}
                    width={Math.max(2, larguraBase - 2)} height={hBarra} rx={3}
                    fill={cor} opacity={l.selecionada === false ? 0.45 : 1}
                    style={{ cursor: interativa ? 'pointer' : 'default' }}
                    onClick={l.onClick}
                    {...bind(l.descricao ?? `${l.rotulo}: ${l.total - parcela} no prazo`)}
                  />
                  <rect
                    x={rotuloX + larguraBase} y={cy - hBarra / 2}
                    width={Math.max(2, larguraParcela)} height={hBarra} rx={3}
                    fill={corAlternativa} opacity={l.selecionada === false ? 0.45 : 1}
                    style={{ cursor: interativa ? 'pointer' : 'default' }}
                    onClick={l.onClick}
                    {...bind(l.descricaoParcela ?? `${l.rotulo}: ${parcela} em atraso`)}
                  />
                </>
              ) : (
                <rect
                  x={rotuloX} y={cy - hBarra / 2}
                  width={larguraTotal} height={hBarra} rx={3}
                  fill={l.cor || cor} opacity={l.selecionada === false ? 0.45 : 1}
                  style={{ cursor: interativa ? 'pointer' : 'default' }}
                  onClick={l.onClick}
                  {...bind(l.descricao ?? `${l.rotulo}: ${l.total}`)}
                />
              )}

              <text
                x={rotuloX + larguraTotal + 8} y={cy + 4}
                fill={CORES.ink} fontSize={11} fontWeight={700}
              >
                {l.valorTexto ?? l.total}
              </text>
            </g>
          )
        })}
      </svg>
      <TooltipLayer nó={nó} conteudo={conteudo} />
    </div>
  )
}

/* -------------------------------------------------------------------------- */

export interface Coluna {
  rotulo: string
  total: number
  descricao?: ReactNode
}

export function Colunas({
  colunas,
  ariaLabel,
  altura = 200,
  vazio = 'Nenhum dado disponível',
}: {
  colunas: Coluna[]
  ariaLabel: string
  altura?: number
  vazio?: string
}) {
  const [ref, largura] = useElementWidth<HTMLDivElement>()
  const { nó, conteudo, bind } = useTooltip()

  if (colunas.length === 0) {
    return (
      <div ref={ref} style={{ height: altura, display: 'flex', alignItems: 'center', justifyContent: 'center', color: CORES.ink3, fontSize: 12 }}>
        {vazio}
      </div>
    )
  }

  const padEsq = 28
  const padBaixo = 24
  const padTopo = 18
  const alturaPlot = altura - padBaixo - padTopo
  const larguraPlot = Math.max(40, largura - padEsq - 10)
  const max = Math.max(...colunas.map(c => c.total), 1) + 1
  const faixa = larguraPlot / colunas.length
  const larguraBarra = Math.min(40, Math.max(8, faixa - 16))
  const marcas = [0, Math.round(max / 2), max]

  return (
    <div ref={ref} style={{ width: '100%' }}>
      <svg width="100%" height={altura} viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label={ariaLabel}>
        {marcas.map(m => {
          const y = padTopo + alturaPlot - (m / max) * alturaPlot
          return (
            <g key={m}>
              <line x1={padEsq} y1={y} x2={largura - 10} y2={y} stroke={CORES.lineSoft} strokeWidth={1} />
              <text x={padEsq - 7} y={y + 3.5} fill={CORES.ink3} fontSize={9.5} textAnchor="end">{m}</text>
            </g>
          )
        })}

        {colunas.map((c, i) => {
          const cx = padEsq + faixa * i + faixa / 2
          const h = Math.max(2, (c.total / max) * alturaPlot)
          const ultima = i === colunas.length - 1
          return (
            <g key={`${c.rotulo}-${i}`}>
              <rect
                x={cx - larguraBarra / 2} y={padTopo + alturaPlot - h}
                width={larguraBarra} height={h} rx={3}
                fill={ultima ? CORES.accent : CORES.accentDim} opacity={ultima ? 1 : 0.62}
                {...bind(c.descricao ?? `${c.rotulo}: ${c.total}`)}
              />
              <text x={cx} y={altura - 8} fill={CORES.ink3} fontSize={10} textAnchor="middle">{c.rotulo}</text>
              {/* rótulo direto só no ponto que importa: o mais recente */}
              {ultima && (
                <text x={cx} y={padTopo + alturaPlot - h - 6} fill={CORES.ink} fontSize={11} fontWeight={700} textAnchor="middle">
                  {c.total}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <TooltipLayer nó={nó} conteudo={conteudo} />
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/** Faixa de tendência do indicador: área, linha e ponta enfatizada. */
export function Sparkline({ valores, cor, ariaLabel }: { valores: number[]; cor: string; ariaLabel: string }) {
  if (valores.length < 2) return null

  const w = 240
  const h = 30
  const pad = 3
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const amplitude = max - min || 1
  const x = (i: number) => (i / (valores.length - 1)) * w
  const y = (v: number) => h - pad - ((v - min) / amplitude) * (h - pad * 2)
  const pontos = valores.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const id = `spark-${cor.replace('#', '')}`

  return (
    <svg
      width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"
      role="img" aria-label={ariaLabel} style={{ display: 'block', marginTop: 8 }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={cor} stopOpacity={0.3} />
          <stop offset="1" stopColor={cor} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pontos} ${w},${h}`} fill={`url(#${id})`} />
      <polyline
        points={pontos} fill="none" stroke={cor} strokeWidth={2}
        strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={x(valores.length - 1)} cy={y(valores[valores.length - 1])} r={2.6}
        fill={cor} stroke={CORES.surface} strokeWidth={1.5}
      />
    </svg>
  )
}

/* -------------------------------------------------------------------------- */

export function Legenda({ itens }: { itens: { cor: string; texto: string; barra?: boolean }[] }) {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: 11.5, color: CORES.ink2, marginTop: 10 }}>
      {itens.map(i => (
        <span key={i.texto} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i
            aria-hidden="true"
            style={{
              width: i.barra ? 2 : 9, height: i.barra ? 12 : 9,
              borderRadius: i.barra ? 1 : 2, background: i.cor, flexShrink: 0,
            }}
          />
          {i.texto}
        </span>
      ))}
    </div>
  )
}

/** Cartão de gráfico: título, meta à direita e corpo. */
export function PainelGrafico({
  titulo, meta, children, acao,
}: {
  titulo: string
  meta?: ReactNode
  acao?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      style={{
        background: CORES.surface, border: `1px solid ${CORES.lineSoft}`,
        borderRadius: 12, padding: '15px 17px 13px', minWidth: 0,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <h2 style={{ fontSize: 12.5, fontWeight: 700, color: CORES.ink, margin: 0 }}>{titulo}</h2>
        {meta && <span style={{ fontSize: 11, color: CORES.ink3 }}>{meta}</span>}
      </header>
      {acao}
      {children}
    </section>
  )
}
