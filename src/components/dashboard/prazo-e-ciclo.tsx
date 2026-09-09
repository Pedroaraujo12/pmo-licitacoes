'use client'

import { CORES } from '@/lib/dashboard-tokens'
import { combinaFiltroPrazo, type ContagemFaixa, type LeadTimeFase, type FiltroPrazo } from '@/lib/dashboard-metrics'
import { BarrasHorizontais, Legenda, PainelGrafico, type LinhaBarra } from './chart-primitives'

/* ==========================================================================
   Prazos e ciclo.

   O alerta no topo da tela mandava "verificar os prazos no gráfico abaixo" e
   não havia gráfico de prazos nenhum — os dois existentes eram responsável e
   modalidade. Esta seção é o gráfico que o alerta promete, ao lado do tempo
   médio por etapa, que é a métrica de ciclo que faltava.
   ========================================================================== */

export const META_DIAS_ETAPA = 15

interface Props {
  faixas: ContagemFaixa[]
  leadTime: LeadTimeFase[]
  faixaSelecionada: FiltroPrazo | null
  onSelecionarFaixa: (faixa: FiltroPrazo | null) => void
  carregando?: boolean
}

export default function PrazoECiclo({ faixas, leadTime, faixaSelecionada, onSelecionarFaixa, carregando }: Props) {
  const totalAtrasados = faixas.filter(f => f.atrasada).reduce((s, f) => s + f.total, 0)
  const totalVencendo = faixas.find(f => !f.atrasada)?.total || 0
  const comDados = faixas.some(f => f.total > 0)

  const linhasPrazo: LinhaBarra[] = comDados
    ? faixas.map(f => ({
        rotulo: f.rotulo,
        total: f.total,
        cor: f.cor,
        selecionada: faixaSelecionada === null ? undefined : combinaFiltroPrazo(f.faixa, faixaSelecionada),
        onClick: () => onSelecionarFaixa(faixaSelecionada === f.faixa ? null : f.faixa),
        descricao: (
          <>
            <b>{f.rotulo}</b>
            <br />
            {f.total} processo{f.total === 1 ? '' : 's'} · clique para filtrar o fluxo
          </>
        ),
      }))
    : []

  const maxPrazo = Math.max(...faixas.map(f => f.total), 1)
  const passoPrazo = maxPrazo <= 4 ? 1 : maxPrazo <= 10 ? 2 : Math.ceil(maxPrazo / 5)
  const marcasPrazo: number[] = []
  for (let m = 0; m <= maxPrazo; m += passoPrazo) marcasPrazo.push(m)

  const maxLead = Math.max(...leadTime.map(l => l.dias), META_DIAS_ETAPA, 1)
  const passoLead = Math.max(5, Math.ceil(maxLead / 4 / 5) * 5)
  const marcasLead: number[] = []
  for (let m = 0; m <= maxLead; m += passoLead) marcasLead.push(m)

  const linhasLead: LinhaBarra[] = leadTime.map(l => ({
    rotulo: l.fase,
    total: l.dias,
    cor: l.dias > META_DIAS_ETAPA ? '#c8474c' : CORES.accentDim,
    valorTexto: `${l.dias}d`,
    descricao: (
      <>
        <b>{l.fase}</b>
        <br />
        {l.dias} dias em média{l.dias > META_DIAS_ETAPA ? ' · acima da meta' : ''}
        <br />
        <span style={{ color: CORES.ink3 }}>{l.amostra} atividade{l.amostra === 1 ? '' : 's'} concluída{l.amostra === 1 ? '' : 's'}</span>
      </>
    ),
  }))

  return (
    <section style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 11 }}>
        <h2 style={{
          margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.11em',
          textTransform: 'uppercase', color: CORES.ink2,
        }}>Prazos e ciclo</h2>
        <span style={{ fontSize: 11.5, color: CORES.ink3 }}>
          clique numa faixa para filtrar o fluxo de execução
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PainelGrafico
          titulo="Processos por faixa de prazo"
          meta={carregando ? 'carregando…' : `${totalAtrasados} em atraso · ${totalVencendo} vencendo`}
        >
          <BarrasHorizontais
            linhas={linhasPrazo}
            larguraRotulo={150}
            altura={176}
            alturaBarra={15}
            marcas={marcasPrazo}
            maximo={maxPrazo}
            ariaLabel={
              comDados
                ? `Processos por faixa de prazo: ${faixas.map(f => `${f.rotulo}, ${f.total}`).join('; ')}.`
                : 'Nenhum processo com prazo a vencer ou em atraso.'
            }
            vazio={carregando ? 'Carregando…' : 'Nenhum processo em atraso ou vencendo'}
          />
          <Legenda
            itens={[
              { cor: '#c98500', texto: 'A vencer' },
              { cor: '#a92f3c', texto: 'Atraso recente' },
              { cor: '#dd6963', texto: 'Atraso mais grave' },
            ]}
          />
        </PainelGrafico>

        <PainelGrafico
          titulo="Tempo médio por etapa"
          meta={`dias corridos · meta de ${META_DIAS_ETAPA}d`}
        >
          <BarrasHorizontais
            linhas={linhasLead}
            larguraRotulo={150}
            altura={176}
            alturaBarra={13}
            marcas={marcasLead}
            maximo={maxLead}
            referencia={META_DIAS_ETAPA}
            ariaLabel={
              leadTime.length
                ? `Tempo médio por etapa em dias: ${leadTime.map(l => `${l.fase}, ${l.dias}`).join('; ')}. Meta de ${META_DIAS_ETAPA} dias.`
                : 'Ainda não há atividades de cronograma concluídas para calcular o tempo por etapa.'
            }
            vazio={carregando ? 'Carregando…' : 'Sem atividades de cronograma concluídas'}
          />
          <Legenda
            itens={[
              { cor: CORES.accentDim, texto: 'Dentro da meta' },
              { cor: '#c8474c', texto: 'Acima da meta' },
              { cor: CORES.ink2, texto: `Meta de ${META_DIAS_ETAPA} dias`, barra: true },
            ]}
          />
        </PainelGrafico>
      </div>
    </section>
  )
}
