'use client'

import { CORES } from '@/lib/dashboard-tokens'
import { ATIVIDADE_NAO_DECLARADA, type ContagemAtividade } from '@/lib/dashboard-metrics'
import { BarrasHorizontais, PainelGrafico, type LinhaBarra } from './chart-primitives'

/* ==========================================================================
   Processos por atividade atual — gráfico que também é filtro.

   A carteira tem 26 atividades distintas e cauda longa: 14 com um processo só.
   Todas aparecem, porque cortar a cauda tornaria esses processos inalcançáveis
   pelo filtro. O que segura o espaço é a rolagem, não a omissão.

   "Não declarada" fica em cinza e por último entre os iguais: é ausência de
   dado, não uma etapa do rito — mas é filtrável, porque encontrar justamente
   esses processos é o primeiro passo para preenchê-los.
   ========================================================================== */

const ALTURA_LINHA = 21
const ALTURA_MAXIMA = 300

interface Props {
  atividades: ContagemAtividade[]
  selecionada: string | null
  onSelecionar: (atividade: string | null) => void
  carregando?: boolean
}

export default function AtividadesChart({ atividades, selecionada, onSelecionar, carregando }: Props) {
  const total = atividades.reduce((s, a) => s + a.total, 0)
  const maximo = Math.max(...atividades.map(a => a.total), 1)

  const passo = maximo <= 6 ? 1 : maximo <= 12 ? 2 : Math.ceil(maximo / 6)
  const marcas: number[] = []
  for (let m = 0; m <= maximo; m += passo) marcas.push(m)

  const linhas: LinhaBarra[] = atividades.map(a => ({
    rotulo: a.atividade,
    total: a.total,
    cor: a.declarada ? CORES.accentDim : CORES.ink3,
    selecionada: selecionada === null ? undefined : selecionada === a.atividade,
    onClick: () => onSelecionar(selecionada === a.atividade ? null : a.atividade),
    descricao: (
      <>
        <b>{a.atividade}</b>
        <br />
        {a.total} processo{a.total === 1 ? '' : 's'} · clique para filtrar o fluxo
      </>
    ),
  }))

  const alturaConteudo = Math.max(120, atividades.length * ALTURA_LINHA + 20)
  const precisaRolar = alturaConteudo > ALTURA_MAXIMA

  return (
    <PainelGrafico
      titulo="Processos por atividade atual"
      meta={carregando
        ? 'carregando…'
        : `${total} processo${total === 1 ? '' : 's'} em ${atividades.length} atividade${atividades.length === 1 ? '' : 's'}`}
    >
      <div
        style={{
          maxHeight: precisaRolar ? ALTURA_MAXIMA : undefined,
          overflowY: precisaRolar ? 'auto' : undefined,
          /* espaço para a barra de rolagem não cobrir o rótulo de valor */
          paddingRight: precisaRolar ? 6 : undefined,
        }}
      >
        <BarrasHorizontais
          linhas={linhas}
          larguraRotulo={260}
          altura={alturaConteudo}
          alturaBarra={12}
          marcas={marcas}
          maximo={maximo}
          ariaLabel={
            atividades.length
              ? `Processos por atividade atual: ${atividades.map(a => `${a.atividade}, ${a.total}`).join('; ')}.`
              : 'Nenhum processo para distribuir por atividade.'
          }
          vazio={carregando ? 'Carregando…' : 'Nenhum processo na carteira'}
        />
      </div>

      <p style={{ margin: '10px 0 0', fontSize: 10.5, color: CORES.ink3 }}>
        Clique numa barra para filtrar o fluxo de execução
        {atividades.some(a => a.atividade === ATIVIDADE_NAO_DECLARADA) &&
          ' — a barra cinza reúne os processos sem atividade declarada'}.
      </p>
    </PainelGrafico>
  )
}
