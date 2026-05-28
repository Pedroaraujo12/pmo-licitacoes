'use client'

import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement)

interface Props {
  porResponsavel: [string | null, number][]
  porModalidade: [string | null, number][]
  selectedResponsavel: string | null
  onResponsavelSelect: (responsavel: string | null) => void
  selectedModalidade: string | null
  onModalidadeSelect: (modalidade: string | null) => void
}

const RESP_COLORS = ['#60a5fa', '#38bdf8', '#22d3ee', '#2dd4bf', '#34d399', '#a78bfa', '#c084fc', '#f472b6', '#fb923c', '#f87171']
const MODALIDADE_COLORS = ['#60a5fa', '#38bdf8', '#22d3ee', '#2dd4bf']

export default function DashboardCharts({
  porResponsavel,
  porModalidade,
  selectedResponsavel,
  onResponsavelSelect,
  selectedModalidade,
  onModalidadeSelect,
}: Props) {
  const makeGradient = (ctx: CanvasRenderingContext2D, area: { top: number; bottom: number }, from: string, to: string) => {
    const gradient = ctx.createLinearGradient(0, area.top, 0, area.bottom)
    gradient.addColorStop(0, from)
    gradient.addColorStop(1, to)
    return gradient
  }

  return (
    <div className="space-y-6">
      {/* Responsável */}
      <div className="glass-card p-6">
        <h2 className="text-[10px] font-bold uppercase text-blue-400 mb-4 tracking-wider">Em Andamento por Responsável</h2>
        {selectedResponsavel && (
          <button
            type="button"
            onClick={() => onResponsavelSelect(null)}
            className="mb-3 bg-blue-500/15 text-blue-300 border border-blue-400/40 rounded-md px-2 py-1 text-[10px] font-bold cursor-pointer"
          >
            Filtro: {selectedResponsavel} (limpar)
          </button>
        )}
        <div className="h-[220px]">
          {porResponsavel.length > 0 ? (
            <Bar
              data={{
                labels: porResponsavel.map(([name]) => (name || 'Sem responsável').toUpperCase()),
                datasets: [{
                  data: porResponsavel.map(([, count]) => count),
                  backgroundColor: (context) => {
                    const { chart, dataIndex } = context
                    const { ctx, chartArea } = chart
                    if (!chartArea) return '#60a5fa'
                    const color = RESP_COLORS[dataIndex % RESP_COLORS.length]
                    const isSelected = selectedResponsavel && (porResponsavel[dataIndex]?.[0] || 'Sem responsável').trim() === selectedResponsavel
                    const top = isSelected ? '#34d399' : color
                    const bottom = isSelected ? '#059669' : '#1e293b'
                    return makeGradient(ctx, chartArea, top, bottom)
                  },
                  borderColor: porResponsavel.map(([name]) => {
                    const normalized = (name || 'Sem responsável').trim()
                    return selectedResponsavel && normalized === selectedResponsavel ? '#34d399' : '#334155'
                  }),
                  borderWidth: 1,
                  borderRadius: 5,
                }],
              }}
              options={{
                indexAxis: 'y', maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                onClick: (_, elements) => {
                  if (!elements.length) return
                  const idx = elements[0].index
                  const selected = (porResponsavel[idx]?.[0] || 'Sem responsável').trim()
                  onResponsavelSelect(selectedResponsavel === selected ? null : selected)
                },
                scales: {
                  x: { grid: { display: false }, ticks: { color: '#475569', font: { size: 8 } } },
                  y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', font: { size: 8 } } },
                },
              }}
            />
          ) : (
            <EmptyChart />
          )}
        </div>
      </div>

      {/* Modalidade */}
      <div className="glass-card p-6">
        <h2 className="text-[10px] font-bold uppercase text-cyan-400 mb-4 tracking-wider">Distribuição por Modalidade</h2>
        {selectedModalidade && (
          <button
            type="button"
            onClick={() => onModalidadeSelect(null)}
            className="mb-3 bg-cyan-500/15 text-cyan-300 border border-cyan-400/40 rounded-md px-2 py-1 text-[10px] font-bold cursor-pointer"
          >
            Filtro: {selectedModalidade} (limpar)
          </button>
        )}
        <div className="h-[220px]">
          {porModalidade.length > 0 ? (
            <Bar
              data={{
                labels: porModalidade.map(([name]) => (name || 'Sem modalidade').toUpperCase()),
                datasets: [{
                  data: porModalidade.map(([, count]) => count),
                  backgroundColor: (context) => {
                    const { chart, dataIndex } = context
                    const { ctx, chartArea } = chart
                    if (!chartArea) return '#60a5fa'
                    const color = MODALIDADE_COLORS[dataIndex % MODALIDADE_COLORS.length]
                    const isSelected = selectedModalidade && (porModalidade[dataIndex]?.[0] || 'Sem modalidade').trim() === selectedModalidade
                    const top = isSelected ? '#34d399' : color
                    const bottom = isSelected ? '#059669' : '#1e293b'
                    return makeGradient(ctx, chartArea, top, bottom)
                  },
                  borderColor: porModalidade.map(([name]) => {
                    const normalized = (name || 'Sem modalidade').trim()
                    return selectedModalidade && normalized === selectedModalidade ? '#4ade80' : '#334155'
                  }),
                  borderWidth: 1,
                  borderRadius: 5,
                }]
              }}
              options={{
                indexAxis: 'y', maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                onClick: (_, elements) => {
                  if (!elements.length) return
                  const idx = elements[0].index
                  const selected = (porModalidade[idx]?.[0] || 'Sem modalidade').trim()
                  onModalidadeSelect(selectedModalidade === selected ? null : selected)
                },
                scales: {
                  x: { grid: { display: false }, ticks: { color: '#475569', font: { size: 8 } } },
                  y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', font: { size: 8 } } },
                },
              }}
            />
          ) : (
            <EmptyChart />
          )}
        </div>
      </div>

    </div>
  )
}

function EmptyChart() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', fontSize: 12 }}>
      Nenhum dado disponível
    </div>
  )
}
