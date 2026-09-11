'use client'

import { CORES } from '@/lib/dashboard-tokens'
import type { CargaResponsavel, ContagemAtividade } from '@/lib/dashboard-metrics'
import AtividadesChart from './atividades-chart'
import { BarrasHorizontais, Legenda, PainelGrafico, type LinhaBarra } from './chart-primitives'

/* ==========================================================================
   Carga e tendência.

   O gráfico por responsável usava um degradê azul → verde → roxo → marrom →
   cinza que só repetia a ordenação das barras. Agora a cor codifica atraso, o
   valor aparece na ponta e o eixo anda de um em um — meio processo não existe.

   Ao lado entra a única dimensão que faltava por inteiro: o tempo.
   ========================================================================== */

interface Props {
  porResponsavel: CargaResponsavel[]
  atividades: ContagemAtividade[]
  atividadeSelecionada: string | null
  onSelecionarAtividade: (atividade: string | null) => void
  responsavelSelecionado: string | null
  onSelecionarResponsavel: (nome: string | null) => void
  carregando?: boolean
}

export default function CargaETendencia({
  porResponsavel, atividades, atividadeSelecionada, onSelecionarAtividade,
  responsavelSelecionado, onSelecionarResponsavel, carregando,
}: Props) {
  const totalEmAndamento = porResponsavel.reduce((s, r) => s + r.total, 0)

  /* Todo mundo com processo em andamento aparece. A altura acompanha o tamanho
     da equipe em vez de espremer as barras num quadro fixo — e se algum dia
     passar de VISIVEIS, o corte e dito na tela, nao escondido. */
  const VISIVEIS = 20
  const mostrados = porResponsavel.slice(0, VISIVEIS)
  const ocultos = porResponsavel.length - mostrados.length
  const alturaCarga = Math.max(176, mostrados.length * 21 + 20)
  const maxCarga = Math.max(...porResponsavel.map(r => r.total), 1)
  const marcasCarga: number[] = []
  const passo = maxCarga <= 6 ? 1 : Math.ceil(maxCarga / 6)
  for (let m = 0; m <= maxCarga; m += passo) marcasCarga.push(m)

  const linhas: LinhaBarra[] = mostrados.map(r => ({
    rotulo: r.nome,
    total: r.total,
    parcela: r.atrasados,
    selecionada: responsavelSelecionado === null ? undefined : responsavelSelecionado === r.nome,
    onClick: () => onSelecionarResponsavel(responsavelSelecionado === r.nome ? null : r.nome),
    descricao: (
      <>
        <b>{r.nome}</b>
        <br />
        {r.total - r.atrasados} no prazo · clique para filtrar
      </>
    ),
    descricaoParcela: (
      <>
        <b>{r.nome}</b>
        <br />
        {r.atrasados} em atraso · clique para filtrar
      </>
    ),
  }))

  return (
    <section style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 11 }}>
        <h2 style={{
          margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.11em',
          textTransform: 'uppercase', color: CORES.ink2,
        }}>Carga e tendência</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PainelGrafico
          titulo="Em andamento por responsável"
          meta={carregando
            ? 'carregando…'
            : `${totalEmAndamento} processo${totalEmAndamento === 1 ? '' : 's'} · ${porResponsavel.length} responsáve${porResponsavel.length === 1 ? 'l' : 'is'}`}
        >
          <BarrasHorizontais
            linhas={linhas}
            larguraRotulo={112}
            altura={alturaCarga}
            alturaBarra={12}
            marcas={marcasCarga}
            maximo={maxCarga}
            cor={CORES.accentDim}
            corAlternativa="#c8474c"
            ariaLabel={
              mostrados.length
                ? `Processos em andamento por responsável, com a parcela em atraso destacada: ${mostrados
                    .map(r => `${r.nome}, ${r.total}${r.atrasados ? `, sendo ${r.atrasados} em atraso` : ''}`)
                    .join('; ')}.`
                : 'Nenhum processo em andamento.'
            }
            vazio={carregando ? 'Carregando…' : 'Nenhum processo em andamento'}
          />
          <Legenda
            itens={[
              { cor: CORES.accentDim, texto: 'No prazo' },
              { cor: '#c8474c', texto: 'Em atraso' },
            ]}
          />
          {ocultos > 0 && (
            <p style={{ margin: '8px 0 0', fontSize: 10.5, color: CORES.ink3 }}>
              +{ocultos} responsáve{ocultos === 1 ? 'l' : 'is'} com menos processos, fora do gráfico.
            </p>
          )}
        </PainelGrafico>

        <AtividadesChart
          atividades={atividades}
          selecionada={atividadeSelecionada}
          onSelecionar={onSelecionarAtividade}
          carregando={carregando}
        />
      </div>
    </section>
  )
}
