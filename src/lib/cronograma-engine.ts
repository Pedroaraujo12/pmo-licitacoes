import type { CronogramaAtividade } from '@/types/database'

function parseDateBR(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function todayLocal(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export interface CronogramaStatus {
  total: number
  concluidas: number
  atrasadas: number
  progresso: number
  process_atrasado: boolean
  atividade_atual: string | null
  dias_restantes: number | null
  alerta: 'normal' | 'proximo_vencimento' | 'atrasado'
}

export function computeCronogramaStatus(atividades: CronogramaAtividade[]): CronogramaStatus {
  const total = atividades.length
  const concluidas = atividades.filter(a => a.status === 'concluido').length
  const atrasadas = atividades.filter(a => {
    if (a.status === 'concluido') return false
    if (!a.data_fim) return false
    return parseDateBR(a.data_fim!) < todayLocal()
  }).length
  const progresso = total > 0 ? Math.round((concluidas / total) * 100) : 0
  const primeiraNaoConcluida = atividades.find(a => a.status !== 'concluido')
  const process_atrasado = atrasadas > 0

  let dias_restantes: number | null = null
  let alerta: CronogramaStatus['alerta'] = 'normal'
  if (primeiraNaoConcluida?.data_fim) {
    const hoje = todayLocal()
    const fim = parseDateBR(primeiraNaoConcluida.data_fim)
    const diff = Math.ceil((fim.getTime() - hoje.getTime()) / 86400000)
    dias_restantes = diff
    if (diff < 0) alerta = 'atrasado'
    else if (diff <= 3) alerta = 'proximo_vencimento'
  }

  return {
    total, concluidas, atrasadas, progresso, process_atrasado,
    atividade_atual: primeiraNaoConcluida?.descricao || null,
    dias_restantes, alerta,
  }
}

export function getAtividadeIcon(status: string, dataFim: string | null) {
  if (status === 'concluido') return { icon: '✅', color: '#22c55e' }
  if (status === 'em_andamento') return { icon: '🔵', color: '#3b82f6' }
  if (!dataFim) return { icon: '⏳', color: '#94a3b8' }
  const hoje = todayLocal()
  const fim = parseDateBR(dataFim)
  const diff = Math.ceil((fim.getTime() - hoje.getTime()) / 86400000)
  if (diff < 0) return { icon: '🔴', color: '#ef4444' }
  if (diff <= 3) return { icon: '🟡', color: '#eab308' }
  return { icon: '⏳', color: '#64748b' }
}

export function getAtividadeBadgeColor(fase: string): string {
  const cores: Record<string, string> = {
    'Planejamento': '#6366f1',
    'Produção': '#3b82f6',
    'Análise': '#f59e0b',
    'Revisão': '#8b5cf6',
    'Execução': '#06b6d4',
    'Aprovação': '#10b981',
  }
  return cores[fase] || '#64748b'
}

export function recalcCascata(
  atividades: CronogramaAtividade[],
  atividadeAlteradaId: string,
  novaDataInicioReal: string | null,
): CronogramaAtividade[] {
  const updated = atividades.map(a => ({ ...a }))

  // Find index of altered activity
  const idx = updated.findIndex(a => a.id === atividadeAlteradaId)
  if (idx === -1) return updated

  // Apply override
  if (novaDataInicioReal) {
    updated[idx].data_inicio_real = novaDataInicioReal
  }

  // Recalculate from this point forward
  for (let i = idx; i < updated.length; i++) {
    const a = updated[i]
    if (a.status === 'concluido') continue

    // Determine start date
    if (i === idx && a.data_inicio_real) {
      a.data_inicio = a.data_inicio_real
    } else if (i > idx) {
      const prev = updated[i - 1]
      if (prev.data_fim_real) {
        const nextDay = parseDateBR(prev.data_fim_real)
        nextDay.setDate(nextDay.getDate() + 1)
        a.data_inicio = nextDay.toISOString().split('T')[0]
      } else if (prev.data_fim) {
        const nextDay = parseDateBR(prev.data_fim)
        nextDay.setDate(nextDay.getDate() + 1)
        a.data_inicio = nextDay.toISOString().split('T')[0]
      }
    }

    // Calculate end date
    if (a.dias_uteis !== null && a.dias_uteis !== undefined && a.dias_uteis > 0 && a.data_inicio) {
      const start = parseDateBR(a.data_inicio)
      let count = 0
      const current = new Date(start)
      while (count < a.dias_uteis) {
        current.setDate(current.getDate() + 1)
        if (current.getDay() !== 0 && current.getDay() !== 6) count++
      }
      a.data_fim = current.toISOString().split('T')[0]
    } else if (a.dias_uteis !== null && a.dias_uteis !== undefined && a.dias_uteis === 0 && a.data_inicio) {
      a.data_fim = a.data_inicio
    } else {
      a.data_fim = null
    }
  }

  return updated
}

export function getFaseAgrupada(fase: string): string {
  const mapa: Record<string, string> = {
    'Planejamento': '📋 Planejamento',
    'Produção': '⚙️ Produção',
    'Análise': '🔍 Análise',
    'Revisão': '📝 Revisão',
    'Execução': '🚀 Execução',
    'Aprovação': '✅ Aprovação',
  }
  return mapa[fase] || fase
}
