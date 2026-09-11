'use client'

import { CORES } from '@/lib/dashboard-tokens'
import type { PontoMensal } from '@/lib/dashboard-metrics'
import { Colunas, PainelGrafico } from './chart-primitives'

/* ==========================================================================
   Processos concluídos por mês.

   A única dimensão temporal do painel. A data de conclusão vem do fim da
   última etapa concluída do cronograma — `processos.data_atividade` está
   preenchida em poucos concluídos e `updated_at` carrega o carimbo de uma
   importação em lote. A cobertura parcial é dita na tela, para a série não
   parecer mais rasa do que é.
   ========================================================================== */

interface Props {
  concluidosPorMes: PontoMensal[]
  /** Concluídos com data conhecida, e o total de concluídos. */
  concluidosComData: number
  concluidosTotal: number
  altura?: number
  carregando?: boolean
}

export default function TendenciaChart({
  concluidosPorMes, concluidosComData, concluidosTotal, altura = 212, carregando,
}: Props) {
  const total = concluidosPorMes.reduce((s, p) => s + p.total, 0)

  return (
    <PainelGrafico titulo="Processos concluídos por mês" meta={`${total} no período`}>
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
        altura={altura}
        ariaLabel={
          concluidosPorMes.length
            ? `Processos concluídos por mês: ${concluidosPorMes.map(p => `${p.rotulo}, ${p.total}`).join('; ')}.`
            : 'Sem histórico de conclusões.'
        }
        vazio={carregando ? 'Carregando…' : 'Sem histórico de conclusões'}
      />
      <p style={{ margin: '8px 0 0', fontSize: 10.5, color: CORES.ink3 }}>
        Pela data de fim da última etapa concluída do cronograma
        {!carregando && concluidosTotal > 0 &&
          ` — ${concluidosComData} de ${concluidosTotal} concluídos têm cronograma registrado`}.
      </p>
    </PainelGrafico>
  )
}
