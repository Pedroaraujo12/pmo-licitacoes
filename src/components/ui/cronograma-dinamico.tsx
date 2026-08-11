'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CronogramaAtividade } from '@/types/database'
import { formatDate } from '@/lib/utils'
import {
  computeCronogramaStatus, getAtividadeIcon, getAtividadeBadgeColor,
  getFaseAgrupada,
} from '@/lib/cronograma-engine'
import { listEtapasPorModalidade, type EtapaModelo } from '@/lib/simulador-cronograma'
import { aplicarRitoDaModalidade, ritoDivergente } from '@/lib/aplicar-rito'

interface Props {
  atividades: CronogramaAtividade[]
  processoId: string
  canEdit: boolean
  userRole?: string | null
  /** Modalidade do processo — habilita a checagem contra o rito cadastrado. */
  modalidadeId?: string | null
  /** Data de entrada, usada como base ao aplicar o rito. */
  dataEntrada?: string | null
  onUpdate?: (atividades: CronogramaAtividade[]) => void
}

export default function CronogramaDinamico({
  atividades: initial, processoId, canEdit, modalidadeId, dataEntrada, onUpdate,
}: Props) {
  const [atividades, setAtividades] = useState<CronogramaAtividade[]>(initial)
  const [overrideTarget, setOverrideTarget] = useState<CronogramaAtividade | null>(null)
  const [overrideDays, setOverrideDays] = useState('')
  const [overrideJustificativa, setOverrideJustificativa] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const [resetting, setResetting] = useState(false)

  // Reposicionamento: declarar em que etapa o processo realmente está hoje
  const [reposOpen, setReposOpen] = useState(false)
  const [reposOrdem, setReposOrdem] = useState('')
  const [reposData, setReposData] = useState('')
  const [reposConcluirAnteriores, setReposConcluirAnteriores] = useState(true)
  const [reposJustificativa, setReposJustificativa] = useState('')
  const [repositioning, setRepositioning] = useState(false)

  // Rito da modalidade x cronograma gravado
  const [etapasModelo, setEtapasModelo] = useState<EtapaModelo[]>([])
  const [aplicandoRito, setAplicandoRito] = useState(false)
  const [erroRito, setErroRito] = useState('')

  const status = computeCronogramaStatus(atividades)
  const ordenadas = [...atividades].sort((a, b) => a.ordem - b.ordem)

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      if (!modalidadeId) return
      const lista = await listEtapasPorModalidade(createClient(), modalidadeId)
      if (!cancelado) setEtapasModelo(lista)
    }

    carregar()
    return () => { cancelado = true }
  }, [modalidadeId])

  const divergente = ritoDivergente(atividades, etapasModelo)

  /**
   * Regrava as etapas deste processo com as do rito da modalidade,
   * preservando o que já foi trabalhado. É a correção pontual do mesmo
   * problema que `recalc_cronograma_modelos()` resolve em lote.
   */
  async function handleAplicarRito() {
    if (!modalidadeId || !dataEntrada) return
    if (!confirm(
      'As etapas deste processo serão substituídas pelas do rito da modalidade. ' +
      'Etapas concluídas ou em andamento mantêm o status, o responsável e as datas reais. ' +
      'Prazos ajustados manualmente voltam ao padrão do modelo. Continuar?'
    )) return

    setAplicandoRito(true)
    setErroRito('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      await aplicarRitoDaModalidade(supabase, {
        processoId,
        modalidadeId,
        dataEntrada,
        atividades,
        userId: user?.id ?? null,
      })

      const { data } = await supabase
        .from('cronograma_atividades')
        .select('*')
        .eq('processo_id', processoId)
        .order('ordem', { ascending: true })

      if (data) {
        setAtividades(data as CronogramaAtividade[])
        if (onUpdate) onUpdate(data as CronogramaAtividade[])
      }
    } catch (e) {
      setErroRito((e as Error)?.message || 'Não foi possível aplicar o rito da modalidade.')
    } finally {
      setAplicandoRito(false)
    }
  }

  function abrirReposicionamento() {
    const atual = ordenadas.find(a => a.status !== 'concluido') || ordenadas[0]
    setReposOrdem(String(atual?.ordem ?? 1))
    setReposData(new Date().toISOString().split('T')[0])
    setReposConcluirAnteriores(true)
    setReposJustificativa('')
    setReposOpen(true)
  }

  /**
   * Reancora o cronograma numa etapa escolhida: as anteriores podem ser dadas
   * como cumpridas e a contagem recomeça na data informada, seguindo as
   * durações do modelo. Difere do "Reiniciar Prazos", que sempre parte da
   * primeira etapa pendente e usa a data de hoje.
   */
  async function handleReposicionar(e: React.FormEvent) {
    e.preventDefault()
    const alvoOrdem = parseInt(reposOrdem, 10)
    if (!alvoOrdem || !reposData || !reposJustificativa.trim()) return

    setRepositioning(true)
    const { data: { user } } = await supabase.auth.getUser()

    const anteriores = ordenadas.filter(a => a.ordem < alvoOrdem)
    const aPartirDe = ordenadas.filter(a => a.ordem >= alvoOrdem)

    // 1. Etapas anteriores viram cumpridas (sem inventar datas reais que
    //    ninguém registrou — só o status muda)
    const concluidasIds: string[] = []
    if (reposConcluirAnteriores) {
      for (const a of anteriores) {
        if (a.status === 'concluido') continue
        await supabase.from('cronograma_atividades')
          .update({ status: 'concluido' }).eq('id', a.id)
        concluidasIds.push(a.id)
      }
    }

    // 2. Reencadeia da etapa alvo em diante, a partir da data informada
    let dataCorrente = reposData
    const updates: { id: string; data_inicio: string; data_fim: string | null }[] = []

    for (const a of aPartirDe) {
      if (a.status === 'concluido') {
        const ancora = a.data_fim_real || a.data_fim
        if (ancora) {
          const d = new Date(ancora)
          d.setDate(d.getDate() + 1)
          dataCorrente = d.toISOString().split('T')[0]
        }
        continue
      }

      const dias = a.dias_uteis || 0
      let dataFim: string | null = dataCorrente
      if (dias > 0) {
        const { data: result } = await supabase.rpc('somar_dias_uteis', {
          data_inicio: dataCorrente,
          qtd_dias: dias,
        })
        dataFim = (result as string) || dataCorrente
      }

      updates.push({ id: a.id, data_inicio: dataCorrente, data_fim: dataFim })

      if (dataFim) {
        const next = new Date(dataFim)
        next.setDate(next.getDate() + 1)
        dataCorrente = next.toISOString().split('T')[0]
      }
    }

    for (const u of updates) {
      await supabase.from('cronograma_atividades').update({
        data_inicio: u.data_inicio,
        data_fim: u.data_fim,
      }).eq('id', u.id)
    }

    const ultima = updates[updates.length - 1]
    if (ultima?.data_fim) {
      await supabase.from('processos').update({ data_entrega: ultima.data_fim }).eq('id', processoId)
    }

    // 3. Trilha de auditoria
    const alvo = ordenadas.find(a => a.ordem === alvoOrdem)
    await supabase.from('atividades').insert({
      processo_id: processoId,
      atividade: '__REPOSICIONAMENTO__',
      observacao: JSON.stringify({
        etapa_ordem: alvoOrdem,
        etapa_descricao: alvo?.descricao,
        data_base: reposData,
        etapas_reagendadas: updates.length,
        anteriores_concluidas: concluidasIds.length,
        justificativa: reposJustificativa.trim(),
        por: user?.id,
      }),
      data: new Date().toISOString().split('T')[0],
      created_by: user?.id || null,
    })

    // 4. Estado local
    const atualizadas = atividades.map(a => {
      const u = updates.find(x => x.id === a.id)
      if (u) return { ...a, data_inicio: u.data_inicio, data_fim: u.data_fim }
      if (concluidasIds.includes(a.id)) return { ...a, status: 'concluido' } as CronogramaAtividade
      return a
    })
    setAtividades(atualizadas)
    if (onUpdate) onUpdate(atualizadas)

    setReposOpen(false)
    setRepositioning(false)
  }

  async function handleReiniciarPrazos() {
    if (!confirm('Reiniciar a contagem de prazos para as atividades pendentes a partir de hoje?')) return
    setResetting(true)
    const { data: { user } } = await supabase.auth.getUser()
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const pendentes = atividades.filter(a => a.status !== 'concluido').sort((a, b) => a.ordem - b.ordem)
    if (pendentes.length === 0) { setResetting(false); return }

    const updates: { id: string; data_inicio: string; data_fim: string | null }[] = []
    let dataCorrente = hoje.toISOString().split('T')[0]

    for (const a of pendentes) {
      const dias = a.dias_uteis || 0
      let dataFim: string | null = null

      if (dias > 0) {
        // Usa RPC somar_dias_uteis para incluir feriados
        const { data: result } = await supabase.rpc('somar_dias_uteis', {
          data_inicio: dataCorrente,
          qtd_dias: dias,
        })
        dataFim = (result as string) || dataCorrente
      } else {
        dataFim = dataCorrente
      }

      updates.push({ id: a.id, data_inicio: dataCorrente, data_fim: dataFim })

      // Próxima atividade começa no dia seguinte ao fim da atual
      if (dataFim) {
        const next = new Date(dataFim)
        next.setDate(next.getDate() + 1)
        dataCorrente = next.toISOString().split('T')[0]
      }
    }

    // Batch update DB
    for (const u of updates) {
      await supabase.from('cronograma_atividades').update({
        data_inicio: u.data_inicio,
        data_fim: u.data_fim,
        observacao: JSON.stringify({ reset: { de: atividades.find(a => a.id === u.id)?.data_inicio, para: u.data_inicio, motivo: 'Reinício de prazos', por: user?.id } }),
      }).eq('id', u.id)
    }

    // Update processos.data_entrega with the new final deadline
    const lastUpdate = updates[updates.length - 1]
    if (lastUpdate && lastUpdate.data_fim) {
      await supabase.from('processos').update({ data_entrega: lastUpdate.data_fim }).eq('id', processoId)
    }

    // Audit trail
    await supabase.from('atividades').insert({
      processo_id: processoId,
      atividade: '__REINICIO_PRAZOS__',
      observacao: JSON.stringify({
        atividades_reiniciadas: pendentes.length,
        nova_data_base: hoje.toISOString().split('T')[0],
        justificativa: 'Reinício manual da contagem de prazos',
        por: user?.id,
      }),
      data: hoje.toISOString().split('T')[0],
      created_by: user?.id || null,
    })

    // Update local state
    const novasAtividades = atividades.map(a => {
      const up = updates.find(u => u.id === a.id)
      if (up) return { ...a, data_inicio: up.data_inicio, data_fim: up.data_fim }
      return a
    })
    setAtividades(novasAtividades)
    if (onUpdate) onUpdate(novasAtividades)
    setResetting(false)
  }

  async function handleStatusChange(a: CronogramaAtividade, novoStatus: string) {
    const update: Record<string, unknown> = { status: novoStatus }
    if (novoStatus === 'em_andamento') update.data_inicio_real = new Date().toISOString().split('T')[0]
    if (novoStatus === 'concluido') update.data_fim_real = new Date().toISOString().split('T')[0]

    const { error } = await supabase.from('cronograma_atividades').update(update).eq('id', a.id)
    if (error) return

    const updated = atividades.map(x => x.id === a.id ? { ...x, ...update } as CronogramaAtividade : x)
    setAtividades(updated)
    if (onUpdate) onUpdate(updated)
  }

  async function handleOverride(e: React.FormEvent) {
    e.preventDefault()
    if (!overrideTarget || !overrideDays || !overrideJustificativa.trim()) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    const dias = parseInt(overrideDays)
    const hoje = new Date().toISOString().split('T')[0]

    // Log override (legacy)
    const overrideLog = {
      atividade: overrideTarget.descricao,
      campo: 'dias_uteis',
      anterior: overrideTarget.dias_uteis,
      novo: dias,
      justificativa: overrideJustificativa.trim(),
      alterado_por: user?.id,
    }
    await supabase.from('atividades').insert({
      processo_id: processoId,
      atividade: '__OVERRIDE__',
      observacao: JSON.stringify(overrideLog),
      data: hoje,
      created_by: user?.id || null,
    })

    // Populate original dates on first override
    const originais: Record<string, unknown> = {}
    if (!overrideTarget.data_inicio_original) originais.data_inicio_original = overrideTarget.data_inicio
    if (!overrideTarget.data_fim_original) originais.data_fim_original = overrideTarget.data_fim

    // Update with motor-de-regras columns
    const updateData: Record<string, unknown> = {
      dias_uteis: dias,
      overridden: true,
      justificativa_override: overrideJustificativa.trim(),
      ...originais,
      observacao: JSON.stringify({ override: overrideLog }),
    }
    await supabase.from('cronograma_atividades').update(updateData).eq('id', overrideTarget.id)

    // Log no cronograma_override_log (se tabela existir)
    await supabase.from('cronograma_override_log').insert({
      processo_id: processoId,
      cronograma_atividade_id: overrideTarget.id,
      campo_alterado: 'dias_uteis',
      valor_anterior: { dias_uteis: overrideTarget.dias_uteis },
      valor_novo: { dias_uteis: dias },
      justificativa: overrideJustificativa.trim(),
      alterado_por: user?.id,
    }).maybeSingle()

    // Recalcula em cascata a partir da atividade ajustada (persistindo no banco)
    const dataCorrenteBase = overrideTarget.data_inicio_real
      ? new Date(overrideTarget.data_inicio_real)
      : overrideTarget.data_inicio
        ? new Date(overrideTarget.data_inicio)
        : new Date()
    dataCorrenteBase.setHours(0, 0, 0, 0)
    let dataCorrente = dataCorrenteBase.toISOString().split('T')[0]

    const pendentes = atividades
      .filter(a => a.ordem >= overrideTarget.ordem)
      .sort((a, b) => a.ordem - b.ordem)

    const updates: { id: string; data_inicio: string; data_fim: string | null }[] = []
    for (const a of pendentes) {
      if (a.status === 'concluido') {
        const ancora = a.data_fim_real || a.data_fim
        if (ancora) {
          const d = new Date(ancora)
          d.setDate(d.getDate() + 1)
          dataCorrente = d.toISOString().split('T')[0]
        }
        continue
      }
      if (a.id === overrideTarget.id) {
        dataCorrente = overrideTarget.data_inicio_real || overrideTarget.data_inicio || dataCorrente
      }
      const diasAtiv = a.id === overrideTarget.id ? dias : (a.dias_uteis || 0)
      let dataFim: string | null = dataCorrente
      if (diasAtiv > 0) {
        const { data: result } = await supabase.rpc('somar_dias_uteis', {
          data_inicio: dataCorrente,
          qtd_dias: diasAtiv,
        })
        dataFim = (result as string) || dataCorrente
      }
      updates.push({ id: a.id, data_inicio: dataCorrente, data_fim: dataFim })
      if (dataFim) {
        const next = new Date(dataFim)
        next.setDate(next.getDate() + 1)
        dataCorrente = next.toISOString().split('T')[0]
      }
    }

    for (const u of updates) {
      await supabase.from('cronograma_atividades').update({
        data_inicio: u.data_inicio,
        data_fim: u.data_fim,
      }).eq('id', u.id)
    }

    const lastUpdate = updates[updates.length - 1]
    if (lastUpdate && lastUpdate.data_fim) {
      await supabase.from('processos').update({ data_entrega: lastUpdate.data_fim }).eq('id', processoId)
    }

    const recalculated = atividades.map(a => {
      const u = updates.find(x => x.id === a.id)
      if (u) return { ...a, data_inicio: u.data_inicio, data_fim: u.data_fim }
      if (a.id === overrideTarget.id) {
        return {
          ...a, dias_uteis: dias, overridden: true,
          justificativa_override: overrideJustificativa.trim(),
          data_inicio_original: a.data_inicio_original || a.data_inicio,
          data_fim_original: a.data_fim_original || a.data_fim,
          observacao: JSON.stringify({ override: overrideLog }),
        }
      }
      return a
    })
    setAtividades(recalculated)
    if (onUpdate) onUpdate(recalculated)

    setOverrideTarget(null)
    setOverrideDays('')
    setOverrideJustificativa('')
    setSaving(false)
  }

  // Group by fase
  const fases = [...new Set(atividades.map(a => a.fase))]
  const grouped = fases.map(fase => ({
    fase,
    label: getFaseAgrupada(fase),
    atividades: atividades.filter(a => a.fase === fase),
  }))

  return (
    <div>
      {/* Cronograma fora do rito da modalidade */}
      {divergente && (
        <div style={{
          background: 'rgba(245,158,11,0.1)',
          border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 16,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', marginBottom: 2 }}>
              Este cronograma não corresponde ao rito da modalidade
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              São {atividades.length} etapas gravadas contra {etapasModelo.length} do modelo.
              Aplicar o rito substitui as etapas pelas oficiais, preservando status,
              responsável e datas reais do que já foi trabalhado.
            </div>
            {erroRito && (
              <div style={{ fontSize: 12, color: '#fca5a5', marginTop: 6 }}>{erroRito}</div>
            )}
          </div>
          {canEdit && dataEntrada && (
            <button onClick={handleAplicarRito} disabled={aplicandoRito} style={{
              padding: '8px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8,
              border: '1px solid rgba(245,158,11,0.4)',
              cursor: aplicandoRito ? 'not-allowed' : 'pointer',
              background: 'rgba(245,158,11,0.15)', color: '#fbbf24',
              whiteSpace: 'nowrap',
            }}>
              {aplicandoRito ? 'Aplicando...' : '⟳ Aplicar rito da modalidade'}
            </button>
          )}
          {canEdit && !dataEntrada && (
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              Informe a data de entrada do processo para aplicar o rito.
            </span>
          )}
        </div>
      )}

      {/* Status Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20, padding: 16, background: 'rgba(15,23,42,0.5)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600 }}>PROGRESSO</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3 }}>
              <div style={{ width: `${status.progresso}%`, height: '100%', background: '#22c55e', borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: status.progresso === 100 ? '#22c55e' : '#f1f5f9' }}>{status.progresso}%</span>
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{status.concluidas}/{status.total} etapas</div>
        </div>
        <div style={{ minWidth: 100 }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600 }}>ATRASADAS</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: status.atrasadas > 0 ? '#ef4444' : '#22c55e' }}>
            {status.atrasadas > 0 ? `🔴 ${status.atrasadas}` : '✅ 0'}
          </div>
        </div>
        <div style={{ minWidth: 100 }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600 }}>ATIVIDADE ATUAL</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {status.atividade_atual || 'Nenhuma'}
          </div>
          {status.dias_restantes !== null && (
            <div style={{ fontSize: 11, color: status.alerta === 'atrasado' ? '#ef4444' : status.alerta === 'proximo_vencimento' ? '#eab308' : '#94a3b8', marginTop: 2 }}>
              {status.alerta === 'atrasado' ? `Atrasado ${Math.abs(status.dias_restantes)}d` : `${status.dias_restantes}d restantes`}
            </div>
          )}
        </div>
        {canEdit && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={abrirReposicionamento} disabled={repositioning} style={{
              padding: '8px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8,
              border: '1px solid rgba(56,189,248,0.3)', cursor: repositioning ? 'not-allowed' : 'pointer',
              background: 'rgba(56,189,248,0.12)', color: '#38bdf8',
              transition: 'background 0.15s',
            }} title="Informar em que etapa o processo está hoje e recalcular a partir dela">
              📍 Etapa atual
            </button>
            {status.atrasadas > 0 && (
              <button onClick={handleReiniciarPrazos} disabled={resetting} style={{
                padding: '8px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8,
                border: '1px solid rgba(234,179,8,0.3)', cursor: resetting ? 'not-allowed' : 'pointer',
                background: 'rgba(234,179,8,0.12)', color: '#eab308',
                transition: 'background 0.15s',
              }} title="Recontar todas as etapas pendentes a partir de hoje">
                {resetting ? 'Reiniciando...' : '🔄 Reiniciar Prazos'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Timeline Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 11, color: '#94a3b8' }}>
        <span>✅ Concluído</span>
        <span>🔵 Em Andamento</span>
        <span>⏳ Previsto</span>
        <span>🟡 Vence em 3d</span>
        <span>🔴 Atrasado</span>
        <span>🔸 Data ajustada</span>
      </div>

      {/* Activities by Phase */}
      {grouped.map(group => (
        <div key={group.fase} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: getAtividadeBadgeColor(group.fase), marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {group.label}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {group.atividades.map(a => {
              const vi = getAtividadeIcon(a.status, a.data_fim)
              const isOverridden = !!(a.observacao && a.observacao.includes('override'))
              const dataImpactada = a.data_inicio_real && a.status !== 'concluido'

              return (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px',
                  background: a.status === 'concluido' ? 'rgba(34,197,94,0.06)' :
                    vi.icon === '🔴' ? 'rgba(239,68,68,0.08)' : 'rgba(30,41,59,0.4)',
                  borderRadius: 10,
                  borderLeft: `3px solid ${vi.color}`,
                  border: `1px solid ${
                    vi.icon === '🔴' ? 'rgba(239,68,68,0.2)' :
                    vi.icon === '🟡' ? 'rgba(234,179,8,0.2)' : 'rgba(255,255,255,0.06)'
                  }`,
                  opacity: a.status === 'concluido' ? 0.7 : 1,
                }}>
                  {/* Icon */}
                  <span style={{ fontSize: 14 }}>{vi.icon}</span>

                  {/* Number */}
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', minWidth: 20 }}>#{a.ordem}</span>

                  {/* Description */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 500, color: a.status === 'concluido' ? '#64748b' : '#e2e8f0',
                      textDecoration: a.status === 'concluido' ? 'line-through' : 'none',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {a.descricao}
                      {isOverridden && <span style={{ color: '#f59e0b', fontSize: 10, marginLeft: 4 }}>✏️</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      <span>{a.setor}</span>
                      {a.dias_uteis !== null && a.dias_uteis !== undefined && (
                        <span>{a.dias_uteis > 0 ? `${a.dias_uteis}d úteis` : 'Marco'}</span>
                      )}
                      {a.data_inicio && <span>{formatDate(a.data_inicio)} → {a.data_fim ? formatDate(a.data_fim) : '—'}</span>}
                      {dataImpactada && <span style={{ color: '#f97316' }}>🔸 Data ajustada</span>}
                    </div>
                  </div>

                  {/* Status and Actions */}
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {a.status === 'nao_iniciado' && canEdit && (
                      <>
                        <button onClick={() => handleStatusChange(a, 'em_andamento')}
                          className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer border-none"
                        >Iniciar</button>
                        {a.dias_uteis !== null && a.dias_uteis !== undefined && a.dias_uteis > 0 && (
                          <button onClick={() => { setOverrideTarget(a); setOverrideDays(String(a.dias_uteis)) }}
                            className="bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer border-none"
                          >✏️ Ajustar</button>
                        )}
                      </>
                    )}
                    {a.status === 'em_andamento' && canEdit && (
                      <button onClick={() => handleStatusChange(a, 'concluido')}
                        className="bg-green-600/20 hover:bg-green-600/40 text-green-400 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer border-none"
                      >Concluir</button>
                    )}
                    {a.status === 'concluido' && (
                      <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>
                        {a.data_fim_real ? `Concluído ${formatDate(a.data_fim_real)}` : 'Concluído'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Reposicionamento Modal */}
      {reposOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        }} onClick={() => setReposOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#1e293b', borderRadius: 16, padding: 24,
            width: '90%', maxWidth: 520, border: '1px solid rgba(255,255,255,0.1)',
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', margin: '0 0 4px' }}>
              📍 Em que etapa o processo está?
            </h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px' }}>
              A contagem recomeça nessa etapa, na data informada, e segue as durações do modelo.
            </p>

            <form onSubmit={handleReposicionar}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>
                  ETAPA ATUAL
                </label>
                <select value={reposOrdem} onChange={e => setReposOrdem(e.target.value)} required
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 13, background: 'rgba(15,23,42,0.5)', color: '#cbd5e1', outline: 'none', cursor: 'pointer' }}
                >
                  {ordenadas.map(a => (
                    <option key={a.id} value={a.ordem}>
                      {a.ordem}. {a.descricao}{a.dias_uteis ? ` (${a.dias_uteis}D)` : ' (marco)'}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>
                  DATA DE INÍCIO DESSA ETAPA
                </label>
                <input type="date" value={reposData} required
                  onChange={e => setReposData(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 13, background: 'rgba(15,23,42,0.5)', color: '#cbd5e1', outline: 'none' }}
                />
                <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0' }}>
                  Se a etapa já começou, informe a data real de início — não a de hoje.
                </p>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 12, color: '#cbd5e1', cursor: 'pointer' }}>
                <input type="checkbox" checked={reposConcluirAnteriores}
                  onChange={e => setReposConcluirAnteriores(e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: '#38bdf8', cursor: 'pointer' }}
                />
                Marcar as etapas anteriores como concluídas
              </label>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>
                  JUSTIFICATIVA (OBRIGATÓRIA)
                </label>
                <textarea value={reposJustificativa} required rows={3}
                  onChange={e => setReposJustificativa(e.target.value)}
                  placeholder="Informe o motivo do reposicionamento do cronograma..."
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 13, background: 'rgba(15,23,42,0.5)', color: '#cbd5e1', outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setReposOpen(false)}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer border-none"
                >Cancelar</button>
                <button type="submit" disabled={repositioning || !reposJustificativa.trim()}
                  className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer border-none disabled:opacity-50"
                >{repositioning ? 'Reposicionando...' : 'Reposicionar Cronograma'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Override Modal */}
      {overrideTarget && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        }} onClick={() => setOverrideTarget(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#1e293b', borderRadius: 16, padding: 24,
            width: '90%', maxWidth: 440, border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', margin: '0 0 4px' }}>✏️ Ajustar Prazo</h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px' }}>
              {overrideTarget.descricao} — Prazo atual: <strong>{overrideTarget.dias_uteis}</strong> dias úteis
            </p>
            <form onSubmit={handleOverride}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>
                  NOVO PRAZO (DIAS ÚTEIS)
                </label>
                <input type="number" min={0} value={overrideDays} required
                  onChange={e => setOverrideDays(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 13, background: 'rgba(15,23,42,0.5)', color: '#cbd5e1', outline: 'none' }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>
                  JUSTIFICATIVA (OBRIGATÓRIA)
                </label>
                <textarea value={overrideJustificativa} required rows={3}
                  onChange={e => setOverrideJustificativa(e.target.value)}
                  placeholder="Informe o motivo do ajuste de prazo..."
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 13, background: 'rgba(15,23,42,0.5)', color: '#cbd5e1', outline: 'none', resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setOverrideTarget(null)}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer border-none"
                >Cancelar</button>
                <button type="submit" disabled={saving || !overrideJustificativa.trim()}
                  className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer border-none disabled:opacity-50"
                >{saving ? 'Salvando...' : 'Salvar Ajuste'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
