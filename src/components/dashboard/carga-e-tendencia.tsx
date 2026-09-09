'use client'

import { CORES } from '@/lib/dashboard-tokens'
import type { CargaResponsavel, PontoMensal } from '@/lib/dashboard-metrics'
import { BarrasHorizontais, Colunas, Legenda, PainelGrafico, type LinhaBarra } from './chart-primitives'

/* ==========================================================================
   Carga e tendência.

   O gráfico por responsável usava um degradê azul → verde → roxo → marrom →
   cinza que só repetia a ordenação das barras. Agora a cor codifica atraso, o
   valor aparece na ponta e o eixo anda de um em um — meio processo não existe.

   Ao lado entra a única dimensão que faltava por inteiro: o tempo.
   ========================================================================== */

interface Props {
  porResponsavel: CargaResponsavel[]
  concluidosPorMes: PontoMensal[]
  responsavelSelecionado: string | null
  onSelecionarResponsavel: (nome: string | null) => void
  carregando?: boolean
}

export default function CargaETendencia({
  porResponsavel, concluidosPorMes, responsavelSelecionado, onSelecionarResponsavel, carregando,
}: Props) {
  const totalEmAndamento = porResponsavel.reduce((s, r) => s + r.total, 0)
  const totalConcluidos = concluidosPorMes.reduce((s, p) => s + p.total, 0)
  const maxCarga = Math.max(...porResponsavel.map(r => r.total), 1)
  const marcasCarga: number[] = []
  const passo = maxCarga <= 6 ? 1 : Math.ceil(maxCarga / 6)
  for (let m = 0; m <= maxCarga; m += passo) marcasCarga.push(m)

  const linhas: LinhaBarra[] = porResponsavel.map(r => ({
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
          meta={carregando ? 'carregando…' : `${totalEmAndamento} processo${totalEmAndamento === 1 ? '' : 's'}`}
        >
          <BarrasHorizontais
            linhas={linhas}
            larguraRotulo={112}
            altura={212}
            alturaBarra={12}
            marcas={marcasCarga}
            maximo={maxCarga}
            cor={CORES.accentDim}
            corAlternativa="#c8474c"
            ariaLabel={
              porResponsavel.length
                ? `Processos em andamento por responsável, com a parcela em atraso destacada: ${porResponsavel
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
        </PainelGrafico>

        <PainelGrafico
          titulo="Processos concluídos por mês"
          meta={`${totalConcluidos} no período`}
        >
          <Colunas
            colunas={concluidosPorMes.map(p => ({
              rotulo: p.rotulo,
              total: p.total,
              descricao: (
                <>
                  <b>{p.rotulo}</b> — {p.total} concluído{p.total === 1 ? '' : 's'}
                </>
              ),
            }))}
            altura={212}
            ariaLabel={
              concluidosPorMes.length
                ? `Processos concluídos por mês: ${concluidosPorMes.map(p => `${p.rotulo}, ${p.total}`).join('; ')}.`
                : 'Sem histórico de conclusões.'
            }
            vazio={carregando ? 'Carregando…' : 'Sem histórico de conclusões'}
          />
          <p style={{ margin: '8px 0 0', fontSize: 10.5, color: CORES.ink3 }}>
            Pela data da última atividade registrada no processo.
          </p>
        </PainelGrafico>
      </div>
    </section>
  )
}
