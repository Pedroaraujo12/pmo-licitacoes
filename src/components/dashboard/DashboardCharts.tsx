'use client'

import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement)

interface Props {
  porModalidade: [string | null, number][]
  etapaData: { fase: string | null; qtd: number }[]
  health: { g: number; y: number; r: number }
}

export default function DashboardCharts({ porModalidade, etapaData, health }: Props) {
  return (
    <div className="space-y-6">
      {/* Modalidade */}
      <div className="glass-card p-6">
        <h2 className="text-[10px] font-bold uppercase text-cyan-400 mb-4 tracking-wider">Distribuição por Modalidade</h2>
        <div className="h-[220px]">
          {porModalidade.length > 0 ? (
            <Bar
              data={{
                labels: porModalidade.map(([name]) => (name || 'Sem modalidade').toUpperCase()),
                datasets: [{
                  data: porModalidade.map(([, count]) => count),
                  backgroundColor: ['#06b6d4', '#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e', '#ec4899', '#f97316'],
                  borderRadius: 5,
                }]
              }}
              options={{
                indexAxis: 'y', maintainAspectRatio: false,
                plugins: { legend: { display: false } },
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

      {/* Etapa */}
      <div className="glass-card p-6">
        <h2 className="text-[10px] font-bold uppercase text-indigo-400 mb-4 tracking-wider">Distribuição por Etapa</h2>
        <div className="h-[220px]">
          {etapaData.length > 0 ? (
            <Bar
              data={{
                labels: etapaData.map(e => (e.fase || 'Sem etapa').toUpperCase()),
                datasets: [{
                  data: etapaData.map(e => e.qtd),
                  backgroundColor: ['#3b82f6', '#8b5cf6', '#f59e0b', '#6366f1', '#22c55e', '#ec4899'],
                  borderRadius: 5,
                }]
              }}
              options={{
                indexAxis: 'y', maintainAspectRatio: false,
                plugins: { legend: { display: false } },
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

      {/* Saúde */}
      <div className="glass-card p-6">
        <h2 className="text-[10px] font-bold uppercase text-emerald-400 mb-4 tracking-wider">Saúde dos Prazos</h2>
        <div className="h-[220px]">
          {health.g + health.y + health.r > 0 ? (
            <Bar
              data={{
                labels: ['No Prazo', 'Alerta', 'Atrasado'],
                datasets: [{
                  data: [health.g, health.y, health.r],
                  backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                  borderRadius: 5,
                }]
              }}
              options={{
                indexAxis: 'y', maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: { grid: { display: false }, ticks: { color: '#475569', font: { size: 8 } } },
                  y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', font: { size: 9, weight: 'bold' } } },
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
